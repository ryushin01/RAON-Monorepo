import { createZip } from "./zip";

const read = (zip: Uint8Array) => {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const decoder = new TextDecoder();
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries: { name: string; text: string; crc: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const local = view.getUint32(offset + 42, true);
    const name = decoder.decode(zip.subarray(offset + 46, offset + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true);
    entries.push({
      name,
      text: decoder.decode(zip.subarray(start, start + size)),
      crc: view.getUint32(offset + 16, true),
    });
    offset += 46 + nameLength;
  }
  return entries;
};

it("순서를 지키고, 한글 이름과 내용을 그대로 담는다", () => {
  const zip = createZip([
    { name: "mimetype", text: "application/epub+zip" },
    { name: "폴더/글.txt", text: "등대지기" },
  ]);
  expect(read(zip).map(({ name, text }) => [name, text])).toEqual([
    ["mimetype", "application/epub+zip"],
    ["폴더/글.txt", "등대지기"],
  ]);
});

it("CRC32를 표준대로 계산한다", () => {
  // "123456789"의 CRC32는 표준 검사 값이다.
  expect(read(createZip([{ name: "a", text: "123456789" }]))[0]?.crc).toBe(0xcbf43926);
});
