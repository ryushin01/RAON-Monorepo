import { readImageSize } from "./image.js";

const png = () => {
  const data = Buffer.alloc(32);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(data);
  data.writeUInt32BE(800, 16);
  data.writeUInt32BE(1200, 20);
  return data;
};

const webp = (chunk: string, fill: (data: Buffer) => void) => {
  const data = Buffer.alloc(40);
  data.write("RIFF", 0, "latin1");
  data.write("WEBP", 8, "latin1");
  data.write(chunk, 12, "latin1");
  fill(data);
  return data;
};

describe("readImageSize", () => {
  it("PNG 헤더를 읽는다", () => {
    expect(readImageSize(png())).toEqual({ width: 800, height: 1200 });
  });

  it("JPEG는 앞선 구간을 건너뛰어 크기 표식을 찾고, 이름이 비슷한 표식은 건너뛴다", () => {
    const data = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc4, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08,
      0x04, 0xb0, 0x03, 0x20, 0x03, 0x00, 0x00, 0x00,
    ]);
    expect(readImageSize(data)).toEqual({ width: 800, height: 1200 });
  });

  it("WebP의 세 가지 형식을 읽는다", () => {
    const lossy = webp("VP8 ", (data) => {
      data.writeUInt16LE(800, 26);
      data.writeUInt16LE(1200, 28);
    });
    expect(readImageSize(lossy)).toEqual({ width: 800, height: 1200 });

    const lossless = webp("VP8L", (data) => data.writeUInt32LE((800 - 1) | ((1200 - 1) << 14), 21));
    expect(readImageSize(lossless)).toEqual({ width: 800, height: 1200 });

    const extended = webp("VP8X", (data) => {
      data.writeUIntLE(800 - 1, 24, 3);
      data.writeUIntLE(1200 - 1, 27, 3);
    });
    expect(readImageSize(extended)).toEqual({ width: 800, height: 1200 });
  });

  it("잘렸거나 이미지가 아니면 크기만 모르는 것으로 둔다", () => {
    expect(readImageSize(png().subarray(0, 18))).toBeNull();
    expect(readImageSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(readImageSize(Buffer.from("<svg></svg>"))).toBeNull();
  });

  it("너비나 높이가 0이면 쓰지 않는다", () => {
    const data = png();
    data.writeUInt32BE(0, 16);
    expect(readImageSize(data)).toBeNull();
  });
});
