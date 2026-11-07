import { Extension, mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { matchReplaceRule, type ReplaceRule } from "../model/replace-rules";

export interface TextRange {
  from: number;
  to: number;
}

/**
 * 단락 안의 글자를 문서 위치와 일대일로 맞춘 문자열로 돌려준다.
 * 글자는 한 칸, 줄바꿈 노드도 한 칸이라 문자열 위치에 시작 위치를 더하면 문서 위치가 된다.
 */
function eachTextblock(doc: ProseMirrorNode, visit: (text: string, start: number) => void) {
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    node.forEach((child) => {
      text += child.isText ? (child.text ?? "") : "\n";
    });
    visit(text, pos + 1);
    return false;
  });
}

/** 대소문자를 가리지 않고 찾는다. 서식이 나뉜 곳에 걸친 글자도 찾지만 단락을 넘어서는 찾지 않는다. */
export function findRanges(doc: ProseMirrorNode, query: string): TextRange[] {
  if (!query) return [];
  const needle = query.toLowerCase();
  const ranges: TextRange[] = [];
  eachTextblock(doc, (text, start) => {
    const haystack = text.toLowerCase();
    // 소문자로 바꿔 길이가 달라지는 글자가 있으면 위치가 어긋나므로 그 단락은 원문 그대로 찾는다.
    const source = haystack.length === text.length ? haystack : text;
    let index = source.indexOf(needle);
    while (index !== -1) {
      ranges.push({ from: start + index, to: start + index + needle.length });
      index = source.indexOf(needle, index + needle.length);
    }
  });
  return ranges;
}

