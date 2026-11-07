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

describe("입력 보조", () => {
  const typeText = (editor: Editor, text: string) => {
    const { view } = editor;
    for (const char of text) {
      const { from, to } = view.state.selection;
      const handled = view.someProp("handleTextInput", (handler) =>
        handler(view, from, to, char, () => view.state.tr.insertText(char, from, to)),
      );
      if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
    }
  };
  const start = () => {
    const editor = make("");
    editor.commands.setTextSelection(1);
    return editor;
  };

  it("여는 괄호에 닫는 괄호를 넣고 그 사이에 커서를 두며, 닫는 괄호는 덧쓴다", () => {
    const editor = start();
    typeText(editor, "(가");
    expect(editor.getText()).toBe("(가)");
    typeText(editor, ")나");
    expect(editor.getText()).toBe("(가)나");
    editor.destroy();
  });

  it("고른 글자를 괄호로 묶고, 끄면 그대로 쓴다", () => {
    const editor = make("등대");
    editor.commands.setTextSelection({ from: 1, to: 3 });
    typeText(editor, "「");
    expect(editor.getText()).toBe("「등대」");
    editor.destroy();

    const off = start();
    off.storage.smartInput.autoBracket = false;
    typeText(off, "(가)");
    expect(off.getText()).toBe("(가)");
    off.destroy();
  });

  it("사용자 규칙으로 바꾸고, 실행 취소로 되돌리며, 규칙이 없으면 그대로 둔다", () => {
    const editor = start();
    typeText(editor, "가->");
    expect(editor.getText()).toBe("가->");
    editor.storage.smartInput.rules = [{ from: "->", to: "→" }];
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    typeText(editor, "나->");
    expect(editor.getText()).toBe("가->나→");
    editor.commands.undo();
    expect(editor.getText()).not.toContain("→");
    editor.destroy();
  });

  it("여러 글자가 한 번에 들어와도 앞 글자를 남기고 뒤 글자를 건드리지 않는다", () => {
    const editor = make("a-b");
    editor.storage.smartInput.rules = [{ from: "->", to: "→" }];
    editor.commands.setTextSelection(3);
    const { view } = editor;
    view.someProp("handleTextInput", (handler) =>
      handler(view, 3, 3, "x->", () => view.state.tr.insertText("x->", 3, 3)),
    );
    expect(editor.getText()).toBe("a-x→b");
    editor.destroy();
  });

  it("여는 괄호로 끝나는 사용자 규칙을 자동 괄호보다 먼저 적용한다", () => {
    const editor = start();
    editor.storage.smartInput.rules = [{ from: "@(", to: "○" }];
    typeText(editor, "@(");
    expect(editor.getText()).toBe("○");
    editor.destroy();
  });
});
