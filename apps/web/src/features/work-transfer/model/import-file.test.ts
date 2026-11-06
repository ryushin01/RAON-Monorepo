import { TextDecoder as NodeDecoder, TextEncoder } from "node:util";
import { docToText } from "@raon/contracts";
import { decodeText, ImportError, MAX_IMPORT_BYTES, parseImportFile } from "./import-file";

// jsdom에는 TextDecoder가 없어 Node의 것을 쓴다.
globalThis.TextDecoder = NodeDecoder as typeof TextDecoder;

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("decodeText", () => {
  it("UTF-8을 읽고, 아니면 EUC-KR로 읽는다", () => {
    expect(decodeText(utf8("가나"))).toBe("가나");
    expect(decodeText(new Uint8Array([0xb0, 0xa1, 0xb3, 0xaa]))).toBe("가나");
  });
});

describe("parseImportFile", () => {
  it("파일 이름을 제목으로 쓰고 단락과 줄바꿈을 나눈다", () => {
    const { title, content } = parseImportFile("첫 이야기.TXT", utf8("첫 줄\r\n둘째 줄\r\n\r\n다음 단락"));
    expect(title).toBe("첫 이야기");
    expect(docToText(content)).toBe("첫 줄\n둘째 줄\n\n다음 단락");
  });

  it("MD의 첫 제목을 회차 제목으로 쓰고 본문에서 뺀다. TXT는 그대로 둔다", () => {
    const md = parseImportFile("파일.md", utf8("# 진짜 제목\n\n본문"));
    expect(md.title).toBe("진짜 제목");
    expect(docToText(md.content)).toBe("본문");
    const txt = parseImportFile("파일.txt", utf8("# 그냥 글자\n\n본문"));
    expect(txt.title).toBe("파일");
    expect(docToText(txt.content)).toContain("# 그냥 글자");
  });

  it("BOM을 지우고 제목 길이를 제한한다", () => {
    const { title, content } = parseImportFile(`${"가".repeat(70)}.txt`, utf8("\uFEFF본문"));
    expect(title).toHaveLength(60);
    expect(docToText(content)).toBe("본문");
  });

  it("글자는 HTML로 해석하지 않는다", () => {
    expect(docToText(parseImportFile("a.txt", utf8("<b>굵게</b>")).content)).toBe("<b>굵게</b>");
  });

  it.each([
    ["원고.pdf", utf8("가"), /TXT와 MD/],
    ["원고", utf8("가"), /TXT와 MD/],
    ["빈.txt", utf8("  \n\n "), /본문이 없습니다/],
    ["큰.txt", new Uint8Array(MAX_IMPORT_BYTES + 1), /1MB/],
  ])("%s는 가져오지 않는다", (name, bytes, message) => {
    expect(() => parseImportFile(name, bytes)).toThrow(ImportError);
    expect(() => parseImportFile(name, bytes)).toThrow(message);
  });
});
