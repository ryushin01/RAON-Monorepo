/** 파일 이름이나 Content-Type은 믿지 않고 내용의 앞부분으로 이미지 형식을 판별한다. SVG는 스크립트를 담을 수 있어 받지 않는다. */
export function detectImageType(data: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => data[index] === byte);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...data.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export interface ImageSize {
  width: number;
  height: number;
}

/** 헤더에서 크기를 읽는다. 읽지 못해도 이미지를 거부하지 않고 null을 돌려준다. 자리를 잡는 데만 쓰기 때문이다. */
export function readImageSize(data: Uint8Array): ImageSize | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const size = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);
  try {
    const type = detectImageType(data);
    if (type === "image/png") return size(view.getUint32(16), view.getUint32(20));
    if (type === "image/jpeg") return readJpegSize(data, view, size);
    if (type === "image/webp") {
      const chunk = String.fromCharCode(...data.subarray(12, 16));
      if (chunk === "VP8 ") return size(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
      if (chunk === "VP8L") {
        const bits = view.getUint32(21, true);
        return size((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      }
      if (chunk === "VP8X") {
        const u24 = (at: number) => (data[at] ?? 0) | ((data[at + 1] ?? 0) << 8) | ((data[at + 2] ?? 0) << 16);
        return size(u24(24) + 1, u24(27) + 1);
      }
    }
  } catch {
    // 잘린 파일이면 범위를 벗어난다. 크기만 모르는 것으로 둔다.
  }
  return null;
}

function readJpegSize(
  data: Uint8Array,
  view: DataView,
  size: (width: number, height: number) => ImageSize | null,
): ImageSize | null {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1] ?? 0;
    // SOF 표식이 크기를 담는다. DHT(C4), JPG(C8), DAC(CC)는 이름만 비슷하다.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return size(view.getUint16(offset + 7), view.getUint16(offset + 5));
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return null;
}
