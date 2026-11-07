import { docFromText } from "@raon/contracts";
import { Editor } from "@tiptap/core";
import { editorExtensions } from "./extensions";
import {
  applyEdits,
  createNoteMatcher,
  findNoteMatches,
  findRanges,
  findSymbolEdits,
  noteIdAtCursor,
  noteLinkKey,
  type SearchState,
  searchKey,
} from "./writing-extensions";

const make = (text: string) => new Editor({ extensions: editorExtensions, content: docFromText(text) });

describe("findRanges", () => {
  it("단락마다 찾고 위치가 실제 글자와 맞으며 대소문자를 가리지 않는다", () => {
    const { state } = make("등대와 등대\n\nRaon raon");
    expect(findRanges(state.doc, "등대").map(({ from, to }) => state.doc.textBetween(from, to))).toEqual([
      "등대",
      "등대",
    ]);
    expect(findRanges(state.doc, "RAON")).toHaveLength(2);
  });

  it("서식이 나뉜 곳에 걸친 글자를 찾고, 줄바꿈 뒤 위치도 맞으며 단락을 넘지 않는다", () => {
    const editor = make("앞");
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "등", marks: [{ type: "bold" }] },
            { type: "text", text: "대" },
            { type: "hardBreak" },
            { type: "text", text: "바다" },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "다음" }] },
      ],
    });
    const { doc } = editor.state;
    expect(findRanges(doc, "등대")).toHaveLength(1);
    const [sea] = findRanges(doc, "바다");
    expect(sea && doc.textBetween(sea.from, sea.to)).toBe("바다");
    expect(findRanges(doc, "바다다음")).toHaveLength(0);
  });

  it("빈 검색어는 찾지 않는다", () => {
    expect(findRanges(make("가나").state.doc, "")).toEqual([]);
  });
});

describe("findSymbolEdits", () => {
  it("곧은 따옴표를 여닫아 바꾸고 점 세 개를 줄임표로 바꾼다", () => {
    const editor = make("\"가자...\" 그가 말했다.\n\n'갈까'");
    const { state, view } = editor;
    view.dispatch(applyEdits(state.tr, findSymbolEdits(state.doc)));
    expect(editor.getText()).toContain("“가자…” 그가 말했다.");
    expect(editor.getText()).toContain("‘갈까’");
  });

  it("바꿀 곳이 없으면 비어 있다", () => {
    expect(findSymbolEdits(make("“이미 표준입니다.”").state.doc)).toEqual([]);
  });
});

describe("searchKey", () => {
  it("검색 표시는 문서를 바꾸지 않는다", () => {
    const editor = make("등대");
    const before = editor.getJSON();
    const meta: SearchState = { query: "등대", current: null };
    editor.view.dispatch(editor.state.tr.setMeta(searchKey, meta));
    expect(searchKey.getState(editor.state)).toEqual(meta);
    expect(editor.getJSON()).toEqual(before);
  });
});

describe("설정 이름 표시", () => {
  const notes = [
    { id: "n1", title: "이안", aliases: ["등대지기", "A"] },
    { id: "n2", title: "이안 왕자", aliases: ["c++ (코드)", "별-바다"] },
    { id: "n3", title: "소금 사막", aliases: ["이안"] },
  ];
  const matcher = createNoteMatcher(notes);
  const textDoc = (...paragraphs: string[]) => {
    const editor = new Editor({
      extensions: [...editorExtensions],
      content: {
        type: "doc",
        content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
      },
    });
    return editor;
  };

  it("이름과 다른 이름을 찾고, 조사가 붙어도 찾으며, 대소문자를 가리지 않는다", () => {
    const editor = textDoc("이안은 등대지기였다.", "소금 사막에서");
    expect(findNoteMatches(editor.state.doc, matcher).map(({ from, to, noteId }) => [from, to, noteId])).toEqual([
      [1, 3, "n1"],
      [5, 9, "n1"],
      [14, 19, "n3"],
    ]);
    editor.destroy();
  });

  it("긴 이름을 먼저 찾고, 한 글자 이름은 찾지 않으며, 특수문자는 글자 그대로 찾는다", () => {
    const editor = textDoc("이안 왕자와 A, 그리고 C++ (코드), 별-바다");
    expect(findNoteMatches(editor.state.doc, matcher).map(({ noteId, from, to }) => [noteId, to - from])).toEqual([
      ["n2", 5],
      ["n2", 8],
      ["n2", 4],
    ]);
    editor.destroy();
  });

  it("이름이 없으면 찾지 않는다", () => {
    expect(createNoteMatcher([])).toBeNull();
    expect(createNoteMatcher([{ id: "n", title: "A", aliases: [] }])).toBeNull();
    const editor = textDoc("이안");
    expect(findNoteMatches(editor.state.doc, null)).toEqual([]);
    editor.destroy();
  });

  it("표시를 켜도 문서와 실행 취소 기록에 남지 않고, 입력하면 다시 찾으며, 커서의 문서를 알려 준다", () => {
    const editor = textDoc("이안이 왔다.");
    const before = editor.getJSON();
    editor.view.dispatch(editor.state.tr.setMeta(noteLinkKey, matcher).setMeta("addToHistory", false));
    expect(editor.getJSON()).toEqual(before);
    expect(editor.can().undo()).toBe(false);
    expect(editor.view.dom.querySelector(".note-link")?.textContent).toBe("이안");
    expect(editor.getHTML()).not.toContain("note-link");

    editor.commands.setTextSelection(2);
    expect(noteIdAtCursor(editor.state)).toBe("n1");
    editor.commands.setTextSelection(6);
    expect(noteIdAtCursor(editor.state)).toBeNull();

    editor.commands.insertContentAt(1, "등대지기 ");
    expect(editor.view.dom.querySelectorAll(".note-link")).toHaveLength(2);

    editor.view.dispatch(editor.state.tr.setMeta(noteLinkKey, null));
    expect(editor.view.dom.querySelector(".note-link")).toBeNull();
    editor.destroy();
  });
});
