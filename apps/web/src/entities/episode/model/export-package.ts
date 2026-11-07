import type { EpisodeBlock, EpisodeInline } from "@raon/contracts";
import { createZip } from "@/shared/lib";
import {
  blockHtml,
  type ExportEpisode,
  type ExportFormat,
  escapeHtml,
  heading,
  NOTE_LABEL,
  renderEpisodeExport,
  renderWorkExport,
} from "./export";

interface ExportWork {
  title: string;
  episodes: ExportEpisode[];
}

/** XML에 쓸 수 없는 제어 문자를 빼고 이스케이프한다. 붙여 넣은 원고에 섞여 있으면 파일이 열리지 않는다. */
const stripInvalidXml = (text: string) => text.replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "");
const xml = (text: string) => escapeHtml(stripInvalidXml(text)).replace(/'/g, "&apos;");

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// --- DOCX ---

function docxRun(node: EpisodeInline): string {
  if (node.type === "hardBreak") return "<w:r><w:br/></w:r>";
  const marks = (node.marks ?? []).map((mark) => (mark.type === "bold" ? "<w:b/>" : "<w:i/>")).join("");
  return `<w:r>${marks && `<w:rPr>${marks}</w:rPr>`}<w:t xml:space="preserve">${xml(node.text)}</w:t></w:r>`;
}

function docxBlock(block: EpisodeBlock, quoted = false): string {
  if (block.type === "horizontalRule")
    return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>* * *</w:t></w:r></w:p>';
  if (block.type === "blockquote") return block.content.map((child) => docxBlock(child, true)).join("");
  const properties = quoted ? '<w:pPr><w:pStyle w:val="Quote"/></w:pPr>' : "";
  return `<w:p>${properties}${(block.content ?? []).map(docxRun).join("")}</w:p>`;
}

const docxHeading = (text: string, level: 1 | 2, breakBefore = false) =>
  `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/>${breakBefore ? "<w:pageBreakBefore/>" : ""}</w:pPr><w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;

const docxPlain = (text: string) =>
  text
    .split("\n")
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`)
    .join("");

function docxEpisode(episode: ExportEpisode, level: 1 | 2, breakBefore: boolean) {
  const note = episode.authorNote ? docxHeading(NOTE_LABEL, 2) + docxPlain(episode.authorNote) : "";
  return `${docxHeading(heading(episode), level, breakBefore)}${episode.content.content.map((block) => docxBlock(block)).join("")}${note}`;
}

const DOCX_STYLES = `${XML_HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Batang" w:hAnsi="Batang" w:eastAsia="Batang"/><w:sz w:val="22"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="200" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style></w:styles>`;

function createDocx(body: string) {
  return createZip([
    {
      name: "[Content_Types].xml",
      text: `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      text: `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    {
      name: "word/_rels/document.xml.rels",
      text: `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "word/styles.xml", text: DOCX_STYLES },
    {
      name: "word/document.xml",
      text: `${XML_HEAD}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`,
    },
  ]);
}

// --- EPUB ---

/** HTML 내보내기의 출력을 XHTML로 맞춘다. 글자는 이스케이프되어 있어 태그만 바뀐다. */
const toXhtml = (html: string) => stripInvalidXml(html).replace(/<br>/g, "<br/>").replace(/<hr>/g, "<hr/>");

const xhtmlPage = (title: string, body: string, extraNamespace = "") =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml"${extraNamespace} xml:lang="ko" lang="ko"><head><title>${xml(title)}</title></head><body>${body}</body></html>`;

function epubChapter(episode: ExportEpisode) {
  const note = episode.authorNote
    ? `<h2>${NOTE_LABEL}</h2><p>${xml(episode.authorNote).replace(/\n/g, "<br/>")}</p>`
    : "";
  const blocks = toXhtml(episode.content.content.map(blockHtml).join(""));
  return xhtmlPage(heading(episode), `<h1>${xml(heading(episode))}</h1>${blocks}${note}`);
}

function createEpub(work: ExportWork, now: Date) {
  const chapters = work.episodes.map((episode, index) => ({
    id: `chapter${index + 1}`,
    file: `chapter${index + 1}.xhtml`,
    episode,
  }));
  // 초 단위까지만 쓰는 것이 EPUB 3의 dcterms:modified 형식이다.
  const modified = `${now.toISOString().slice(0, 19)}Z`;
  const identifier = `urn:raon:${now.getTime()}`;
  const manifest = chapters
    .map(({ id, file }) => `<item id="${id}" href="${file}" media-type="application/xhtml+xml"/>`)
    .join("");
  const spine = chapters.map(({ id }) => `<itemref idref="${id}"/>`).join("");
  const toc = chapters.map(({ file, episode }) => `<li><a href="${file}">${xml(heading(episode))}</a></li>`).join("");
  return createZip([
    // 표준이 맨 앞에 압축 없이 두도록 정한 파일이다.
    { name: "mimetype", text: "application/epub+zip" },
    {
      name: "META-INF/container.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    },
    {
      name: "OEBPS/content.opf",
      text: `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="ko"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${identifier}</dc:identifier><dc:title>${xml(work.title)}</dc:title><dc:language>ko</dc:language><meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest}</manifest><spine>${spine}</spine></package>`,
    },
    {
      name: "OEBPS/nav.xhtml",
      text: xhtmlPage(
        work.title,
        `<nav epub:type="toc" id="toc"><h1>목차</h1><ol>${toc}</ol></nav>`,
        ' xmlns:epub="http://www.idpf.org/2007/ops"',
      ),
    },
    ...chapters.map(({ file, episode }) => ({ name: `OEBPS/${file}`, text: epubChapter(episode) })),
  ]);
}

// --- 진입점 ---

export type ExportOutput = string | Uint8Array<ArrayBuffer>;

export function renderEpisodeFile(format: ExportFormat, episode: ExportEpisode, now = new Date()): ExportOutput {
  if (format === "docx") return createDocx(docxEpisode(episode, 1, false));
  if (format === "epub") return createEpub({ title: heading(episode), episodes: [episode] }, now);
  return renderEpisodeExport(format, episode);
}

export function renderWorkFile(format: ExportFormat, work: ExportWork, now = new Date()): ExportOutput {
  if (format === "docx") {
    const title = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${xml(work.title)}</w:t></w:r></w:p>`;
    return createDocx(title + work.episodes.map((episode, index) => docxEpisode(episode, 2, index > 0)).join(""));
  }
  if (format === "epub") return createEpub(work, now);
  return renderWorkExport(format, work);
}
