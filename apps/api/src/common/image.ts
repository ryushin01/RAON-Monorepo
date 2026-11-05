/** 파일 이름이나 Content-Type은 믿지 않고 내용의 앞부분으로 이미지 형식을 판별한다. SVG는 스크립트를 담을 수 있어 받지 않는다. */
export function detectImageType(data: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => data[index] === byte);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...data.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
