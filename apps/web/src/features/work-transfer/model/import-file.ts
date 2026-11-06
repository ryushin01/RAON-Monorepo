import { countChars, docFromText, type EpisodeDoc } from "@raon/contracts";

export const MAX_IMPORT_BYTES = 1024 * 1024;
/** 문서로 바꾸면 줄바꿈 하나가 수십 바이트가 된다. 서버 액션 한도(3MB) 안에 들어와야 한다. */
export const MAX_DOC_BYTES = 2.5 * 1024 * 1024;
const MAX_TITLE = 60;

export class ImportError extends Error {}

/** 잘린 파일이 깨진 글자로 저장되지 않게 오류로 처리한다. */
function decodeUtf16(encoding: "utf-16le" | "utf-16be", bytes: Uint8Array): string {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new ImportError("파일이 손상되어 읽을 수 없습니다.");
  }
}

/** 한국어 문서 도구가 내보낸 파일은 EUC-KR인 경우가 많다. UTF-8로 읽히지 않으면 EUC-KR로 읽는다. */
export function decodeText(bytes: Uint8Array): string {
  // 메모장 등이 만드는 UTF-16 파일은 맨 앞의 표시로 구분한다.
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16("utf-16le", bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16("utf-16be", bytes);
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
  // NUL은 글자가 아니며 저장할 수 없다. 텍스트 파일이 아니거나 형식을 잘못 읽은 경우다.
  if (text.includes("\0")) throw new ImportError("텍스트 파일로 읽을 수 없습니다. UTF-8로 저장해 다시 올려 주세요.");
  let title = match[1]?.trim() ?? "";
  if (match[2]?.toLowerCase() === "md") {
    const heading = /^#[ \t]+(.+)\r?\n?/.exec(text);
    if (heading?.[1]) {
      title = heading[1].trim();
      text = text.slice(heading[0].length);
    }
  }
  const content = docFromText(text);
  if (countChars(content) === 0) throw new ImportError("파일에 본문이 없습니다.");
  if (new Blob([JSON.stringify(content)]).size > MAX_DOC_BYTES) {
    throw new ImportError("줄바꿈이 너무 많아 가져올 수 없습니다. 파일을 나누어 주세요.");
  }
  return { title: title.slice(0, MAX_TITLE) || "제목 없음", content };
}
