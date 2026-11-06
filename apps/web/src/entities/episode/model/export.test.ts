import { docFromText, type EpisodeDoc } from "@raon/contracts";
import { exportFileName, renderEpisodeExport, renderWorkExport } from "./export";

const content: EpisodeDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "굵은", marks: [{ type: "bold" }] },
        { type: "text", text: " 글자" },
        { type: "hardBreak" },
        { type: "text", text: "기울임", marks: [{ type: "italic" }] },
      ],
    },
    { type: "horizontalRule" },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "인용" }] }] },
  ],
};
const episode = { number: 2, title: "소금", content, authorNote: "고맙습니다" };

describe("renderEpisodeExport", () => {
  it("TXT는 글자만 남기고 작가의 말을 덧붙인다", () => {
    expect(renderEpisodeExport("txt", episode)).toBe(
      "2화. 소금\n\n굵은 글자\n기울임\n\n인용\n\n[작가의 말]\n고맙습니다\n",
    );
  });

  it("Markdown은 서식과 줄바꿈, 구분선, 인용을 옮긴다", () => {
    const text = renderEpisodeExport("md", episode);
    expect(text).toContain("# 2화. 소금");
    expect(text).toContain("**굵은** 글자  \n*기울임*");
    expect(text).toContain("---");
    expect(text).toContain("> 인용");
    expect(text).toContain("## 작가의 말");
  });

  it("HTML은 문서 구조를 갖추고 언어를 밝힌다", () => {
    const html = renderEpisodeExport("html", episode);
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain("<title>2화. 소금</title>");
    expect(html).toContain("<strong>굵은</strong> 글자<br><em>기울임</em>");
    expect(html).toContain("<blockquote><p>인용</p></blockquote>");
  });

  it("HTML은 제목, 본문, 작가의 말의 글자를 이스케이프한다", () => {
    const html = renderEpisodeExport("html", {
      number: 1,
      title: "<script>제목</script>",
      content: docFromText('<img src=x onerror="a">&'),
      authorNote: "<b>말</b>",
    });
    expect(html).not.toMatch(/<script|<img|<b>/);
    expect(html).toContain("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;");
  });

  it("Markdown은 본문의 문법 글자가 서식으로 읽히지 않게 한다", () => {
    const text = renderEpisodeExport("md", {
      number: 1,
      title: "제목",
      content: docFromText("*별표* [링크](x) <b>\n\n# 제목 아님\n\n- 목록 아님"),
      authorNote: null,
    });
    expect(text).toContain("\\*별표\\* \\[링크\\](x) \\<b\\>");
    expect(text).toContain("\\# 제목 아님");
    expect(text).toContain("\\- 목록 아님");
  });
});

describe("Markdown 이스케이프", () => {
  const paragraph = (...content: EpisodeDoc["content"]) =>
    renderEpisodeExport("md", { number: 1, title: "제목", content: { type: "doc", content }, authorNote: null });
  const text = (value: string) => paragraph({ type: "paragraph", content: [{ type: "text", text: value }] });

  it.each([
    ["1) 항목", "1\\) 항목"],
    ["2. 항목", "2\\. 항목"],
    ["---", "\\---"],
    ["===", "\\==="],
    ["&copy;", "\\&copy;"],
    ["#", "\\#"],
    ["# 제목 아님", "\\# 제목 아님"],
    ["+ 목록", "\\+ 목록"],
  ])("%s를 글자로 남긴다", (input, expected) => {
    expect(text(input)).toContain(`\n${expected}`);
  });

  it("줄 중간의 기호는 그대로 둔다", () => {
    expect(text("가 - 나 1. 다 # 라")).toContain("가 - 나 1. 다 # 라");
  });

  it("줄바꿈 뒤의 줄도 줄 맨 앞으로 판단하고, 구분선 블록은 유지한다", () => {
    const output = paragraph(
      {
        type: "paragraph",
        content: [{ type: "text", text: "제목" }, { type: "hardBreak" }, { type: "text", text: "===" }],
      },
      { type: "horizontalRule" },
    );
    expect(output).toContain("제목  \n\\===");
    expect(output).toMatch(/\n---\n?/);
  });

  it("서식 조각 뒤에서 시작하는 글자는 줄 맨 앞이 아니다", () => {
    const output = paragraph({
      type: "paragraph",
      content: [
        { type: "text", text: "굵게", marks: [{ type: "bold" }] },
        { type: "text", text: "- 이어짐" },
      ],
    });
    expect(output).toContain("**굵게**- 이어짐");
  });

  it("서식 조각에서 줄이 시작해도 뒤따르는 글자를 보호한다", () => {
    const output = paragraph({
      type: "paragraph",
      content: [{ type: "hardBreak" }, { type: "text", text: "- 목록" }],
    });
    expect(output).toContain("\\- 목록");
  });

  it("제목 끝의 #과 작가의 말의 줄바꿈을 보존한다", () => {
    const output = renderEpisodeExport("md", {
      number: 1,
      title: "샵 #",
      content: docFromText("본문"),
      authorNote: "첫 줄\n- 둘째 줄",
    });
    expect(output).toContain("# 1화. 샵 \\#");
    expect(output).toContain("첫 줄  \n\\- 둘째 줄");
  });
});

describe("renderWorkExport", () => {
  const work = {
    title: "작품 <1>",
    episodes: [
      { ...episode, authorNote: null },
      { ...episode, number: 3, authorNote: null },
    ],
  };

  it("작품 제목 아래에 회차를 순서대로 잇는다", () => {
    const text = renderWorkExport("txt", work);
    expect(text.startsWith("작품 <1>\n")).toBe(true);
    expect(text.indexOf("2화. 소금")).toBeLessThan(text.indexOf("3화. 소금"));
    expect(renderWorkExport("md", work)).toContain("## 3화. 소금");
    const html = renderWorkExport("html", work);
    expect(html).toContain("<h1>작품 &lt;1&gt;</h1>");
    expect(html).toContain("<h2>3화. 소금</h2>");
  });
});

describe("exportFileName", () => {
  it("쓸 수 없는 글자를 바꾸고 길이를 제한하며, 비면 기본 이름을 쓴다", () => {
    expect(exportFileName('가/나:다*"라', "txt")).toBe("가_나_다__라.txt");
    expect(exportFileName("가\\나\n다", "txt")).toBe("가_나_다.txt");
    expect(exportFileName("..숨김", "md")).toBe("숨김.md");
    expect(exportFileName("  ", "html")).toBe("원고.html");
    expect(exportFileName("가".repeat(200), "txt")).toHaveLength(84);
  });
});
