import { docFromText, type EpisodeDoc } from "@raon/contracts";
import { renderEpisodeFile, renderWorkFile } from "./export-package";

const content: EpisodeDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "굵은 <글자> & ", marks: [{ type: "bold" }] },
        { type: "hardBreak" },
        { type: "text", text: "기울임", marks: [{ type: "italic" }] },
      ],
    },
    { type: "horizontalRule" },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "인용" }] }] },
  ],
};
const episode = { number: 2, title: "소금 <1>", content, authorNote: "고맙\n습니다" };

/** 압축하지 않는 ZIP이라 항목을 글자로 바로 읽을 수 있다. */
function entries(output: string | Uint8Array) {
  const zip = output as Uint8Array;
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const decoder = new TextDecoder();
  const end = zip.length - 22;
  let offset = view.getUint32(end + 16, true);
  const result = new Map<string, string>();
  for (let index = 0; index < view.getUint16(end + 10, true); index += 1) {
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const local = view.getUint32(offset + 42, true);
    const start = local + 30 + view.getUint16(local + 26, true);
    result.set(
      decoder.decode(zip.subarray(offset + 46, offset + 46 + nameLength)),
      decoder.decode(zip.subarray(start, start + size)),
    );
    offset += 46 + nameLength;
  }
  return result;
}

const parsesAsXml = (text: string) =>
  expect(new DOMParser().parseFromString(text, "application/xml").querySelector("parsererror")).toBeNull();

describe("DOCX", () => {
  it("필요한 부품을 담고 서식, 인용, 작가의 말을 옮기며 글자를 이스케이프한다", () => {
    const files = entries(renderEpisodeFile("docx", episode));
    for (const name of ["[Content_Types].xml", "_rels/.rels", "word/_rels/document.xml.rels", "word/styles.xml"]) {
      expect(files.has(name)).toBe(true);
    }
    const document = files.get("word/document.xml") as string;
    parsesAsXml(document);
    parsesAsXml(files.get("word/styles.xml") as string);
    expect(document).toContain("굵은 &lt;글자&gt; &amp; ");
    expect(document).toContain("<w:rPr><w:b/></w:rPr>");
    expect(document).toContain("<w:rPr><w:i/></w:rPr>");
    expect(document).toContain("<w:br/>");
    expect(document).toContain('w:val="Quote"');
    expect(document).toContain("* * *");
    expect(document).toContain("작가의 말");
    expect(document).toContain("2화. 소금 &lt;1&gt;");
  });

  it("XML에 쓸 수 없는 제어 문자를 빼서 파일이 깨지지 않는다", () => {
    const files = entries(renderEpisodeFile("docx", { ...episode, content: docFromText("앞\u0001뒤") }));
    parsesAsXml(files.get("word/document.xml") as string);
    expect(files.get("word/document.xml")).toContain("앞뒤");
  });

  it("작품은 제목을 두고 둘째 회차부터 새 쪽에서 시작한다", () => {
    const files = entries(
      renderWorkFile("docx", { title: "등대 & 소금", episodes: [episode, { ...episode, number: 3 }] }),
    );
    const document = files.get("word/document.xml") as string;
    parsesAsXml(document);
    expect(document).toContain('w:val="Title"');
    expect(document.match(/<w:pageBreakBefore\/>/g)).toHaveLength(1);
  });
});

describe("EPUB", () => {
  const now = new Date("2026-11-07T01:02:03.456Z");
  const files = entries(
    renderWorkFile("epub", { title: "등대 & 소금", episodes: [episode, { ...episode, number: 3 }] }, now),
  );

  it("mimetype을 맨 앞에 압축 없이 두고, 표준 부품을 담는다", () => {
    expect([...files.keys()][0]).toBe("mimetype");
    expect(files.get("mimetype")).toBe("application/epub+zip");
    expect(files.get("META-INF/container.xml")).toContain("OEBPS/content.opf");
  });

  it("메타데이터와 목차, 회차를 잇고 모두 올바른 XML이다", () => {
    const opf = files.get("OEBPS/content.opf") as string;
    expect(opf).toContain("<dc:title>등대 &amp; 소금</dc:title>");
    expect(opf).toContain("<dc:language>ko</dc:language>");
    expect(opf).toContain('<meta property="dcterms:modified">2026-11-07T01:02:03Z</meta>');
    expect(opf).toContain('<itemref idref="chapter2"/>');
    for (const name of ["OEBPS/content.opf", "OEBPS/nav.xhtml", "OEBPS/chapter1.xhtml", "OEBPS/chapter2.xhtml"]) {
      parsesAsXml(files.get(name) as string);
    }
    expect(files.get("OEBPS/nav.xhtml")).toContain('epub:type="toc"');
  });

  it("XML에 쓸 수 없는 제어 문자를 본문에서도 뺀다", () => {
    const broken = entries(renderEpisodeFile("epub", { ...episode, content: docFromText("앞\u0001뒤") }, now));
    const chapter = broken.get("OEBPS/chapter1.xhtml") as string;
    parsesAsXml(chapter);
    expect(chapter).toContain("앞뒤");
  });

  it("본문을 XHTML로 옮기고 글자를 이스케이프한다", () => {
    const chapter = files.get("OEBPS/chapter1.xhtml") as string;
    expect(chapter).toContain("<br/>");
    expect(chapter).toContain("<hr/>");
    expect(chapter).not.toContain("<br>");
    expect(chapter).toContain("&lt;글자&gt;");
    expect(chapter).toContain("고맙<br/>습니다");
  });
});

it("글자 형식은 그대로 글자로 만든다", () => {
  expect(typeof renderEpisodeFile("txt", episode)).toBe("string");
  expect(typeof renderWorkFile("html", { title: "작품", episodes: [episode] })).toBe("string");
});
