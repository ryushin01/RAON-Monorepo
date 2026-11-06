import { countChars, docFromText, type EpisodeDoc } from "@raon/contracts";

export const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_TITLE = 60;

export class ImportError extends Error {}

/** 한국어 문서 도구가 내보낸 파일은 EUC-KR인 경우가 많다. UTF-8로 읽히지 않으면 EUC-KR로 읽는다. */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

/** 파일 이름과 내용으로 새 회차를 만든다. MD 파일의 첫 줄이 제목이면 회차 제목으로 쓴다. */
export function parseImportFile(name: string, bytes: Uint8Array): { title: string; content: EpisodeDoc } {
  const match = /^(.*)\.(txt|md)$/i.exec(name);
  if (!match) throw new ImportError("TXT와 MD 파일만 가져올 수 있습니다.");
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new ImportError("1MB 이하의 파일만 가져올 수 있습니다.");
  let text = decodeText(bytes).replace(/^\uFEFF/, "");
  let title = match[1]?.trim() ?? "";
  if (match[2]?.toLowerCase() === "md") {
    const heading = /^#\s+(.+)\r?\n?/.exec(text);
    if (heading?.[1]) {
      title = heading[1].trim();
      text = text.slice(heading[0].length);
    }
  }
  const content = docFromText(text);
  if (countChars(content) === 0) throw new ImportError("파일에 본문이 없습니다.");
  return { title: title.slice(0, MAX_TITLE) || "제목 없음", content };
}
