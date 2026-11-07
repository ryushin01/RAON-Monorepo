import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer) {
  let c = 0xffffffff;
  for (const byte of data) c = (crcTable[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodeGrayPng(width: number, height: number, pixel: (x: number, y: number) => number) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) raw[y * (width + 1) + 1 + x] = pixel(x, y);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8비트 회색조
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 가상 데이터용 웹툰 칸. 저작물을 쓰지 않으려고 하늘, 달, 능선을 수식으로 그린다. */
export function drawDemoPanel(seed: number, width = 480, height = 640) {
  const moonX = width * (0.25 + ((seed * 37) % 50) / 100);
  const moonY = height * (0.15 + ((seed * 13) % 20) / 100);
  const moonRadius = width * 0.09;
  const ridge = (x: number, layer: number) =>
    height * (0.55 + layer * 0.13) +
    Math.sin((x / width) * (4 + layer) + seed * (layer + 1)) * height * 0.06 +
    Math.sin((x / width) * (11 + layer * 3) + seed) * height * 0.015;
  return encodeGrayPng(width, height, (x, y) => {
    if (ridge(x, 2) < y) return 28;
    if (ridge(x, 1) < y) return 62;
    if (ridge(x, 0) < y) return 96;
    if (Math.hypot(x - moonX, y - moonY) < moonRadius) return 244;
    return Math.round(150 + (y / height) * 70);
  });
}
