import type { EpisodeDoc } from "@raon/contracts";
import { paragraphTexts } from "./text-analysis";

export interface DiffLine {
  type: "same" | "added" | "removed";
  text: string;
}

/** 이보다 크면 계산이 오래 걸리므로 바뀐 구간을 통째로 지우고 넣은 것으로 보여 준다. */
const MAX_CELLS = 4_000_000;

/** 단락 단위로 비교한다. 앞뒤의 같은 단락을 먼저 덜어 내 대부분의 경우 계산량이 작다. */
export function diffParagraphs(before: EpisodeDoc, after: EpisodeDoc): DiffLine[] {
  const a = paragraphTexts(before);
  const b = paragraphTexts(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const same = (texts: string[]): DiffLine[] => texts.map((text) => ({ type: "same", text }));
  const removed = a.slice(start, endA);
  const added = b.slice(start, endB);
  const lines = same(a.slice(0, start));

  if (removed.length * added.length > MAX_CELLS) {
    lines.push(...removed.map((text): DiffLine => ({ type: "removed", text })));
    lines.push(...added.map((text): DiffLine => ({ type: "added", text })));
  } else {
    // table[i][j]는 removed[i..]와 added[j..]의 최장 공통 단락 수다.
    const table = Array.from({ length: removed.length + 1 }, () => new Array<number>(added.length + 1).fill(0));
    const cell = (i: number, j: number) => table[i]?.[j] ?? 0;
    for (let i = removed.length - 1; i >= 0; i -= 1) {
      const row = table[i] as number[];
      for (let j = added.length - 1; j >= 0; j -= 1) {
        row[j] = removed[i] === added[j] ? cell(i + 1, j + 1) + 1 : Math.max(cell(i + 1, j), cell(i, j + 1));
      }
    }
    let i = 0;
    let j = 0;
    while (i < removed.length || j < added.length) {
      if (i < removed.length && j < added.length && removed[i] === added[j]) {
        lines.push({ type: "same", text: removed[i] as string });
        i += 1;
        j += 1;
      } else if (j >= added.length || (i < removed.length && cell(i + 1, j) >= cell(i, j + 1))) {
        lines.push({ type: "removed", text: removed[i] as string });
        i += 1;
      } else {
        lines.push({ type: "added", text: added[j] as string });
        j += 1;
      }
    }
  }
  lines.push(...same(a.slice(endA)));
  return lines;
}
