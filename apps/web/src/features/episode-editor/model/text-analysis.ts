import type { EpisodeBlock, EpisodeDoc } from "@raon/contracts";

export type ParagraphKind = "dialogue" | "monologue" | "description";

export type ParagraphStats = Record<ParagraphKind, { paragraphs: number; chars: number }>;

const DIALOGUE_START = /^["“「『]/;
const MONOLOGUE_START = /^['‘]/;

export function paragraphTexts(doc: EpisodeDoc): string[] {
  const texts: string[] = [];
  const visit = (block: EpisodeBlock) => {
    if (block.type === "horizontalRule") return;
    if (block.type === "blockquote") {
      block.content.forEach(visit);
      return;
    }
    const text = (block.content ?? []).map((inline) => (inline.type === "text" ? inline.text : "\n")).join("");
    if (text.trim()) texts.push(text.trim());
  };
  doc.content.forEach(visit);
  return texts;
}

/** 첫 글자로 단락을 나눈다. 큰따옴표는 대사, 작은따옴표는 독백, 나머지는 서술이다. */
export function classifyParagraph(text: string): ParagraphKind {
  if (DIALOGUE_START.test(text)) return "dialogue";
  if (MONOLOGUE_START.test(text)) return "monologue";
  return "description";
}

export function analyzeParagraphs(doc: EpisodeDoc): ParagraphStats {
  const stats: ParagraphStats = {
    dialogue: { paragraphs: 0, chars: 0 },
    monologue: { paragraphs: 0, chars: 0 },
    description: { paragraphs: 0, chars: 0 },
  };
  for (const text of paragraphTexts(doc)) {
    const entry = stats[classifyParagraph(text)];
    entry.paragraphs += 1;
    entry.chars += text.length;
  }
  return stats;
}

export interface Repetition {
  text: string;
  count: number;
}

const WORD_EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const MIN_REPEAT = 3;

function topRepetitions(counts: Map<string, number>, limit: number): Repetition[] {
  return [...counts]
    .filter(([, count]) => count >= MIN_REPEAT)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "ko"))
    .slice(0, limit);
}

/** 세 번 이상 나온 낱말(두 글자 이상)과 문장 끝맺음(마지막 두 글자)을 많은 순으로 고른다. */
export function findRepetitions(doc: EpisodeDoc, limit = 10): { words: Repetition[]; endings: Repetition[] } {
  const words = new Map<string, number>();
  const endings = new Map<string, number>();
  for (const paragraph of paragraphTexts(doc)) {
    for (const raw of paragraph.split(/\s+/)) {
      const word = raw.replace(WORD_EDGE, "");
      if (word.length >= 2) words.set(word, (words.get(word) ?? 0) + 1);
    }
    for (const sentence of paragraph.split(/(?<=[.?!…])\s+|\n/)) {
      const body = sentence.replace(WORD_EDGE, "");
      if (body.length >= 2) {
        const ending = body.slice(-2);
        endings.set(ending, (endings.get(ending) ?? 0) + 1);
      }
    }
  }
  return { words: topRepetitions(words, limit), endings: topRepetitions(endings, limit) };
}
