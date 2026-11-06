import { docFromText } from "@raon/contracts";
import { Editor } from "@tiptap/core";
import { editorExtensions } from "./extensions";
import { applyEdits, findRanges, findSymbolEdits, type SearchState, searchKey } from "./writing-extensions";

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
