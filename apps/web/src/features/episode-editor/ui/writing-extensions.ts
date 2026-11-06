import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

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
    smartInput: { enabled: boolean };
  }
}

/** 입력하는 곧은 따옴표와 점 세 개를 표준 기호로 바꾼다. 실행 취소로 바로 되돌릴 수 있다. */
export const SmartInput = Extension.create({
  name: "smartInput",
  addStorage() {
    return { enabled: true };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: new PluginKey("raonSmartInput"),
        props: {
          handleTextInput(view, from, to, text) {
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
