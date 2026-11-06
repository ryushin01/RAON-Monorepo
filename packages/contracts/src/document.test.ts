import { countChars, countCharsWithSpaces, docFromText, EMPTY_DOC, episodeDocSchema } from "./document.js";

describe("episodeDocSchema", () => {
  it("에디터 문서를 받아들인다", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "첫 문장", marks: [{ type: "bold" }] }, { type: "hardBreak" }],
        },
        { type: "blockquote", content: [{ type: "paragraph" }] },
        { type: "horizontalRule" },
      ],
    };
    expect(episodeDocSchema.safeParse(doc).success).toBe(true);
  });

  it("서식이 입혀진 줄바꿈을 받아들인다", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "hardBreak", marks: [{ type: "bold" }] }] }],
    };
    expect(episodeDocSchema.safeParse(doc).success).toBe(true);
  });

  it.each([
    ["허용하지 않은 노드", { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] }],
    [
      "허용하지 않은 마크",
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "a", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
          },
        ],
      },
    ],
    ["알 수 없는 속성", { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "x" } }] }],
  ])("%s는 거부한다", (_, doc) => {
    expect(episodeDocSchema.safeParse(doc).success).toBe(false);
  });
});

describe("countCharsWithSpaces", () => {
  it("공백은 세고 문단 구분과 구분선은 세지 않는다", () => {
    const doc = docFromText("가 나\n\n다");
    expect(countCharsWithSpaces(doc)).toBe(4);
    expect(countChars(doc)).toBe(3);
    expect(countCharsWithSpaces({ type: "doc", content: [{ type: "horizontalRule" }] })).toBe(0);
  });

  it("인용문 안의 글자도 세고 줄바꿈은 세지 않는다", () => {
    const paragraph = {
      type: "paragraph" as const,
      content: [{ type: "text" as const, text: "가 나" }, { type: "hardBreak" as const }],
    };
    expect(countCharsWithSpaces({ type: "doc", content: [{ type: "blockquote", content: [paragraph] }] })).toBe(3);
  });

  it("빈 문서는 0이다", () => {
    expect(countCharsWithSpaces(EMPTY_DOC)).toBe(0);
  });
});

describe("countChars", () => {
  it("공백을 빼고 인용문까지 센다", () => {
    const doc = docFromText("가 나 다\n\n라마");
    expect(countChars(doc)).toBe(5);
    expect(countChars({ type: "doc", content: [{ type: "blockquote", content: doc.content as never }] })).toBe(5);
  });

  it("빈 문서는 0자다", () => {
    expect(countChars(EMPTY_DOC)).toBe(0);
  });
});
