import { docFromText, episodeDocSchema } from "@raon/contracts";
import { getSchema } from "@tiptap/core";
import { editorExtensions } from "./extensions";

describe("editorExtensions", () => {
  const schema = getSchema(editorExtensions);

  it("계약에서 허용한 노드와 마크만 켠다", () => {
    expect(Object.keys(schema.marks).sort()).toEqual(["bold", "italic"]);
    expect(Object.keys(schema.nodes).sort()).toEqual([
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
});
