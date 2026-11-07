const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of data) c = (crcTable[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  text: string;
}

/**
 * 압축하지 않는(store) ZIP을 만든다. DOCX와 EPUB은 ZIP이고 원고는 크지 않아 라이브러리 없이 만든다.
 * EPUB은 mimetype이 맨 앞에 압축 없이 있어야 하므로 받은 순서를 지킨다.
 */
export function createZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const files = entries.map(({ name, text }) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    return { nameBytes, data, crc: crc32(data) };
  });
  const LOCAL = 30;
  const CENTRAL = 46;
  const END = 22;
  const dataSize = files.reduce((sum, file) => sum + LOCAL + file.nameBytes.length + file.data.length, 0);
  const centralSize = files.reduce((sum, file) => sum + CENTRAL + file.nameBytes.length, 0);
  const output = new Uint8Array(dataSize + centralSize + END);
  const view = new DataView(output.buffer);
  // 파일 이름이 UTF-8임을 알린다. 시각은 쓰지 않으므로 ZIP의 최솟값(1980-01-01)으로 둔다.
  const UTF8_FLAG = 0x0800;
  const DOS_DATE = 0x0021;
  let offset = 0;
  const offsets: number[] = [];
  for (const { nameBytes, data, crc } of files) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, UTF8_FLAG, true);
    view.setUint16(offset + 12, DOS_DATE, true);
    view.setUint32(offset + 14, crc, true);
    view.setUint32(offset + 18, data.length, true);
    view.setUint32(offset + 22, data.length, true);
    view.setUint16(offset + 26, nameBytes.length, true);
    output.set(nameBytes, offset + LOCAL);
    output.set(data, offset + LOCAL + nameBytes.length);
    offset += LOCAL + nameBytes.length + data.length;
  }
  const centralStart = offset;
  files.forEach(({ nameBytes, data, crc }, index) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, UTF8_FLAG, true);
    view.setUint16(offset + 14, DOS_DATE, true);
    view.setUint32(offset + 16, crc, true);
    view.setUint32(offset + 20, data.length, true);
    view.setUint32(offset + 24, data.length, true);
    view.setUint16(offset + 28, nameBytes.length, true);
    view.setUint32(offset + 42, offsets[index] as number, true);
    output.set(nameBytes, offset + CENTRAL);
    offset += CENTRAL + nameBytes.length;
  });
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, files.length, true);
  view.setUint16(offset + 10, files.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, centralStart, true);
  return output;
}
