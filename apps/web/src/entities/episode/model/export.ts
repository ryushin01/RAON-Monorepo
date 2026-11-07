import { docToText, type EpisodeBlock, type EpisodeDoc, type EpisodeInline } from "@raon/contracts";

export const EXPORT_FORMATS = [
  { value: "txt", label: "TXT" },
  { value: "md", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "docx", label: "DOCX" },
  { value: "epub", label: "EPUB" },
] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number]["value"];
/** 글자로 바로 만드는 형식. DOCX와 EPUB은 export-package.ts가 ZIP으로 묶는다. */
type TextExportFormat = Extract<ExportFormat, "txt" | "md" | "html">;

const MIME: Record<ExportFormat, string> = {
  txt: "text/plain;charset=utf-8",
  md: "text/markdown;charset=utf-8",
  html: "text/html;charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  epub: "application/epub+zip",
};
export const exportMimeType = (format: ExportFormat) => MIME[format];

export interface ExportEpisode {
  number: number;
  title: string;
  content: EpisodeDoc;
  authorNote: string | null;
}

/** 운영체제가 파일 이름에 쓸 수 없는 글자를 바꾸고 너무 길면 자른다. */
export function exportFileName(name: string, format: ExportFormat): string {
  const safe = name
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, "_")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80);
  return `${safe || "원고"}.${format}`;
}

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inlineHtml(node: EpisodeInline): string {
  if (node.type === "hardBreak") return "<br>";
  let html = escapeHtml(node.text);
  for (const mark of node.marks ?? []) {
    html = mark.type === "bold" ? `<strong>${html}</strong>` : `<em>${html}</em>`;
  }
  return html;
}

export function blockHtml(block: EpisodeBlock): string {
  switch (block.type) {
    case "authorComment":
      return "";
    case "horizontalRule":
      return "<hr>";
    case "blockquote":
      return `<blockquote>${block.content.map(blockHtml).join("")}</blockquote>`;
    case "paragraph":
      return `<p>${(block.content ?? []).map(inlineHtml).join("")}</p>`;
  }
}

/** 줄 안의 어디서든 문법이 되는 글자. */
const escapeInlineMarkdown = (text: string) => text.replace(/([\\`*_[\]<>&])/g, "\\$1");

/** 줄 맨 앞에서만 문법이 되는 글자. 서식이 있는 조각을 이은 뒤 전체 줄을 기준으로 판단한다. */
const escapeLineStart = (line: string) =>
  line
    .replace(/^(\s*)(#{1,6}(?=\s|$)|[+-](?=\s)|\d+[.)](?=\s))/, (_, space: string, mark: string) =>
      /^\d/.test(mark) ? `${space}${mark.slice(0, -1)}\\${mark.slice(-1)}` : `${space}\\${mark}`,
    )
    // 구분선(---)과 제목 밑줄(===, ---)로 읽히는 줄
    .replace(/^(\s*)([-=])(?=[-=\s]*$)/, "$1\\$2");

const escapeMarkdownLines = (text: string) => text.split("\n").map(escapeLineStart).join("\n");

/** 일반 글자 전체를 이스케이프한다. 줄바꿈은 그대로 보이도록 두 칸 띄운다. */
const escapeMarkdown = (text: string) => escapeMarkdownLines(escapeInlineMarkdown(text)).replace(/\n/g, "  \n");

/** 제목은 줄 끝의 #도 닫는 표시로 읽힌다. */
const escapeMarkdownHeading = (text: string) => escapeInlineMarkdown(text).replace(/(#+)(\s*)$/, "\\$1$2");

function inlineMarkdown(node: EpisodeInline): string {
  if (node.type === "hardBreak") return "  \n";
  let text = escapeInlineMarkdown(node.text);
  for (const mark of node.marks ?? []) text = mark.type === "bold" ? `**${text}**` : `*${text}*`;
  return text;
}

function blockMarkdown(block: EpisodeBlock): string {
  switch (block.type) {
    case "authorComment":
      return "";
    case "horizontalRule":
      return "---";
    case "blockquote":
      return block.content
        .map(blockMarkdown)
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "paragraph":
      return escapeMarkdownLines((block.content ?? []).map(inlineMarkdown).join(""));
  }
}

const docMarkdown = (doc: EpisodeDoc) => doc.content.map(blockMarkdown).filter(Boolean).join("\n\n");

export const heading = ({ number, title }: ExportEpisode) => `${number}화. ${title}`;
export const NOTE_LABEL = "작가의 말";

function episodeBody(format: TextExportFormat, episode: ExportEpisode, level: 1 | 2): string {
  const { content, authorNote } = episode;
  if (format === "txt") {
    const note = authorNote ? `\n\n[${NOTE_LABEL}]\n${authorNote}` : "";
    return `${heading(episode)}\n\n${docToText(content)}${note}`;
  }
  if (format === "md") {
    const note = authorNote ? `\n\n${"#".repeat(level + 1)} ${NOTE_LABEL}\n\n${escapeMarkdown(authorNote)}` : "";
    return `${"#".repeat(level)} ${escapeMarkdownHeading(heading(episode))}\n\n${docMarkdown(content)}${note}`;
  }
  const note = authorNote
    ? `<h${level + 1}>${NOTE_LABEL}</h${level + 1}><p>${escapeHtml(authorNote).replace(/\n/g, "<br>")}</p>`
    : "";
  return `<article><h${level}>${escapeHtml(heading(episode))}</h${level}>${content.content.map(blockHtml).join("")}${note}</article>`;
}

const htmlDocument = (title: string, body: string) =>
  `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;

export function renderEpisodeExport(format: TextExportFormat, episode: ExportEpisode): string {
  const body = episodeBody(format, episode, 1);
  return format === "html" ? htmlDocument(heading(episode), body) : `${body}\n`;
}

export function renderWorkExport(format: TextExportFormat, work: { title: string; episodes: ExportEpisode[] }): string {
  const bodies = work.episodes.map((episode) => episodeBody(format, episode, 2));
  if (format === "txt") return `${work.title}\n\n\n${bodies.join("\n\n\n")}\n`;
  if (format === "md") return `# ${escapeMarkdownHeading(work.title)}\n\n${bodies.join("\n\n")}\n`;
  return htmlDocument(work.title, `<h1>${escapeHtml(work.title)}</h1>\n${bodies.join("\n")}`);
}
