import { docFromText, episodeDocSchema } from "@raon/contracts";
import { Editor, getSchema } from "@tiptap/core";
import { editorExtensions } from "./extensions";

describe("editorExtensions", () => {
  const schema = getSchema(editorExtensions);

  it("계약에서 허용한 노드와 마크만 켠다", () => {
    expect(Object.keys(schema.marks).sort()).toEqual(["bold", "italic"]);
    expect(Object.keys(schema.nodes).sort()).toEqual([
      "authorComment",
      "blockquote",
      "doc",
      "hardBreak",
      "horizontalRule",
      "paragraph",
      "text",
    ]);
  });

  it("인용문 안에 인용문을 넣을 수 없다", () => {
    expect(schema.nodes.blockquote?.contentMatch.matchType(schema.nodes.blockquote)).toBeFalsy();
  });

  it("에디터 문서가 계약 스키마를 통과한다", () => {
    const node = schema.nodeFromJSON(docFromText("첫 문단\n\n둘째 문단"));
    expect(episodeDocSchema.safeParse(node.toJSON()).success).toBe(true);
  });

  it("줄바꿈이 낀 범위에 서식을 입혀도 계약 스키마를 통과한다", () => {
    const editor = new Editor({ extensions: editorExtensions, content: docFromText("앞") });
    editor.commands.focus("end");
    editor.commands.setHardBreak();
    editor.commands.insertContent("뒤");
    editor.commands.selectAll();
    editor.commands.toggleBold();
    editor.commands.toggleItalic();

    const doc = editor.getJSON();
    expect(JSON.stringify(doc)).toContain('"hardBreak","marks"');
    expect(episodeDocSchema.safeParse(doc).success).toBe(true);
    editor.destroy();
  });

  describe("서식 조합이 모두 저장 가능한 문서를 만든다", () => {
    type Run = (editor: Editor) => void;
    const steps: Record<string, Run> = {
      굵게: (e) => e.commands.toggleBold(),
      기울임: (e) => e.commands.toggleItalic(),
      인용: (e) => e.commands.toggleBlockquote(),
      구분선: (e) => e.commands.setHorizontalRule(),
      줄바꿈: (e) => e.commands.setHardBreak(),
      "실행 취소": (e) => e.commands.undo(),
      "다시 실행": (e) => e.commands.redo(),
      "전체 선택": (e) => e.commands.selectAll(),
      글자: (e) => e.commands.insertContent("글"),
      "문단 나누기": (e) => e.commands.splitBlock(),
    };
    const names = Object.keys(steps);
    const pairs = names.flatMap((a) => names.map((b) => [a, b] as const));

    it.each(pairs)("%s 다음 %s", (first, second) => {
      const editor = new Editor({ extensions: editorExtensions, content: docFromText("첫 문단\n\n둘째 문단") });
      editor.commands.setHardBreak();
      for (const step of ["전체 선택", first, second, "전체 선택", "굵게"]) steps[step]?.(editor);
      const result = episodeDocSchema.safeParse(editor.getJSON());
      expect(result.error?.issues).toBeUndefined();
      editor.destroy();
    });
  });
});