/** 앞 글자가 없거나 공백이거나 여는 기호면 여는 따옴표다. */
function quoteFor(mark: '"' | "'", previous: string | undefined): string {
  const opening = previous === undefined || /[\s([{“‘「『]/.test(previous);
  if (mark === '"') return opening ? "“" : "”";
  return opening ? "‘" : "’";
}

export interface SymbolEdit extends TextRange {
  text: string;
}

/** 본문의 곧은 따옴표와 점 세 개를 표준 기호로 바꿀 자리를 찾는다. */
export function findSymbolEdits(doc: ProseMirrorNode): SymbolEdit[] {
  const edits: SymbolEdit[] = [];
  eachTextblock(doc, (text, start) => {
    for (const match of text.matchAll(/\.{3}|"|'/g)) {
      const found = match[0];
      const previous = match.index === 0 ? undefined : text[match.index - 1];
      edits.push({
        from: start + match.index,
        to: start + match.index + found.length,
        text: found === "..." ? "…" : quoteFor(found as '"' | "'", previous),
      });
    }
  });
  return edits;
}

/** 뒤에서부터 적용해 앞쪽 위치가 밀리지 않게 한다. 서식은 그 자리의 것을 이어받는다. */
export function applyEdits(tr: Transaction, edits: SymbolEdit[]): Transaction {
  for (const { from, to, text } of [...edits].reverse()) {
    if (text) tr.insertText(text, from, to);
    else tr.delete(from, to);
  }
  return tr;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    authorComment: {
      /** 고른 단락을 작가 주석으로 감싸거나 풀어 준다. */
      toggleAuthorComment: () => ReturnType;
    };
  }
}

/** 작가만 보는 주석 단락. 글자 수와 내보내기에서 빠지고, 독자 응답에는 API가 빼고 보낸다. */
export const AuthorComment = Node.create({
  name: "authorComment",
  group: "block",
  content: "paragraph+",
  defining: true,
  parseHTML: () => [{ tag: "div[data-author-comment]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-author-comment": "", role: "note", "aria-label": "작가 주석" }),
    0,
  ],
  addCommands() {
    return {
      toggleAuthorComment:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
  addInputRules() {
    // 단락 맨 앞의 %% 뒤에 공백을 쓰면 주석이 된다.
    return [wrappingInputRule({ find: /^%%\s$/, type: this.type })];
  },
});

export interface SearchState {
  query: string;
  current: TextRange | null;
}

export const searchKey = new PluginKey<SearchState>("raonSearch");

/** 찾은 글자를 표시한다. 문서를 바꾸지 않으므로 변경 사항이나 실행 취소 기록에 남지 않는다. */
export const SearchHighlight = Extension.create({
  name: "searchHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: "", current: null }),
          apply: (tr, value) => tr.getMeta(searchKey) ?? value,
        },
        props: {
          decorations(state) {
            const search = searchKey.getState(state);
            if (!search?.query) return null;
            return DecorationSet.create(
              state.doc,
              findRanges(state.doc, search.query).map(({ from, to }) =>
                Decoration.inline(from, to, {
                  class: from === search.current?.from ? "search-match search-current" : "search-match",
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

export interface NoteLinkSource {
  id: string;
  title: string;
  aliases: string[];
}

export interface NoteMatch extends TextRange {
  noteId: string;
}

/** 한 글자 이름은 조사나 다른 낱말 곳곳에 걸려 표시가 의미를 잃으므로 찾지 않는다. */
const MIN_TERM_LENGTH = 2;

export interface NoteMatcher {
  pattern: RegExp;
  ids: Map<string, string>;
}

/** 긴 이름부터 찾아 ‘이안 왕자’가 ‘이안’보다 먼저 잡히게 한다. 이름이 겹치면 앞 문서가 차지한다. */
export function createNoteMatcher(notes: NoteLinkSource[]): NoteMatcher | null {
  const ids = new Map<string, string>();
  for (const note of notes) {
    for (const name of [note.title, ...note.aliases]) {
      const term = name.trim().toLowerCase();
      if (term.length >= MIN_TERM_LENGTH && !ids.has(term)) ids.set(term, note.id);
    }
  }
  if (!ids.size) return null;
  const source = [...ids.keys()]
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
    .join("|");
  return { pattern: new RegExp(source, "giu"), ids };
}

/** 문서에서 설정 이름이 나오는 자리를 찾는다. 단락을 넘어서는 찾지 않는다. */
export function findNoteMatches(doc: ProseMirrorNode, matcher: NoteMatcher | null): NoteMatch[] {
  if (!matcher) return [];
  const matches: NoteMatch[] = [];
  eachTextblock(doc, (text, start) => {
    for (const match of text.matchAll(matcher.pattern)) {
      const noteId = matcher.ids.get(match[0].toLowerCase());
      if (noteId) matches.push({ from: start + match.index, to: start + match.index + match[0].length, noteId });
    }
  });
  return matches;
}

interface NoteLinkState {
  matcher: NoteMatcher | null;
  matches: NoteMatch[];
  decorations: DecorationSet;
}

export const noteLinkKey = new PluginKey<NoteLinkState>("raonNoteLinks");

function buildNoteLinks(doc: ProseMirrorNode, matcher: NoteMatcher | null): NoteLinkState {
  const matches = findNoteMatches(doc, matcher);
  return {
    matcher,
    matches,
    decorations: DecorationSet.create(
      doc,
      matches.map(({ from, to }) => Decoration.inline(from, to, { class: "note-link" })),
    ),
  };
}

/** 커서가 놓인 설정 이름의 문서를 돌려준다. 이름 바로 뒤에 있어도 그 이름으로 친다. */
export function noteIdAtCursor(state: EditorState): string | null {
  const head = state.selection.head;
  return noteLinkKey.getState(state)?.matches.find(({ from, to }) => from <= head && head <= to)?.noteId ?? null;
}

/**
 * 본문의 설정 이름에 밑줄을 긋는다. 문서를 바꾸지 않으므로 저장이나 실행 취소 기록에 남지 않는다.
 * 내용은 커서가 그 이름에 놓였을 때 에디터 아래에 보여 준다. 마우스를 올려야만 보이면 키보드로 읽을 수 없기 때문이다.
 */
export const NoteLinks = Extension.create({
  name: "noteLinks",
  addProseMirrorPlugins() {
    return [
      new Plugin<NoteLinkState>({
        key: noteLinkKey,
        state: {
          init: (_, { doc }) => buildNoteLinks(doc, null),
          apply(tr, value) {
            const next = tr.getMeta(noteLinkKey) as NoteMatcher | null | undefined;
            if (next !== undefined) return buildNoteLinks(tr.doc, next);
            return tr.docChanged ? buildNoteLinks(tr.doc, value.matcher) : value;
          },
        },
        props: {
          decorations: (state) => noteLinkKey.getState(state)?.decorations ?? null,
        },
      }),
    ];
  },
});

/** 커서가 있는 최상위 단락에 표시를 단다. "현재 단락만 보기"가 이 표시로 나머지를 흐리게 한다. */
export const CurrentBlock = Extension.create({
  name: "currentBlock",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("raonCurrentBlock"),
        props: {
          decorations(state) {
            const { $head } = state.selection;
            if ($head.depth === 0) return null;
            const from = $head.before(1);
            return DecorationSet.create(state.doc, [
              Decoration.node(from, from + $head.node(1).nodeSize, { class: "is-current" }),
            ]);
          },
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Storage {
    smartInput: { enabled: boolean; autoBracket: boolean; rules: ReplaceRule[] };
  }
}

const BRACKETS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "「": "」",
  "『": "』",
  "《": "》",
  "〈": "〉",
  "“": "”",
  "‘": "’",
};
/** 곧은 따옴표에서 바뀌는 굽은 따옴표는 키보드로 직접 칠 일이 드물어 닫는 쪽을 덧쓰는 데만 쓴다. */
const OPEN_ON_TYPE = new Set(["(", "[", "{", "「", "『", "《", "〈"]);
const CLOSERS = new Set(Object.values(BRACKETS));

/** 입력하는 곧은 따옴표와 점 세 개를 표준 기호로 바꾼다. 실행 취소로 바로 되돌릴 수 있다. */
export const SmartInput = Extension.create({
  name: "smartInput",
  addStorage() {
    return { enabled: true, autoBracket: true, rules: [] as ReplaceRule[] };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: new PluginKey("raonSmartInput"),
        props: {
          handleTextInput(view, from, to, text) {
            const { state } = view;
            // 작가가 직접 정한 규칙을 내장 입력 보조보다 먼저 적용한다.
            if (storage.rules.length > 0 && from === to) {
              const parentStart = from - state.doc.resolve(from).parentOffset;
              const typed = state.doc.textBetween(parentStart, from, "\n", "\n") + text;
              const rule = matchReplaceRule(storage.rules, typed);
              if (rule) {
                // 규칙이 입력한 글자 안에서 끝나면 그 앞의 글자는 그대로 넣고, 넘어가면 이미 쓴 글자까지 바꾼다.
                const start = from - Math.max(rule.from.length - text.length, 0);
                const kept = text.slice(0, Math.max(text.length - rule.from.length, 0));
                view.dispatch(state.tr.insertText(kept + rule.to, start, from));
                return true;
              }
            }
            // 닫는 괄호는 바로 뒤에 있으면 새로 넣지 않고 지나간다.
            if (storage.autoBracket && from === to && CLOSERS.has(text) && state.doc.textBetween(to, to + 1) === text) {
              view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, to + 1)));
              return true;
            }
            if (storage.autoBracket && OPEN_ON_TYPE.has(text)) {
              const closer = BRACKETS[text] as string;
              const selected = state.doc.textBetween(from, to, "\n", "\n");
              // 줄을 넘는 선택은 묶지 않고 평소처럼 바꾼다.
              if (!selected.includes("\n")) {
                const tr = state.tr.insertText(`${text}${selected}${closer}`, from, to);
                view.dispatch(tr.setSelection(TextSelection.create(tr.doc, from + 1, from + 1 + selected.length)));
                return true;
              }
            }
            if (!storage.enabled) return false;
            const before = view.state.doc.textBetween(Math.max(from - 2, 0), from, "\n", "\n");
            const atStart = view.state.doc.resolve(from).parentOffset === 0;
            if (text === '"' || text === "'") {
              view.dispatch(view.state.tr.insertText(quoteFor(text, atStart ? undefined : before.at(-1)), from, to));
              return true;
            }
            if (text === "." && before === "..") {
              view.dispatch(view.state.tr.insertText("…", from - 2, to));
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
