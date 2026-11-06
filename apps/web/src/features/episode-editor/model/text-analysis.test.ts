import { docFromText } from "@raon/contracts";
import { analyzeParagraphs, classifyParagraph, findRepetitions } from "./text-analysis";

describe("classifyParagraph", () => {
  it.each([
    ["“가자.”", "dialogue"],
    ['"가자."', "dialogue"],
    ["「가자.」", "dialogue"],
    ["‘갈까.’", "monologue"],
    ["'갈까.'", "monologue"],
    ["그는 걸었다.", "description"],
  ] as const)("%s는 %s다", (text, kind) => {
    expect(classifyParagraph(text)).toBe(kind);
  });
});

describe("analyzeParagraphs", () => {
  it("단락 수와 글자 수를 종류별로 센다", () => {
    const stats = analyzeParagraphs(docFromText("“가자.”\n\n‘갈까.’\n\n그는 걸었다.\n\n밤이었다."));
    expect(stats.dialogue).toEqual({ paragraphs: 1, chars: 5 });
    expect(stats.monologue).toEqual({ paragraphs: 1, chars: 5 });
    expect(stats.description).toEqual({ paragraphs: 2, chars: 12 });
  });

  it("인용문 안의 단락도 세고 구분선과 빈 단락은 세지 않는다", () => {
    const stats = analyzeParagraphs({
      type: "doc",
      content: [
        { type: "horizontalRule" },
        { type: "paragraph" },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "“네.”" }] }] },
      ],
    });
    expect(stats.dialogue.paragraphs).toBe(1);
    expect(stats.description.paragraphs).toBe(0);
  });
});

describe("findRepetitions", () => {
  it("세 번 이상 나온 낱말과 끝맺음을 많은 순으로 고른다", () => {
    const { words, endings } = findRepetitions(
      docFromText("그는 등대를 보았다. 그는 바다를 보았다.\n\n“등대를 켜라.” 그는 등대를 보았다. 물결이 일었다."),
    );
    expect(words).toEqual([
      { text: "그는", count: 3 },
      { text: "등대를", count: 3 },
      { text: "보았다", count: 3 },
    ]);
    expect(words.some((word) => word.text === "바다를")).toBe(false);
    expect(endings[0]).toEqual({ text: "았다", count: 3 });
  });

  it("문장 부호를 떼고 세며 한 글자 낱말은 빼고, 개수를 제한한다", () => {
    const { words } = findRepetitions(docFromText("불, 불, 불. 파도. 파도, 파도!"));
    expect(words).toEqual([{ text: "파도", count: 3 }]);
    expect(findRepetitions(docFromText("가나 가나 가나 다라 다라 다라"), 1).words).toHaveLength(1);
  });
});
