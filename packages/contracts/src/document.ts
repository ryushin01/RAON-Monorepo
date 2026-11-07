import { z } from "zod";

/**
 * 회차 본문 형식. 에디터(Tiptap) 문서 중 허용한 노드와 마크만 저장한다.
 * HTML을 저장하지 않으므로 뷰어는 이 구조를 React 요소로 바꿔 그리고, 스크립트가 끼어들 자리가 없다.
 */
const markSchema = z.strictObject({ type: z.enum(["bold", "italic"]) });

const textNodeSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: z.array(markSchema).optional(),
});

// 줄바꿈을 포함한 범위에 서식을 적용하면 에디터가 줄바꿈에도 마크를 붙인다.
const hardBreakSchema = z.strictObject({ type: z.literal("hardBreak"), marks: z.array(markSchema).optional() });

const inlineSchema = z.discriminatedUnion("type", [textNodeSchema, hardBreakSchema]);

const paragraphSchema = z.strictObject({
  type: z.literal("paragraph"),
  content: z.array(inlineSchema).optional(),
});

const blockquoteSchema = z.strictObject({
  type: z.literal("blockquote"),
  content: z.array(paragraphSchema).min(1),
});

const horizontalRuleSchema = z.strictObject({ type: z.literal("horizontalRule") });

const blockSchema = z.discriminatedUnion("type", [paragraphSchema, blockquoteSchema, horizontalRuleSchema]);

export const episodeDocSchema = z.strictObject({
  type: z.literal("doc"),
  content: z.array(blockSchema),
});

export type EpisodeDoc = z.infer<typeof episodeDocSchema>;
export type EpisodeBlock = z.infer<typeof blockSchema>;
export type EpisodeInline = z.infer<typeof inlineSchema>;

export const EMPTY_DOC: EpisodeDoc = { type: "doc", content: [{ type: "paragraph" }] };

function sumText(doc: EpisodeDoc, measure: (text: string) => number): number {
  let count = 0;
  const visit = (block: EpisodeBlock) => {
    if (block.type === "horizontalRule") return;
    if (block.type === "blockquote") {
      block.content.forEach(visit);
      return;
    }
    for (const inline of block.content ?? []) {
      if (inline.type === "text") count += measure(inline.text);
    }
  };
  doc.content.forEach(visit);
  return count;
}

/** 공백을 뺀 글자 수. 공개 조건과 작가 화면의 글자 수 표시에 함께 쓴다. */
export function countChars(doc: EpisodeDoc): number {
  return sumText(doc, (text) => text.replace(/\s/g, "").length);
}

/** 공백을 포함한 글자 수. 웹소설 분량의 기준이다. 문단 구분과 줄바꿈은 세지 않는다. */
export function countCharsWithSpaces(doc: EpisodeDoc): number {
  return sumText(doc, (text) => text.length);
}

/** 공백과 문장 부호, 기호를 뺀 글자 수. 연재처마다 분량 기준이 달라 함께 보여 준다. */
export function countCharsWithoutSymbols(doc: EpisodeDoc): number {
  return sumText(
    doc,
    (text) => text.replace(/\s|\p{P}|\p{S}|\u200D|\uFE0E|\uFE0F|\u20E3|[\u{E0020}-\u{E007F}]/gu, "").length,
  );
}

/** 문서의 글자만 뽑는다. 단락 사이는 빈 줄, 줄바꿈은 줄바꿈 한 번이다. 구분선은 뺀다. */
export function docToText(doc: EpisodeDoc): string {
  const paragraphs: string[] = [];
  const visit = (block: EpisodeBlock) => {
    if (block.type === "horizontalRule") return;
    if (block.type === "blockquote") {
      block.content.forEach(visit);
      return;
    }
    const text = (block.content ?? []).map((inline) => (inline.type === "text" ? inline.text : "\n")).join("");
    if (text.trim()) paragraphs.push(text);
  };
  doc.content.forEach(visit);
  return paragraphs.join("\n\n");
}

/** 줄바꿈은 글자가 아니라 줄바꿈 노드로 넣는다. 그래야 뷰어와 글자 수가 에디터와 같아진다. */
function inlineFromLines(paragraph: string): EpisodeInline[] {
  const inline: EpisodeInline[] = [];
  paragraph.split(/\r?\n/).forEach((line, index) => {
    if (index > 0) inline.push({ type: "hardBreak" });
    if (line) inline.push({ type: "text", text: line });
  });
  return inline;
}

/** 일반 텍스트를 문단 문서로 바꾼다. 빈 줄이 문단 구분이다. 시드 데이터와 테스트에서 쓴다. */
export function docFromText(text: string): EpisodeDoc {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((p) => ({ type: "paragraph", content: inlineFromLines(p) })),
  };
}
