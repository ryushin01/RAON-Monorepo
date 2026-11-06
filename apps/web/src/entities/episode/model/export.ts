import { docToText, type EpisodeBlock, type EpisodeDoc, type EpisodeInline } from "@raon/contracts";

export const EXPORT_FORMATS = [
  { value: "txt", label: "TXT" },
  { value: "md", label: "Markdown" },
  { value: "html", label: "HTML" },
] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number]["value"];

const MIME: Record<ExportFormat, string> = { txt: "text/plain", md: "text/markdown", html: "text/html" };
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

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inlineHtml(node: EpisodeInline): string {
  if (node.type === "hardBreak") return "<br>";
  let html = escapeHtml(node.text);
  for (const mark of node.marks ?? []) {
    html = mark.type === "bold" ? `<strong>${html}</strong>` : `<em>${html}</em>`;
  }
  return html;
}

function blockHtml(block: EpisodeBlock): string {
  switch (block.type) {
    case "horizontalRule":
      return "<hr>";
    case "blockquote":
      return `<blockquote>${block.content.map(blockHtml).join("")}</blockquote>`;
    case "paragraph":
      return `<p>${(block.content ?? []).map(inlineHtml).join("")}</p>`;
  }
}

/** 본문의 글자가 마크다운 문법으로 읽히지 않게 한다. */
const escapeMarkdown = (text: string) =>
  text.replace(/([\\`*_[\]<>])/g, "\\$1").replace(/^(\s*)([#+-]|\d+\.)(\s)/gm, "$1\\$2$3");

function inlineMarkdown(node: EpisodeInline): string {
  if (node.type === "hardBreak") return "  \n";
  let text = escapeMarkdown(node.text);
  for (const mark of node.marks ?? []) text = mark.type === "bold" ? `**${text}**` : `*${text}*`;
  return text;
}

function blockMarkdown(block: EpisodeBlock): string {
  switch (block.type) {
    case "horizontalRule":
      return "---";
    case "blockquote":
      return block.content
        .map(blockMarkdown)
        .join("\n\n")
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n");
    case "paragraph":
      return (block.content ?? []).map(inlineMarkdown).join("");
  }
}

const docMarkdown = (doc: EpisodeDoc) => doc.content.map(blockMarkdown).filter(Boolean).join("\n\n");

const heading = ({ number, title }: ExportEpisode) => `${number}화. ${title}`;
const NOTE_LABEL = "작가의 말";

function episodeBody(format: ExportFormat, episode: ExportEpisode, level: 1 | 2): string {
  const { content, authorNote } = episode;
  if (format === "txt") {
    const note = authorNote ? `\n\n[${NOTE_LABEL}]\n${authorNote}` : "";
    return `${heading(episode)}\n\n${docToText(content)}${note}`;
  }
  if (format === "md") {
    const note = authorNote ? `\n\n${"#".repeat(level + 1)} ${NOTE_LABEL}\n\n${escapeMarkdown(authorNote)}` : "";
    return `${"#".repeat(level)} ${escapeMarkdown(heading(episode))}\n\n${docMarkdown(content)}${note}`;
  }
  const note = authorNote
    ? `<h${level + 1}>${NOTE_LABEL}</h${level + 1}><p>${escapeHtml(authorNote).replace(/\n/g, "<br>")}</p>`
    : "";
  return `<article><h${level}>${escapeHtml(heading(episode))}</h${level}>${content.content.map(blockHtml).join("")}${note}</article>`;
}

const htmlDocument = (title: string, body: string) =>
  `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;

export function renderEpisodeExport(format: ExportFormat, episode: ExportEpisode): string {
  const body = episodeBody(format, episode, 1);
  return format === "html" ? htmlDocument(heading(episode), body) : `${body}\n`;
}

export function renderWorkExport(format: ExportFormat, work: { title: string; episodes: ExportEpisode[] }): string {
  const bodies = work.episodes.map((episode) => episodeBody(format, episode, 2));
  if (format === "txt") return `${work.title}\n\n\n${bodies.join("\n\n\n")}\n`;
  if (format === "md") return `# ${escapeMarkdown(work.title)}\n\n${bodies.join("\n\n")}\n`;
  return htmlDocument(work.title, `<h1>${escapeHtml(work.title)}</h1>\n${bodies.join("\n")}`);
}
