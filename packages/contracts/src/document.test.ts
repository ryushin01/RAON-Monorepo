import {
  countChars,
  countCharsWithoutSymbols,
  countCharsWithSpaces,
  docFromText,
  docToText,
  EMPTY_DOC,
  episodeDocSchema,
} from "./document.js";

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

describe("docFromText", () => {
  it("빈 줄은 단락을 나누고 한 줄 바꿈은 줄바꿈 노드가 되며, 다시 글자로 돌아온다", () => {
    const text = "첫 줄\n둘째 줄\n\n다음 단락";
    const doc = docFromText(text);
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "첫 줄" }, { type: "hardBreak" }, { type: "text", text: "둘째 줄" }],
    });
    expect(episodeDocSchema.safeParse(doc).success).toBe(true);
    expect(docToText(doc)).toBe(text);
    expect(countCharsWithSpaces(doc)).toBe(12);
  });

  it("윈도 줄바꿈도 같게 다룬다", () => {
    expect(docToText(docFromText("가\r\n나\r\n\r\n다"))).toBe("가\n나\n\n다");
  });
});

describe("docToText", () => {
  it("단락과 줄바꿈, 인용문의 글자를 뽑고 구분선과 빈 단락은 뺀다", () => {
    expect(
      docToText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "첫" }, { type: "hardBreak" }, { type: "text", text: "줄" }],
          },
          { type: "horizontalRule" },
          { type: "paragraph" },
          { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "인용" }] }] },
        ],
      }),
    ).toBe("첫\n줄\n\n인용");
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

describe("countCharsWithoutSymbols", () => {
  it("공백과 문장 부호, 기호를 빼고 숫자와 글자만 센다", () => {
    expect(countCharsWithoutSymbols(docFromText("“안녕, 이안!” 3번… ★"))).toBe(6);
    expect(countCharsWithoutSymbols(docFromText("A+B=2"))).toBe(3);
  });

  it("이모지를 이루는 연결 문자와 변형 선택자도 뺀다", () => {
    expect(countCharsWithoutSymbols(docFromText("가❤️나"))).toBe(2);
    expect(countCharsWithoutSymbols(docFromText("가👩‍💻나"))).toBe(2);
  });
});
