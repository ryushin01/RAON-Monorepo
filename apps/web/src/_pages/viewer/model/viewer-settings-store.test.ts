import { DEFAULT_SETTINGS, parseViewerSettings } from "./viewer-settings-store";

describe("parseViewerSettings", () => {
  it("저장된 설정을 읽습니다", () => {
    expect(parseViewerSettings('{"theme":"black","font":"sans","size":20,"leading":2}')).toEqual({
      theme: "black",
      font: "sans",
      size: 20,
      leading: 2,
    });
  });

  it("쿠키를 고쳐 범위를 넘긴 크기·줄 간격은 범위 안으로 맞춥니다", () => {
    expect(parseViewerSettings('{"theme":"auto","font":"serif","size":999,"leading":0}')).toMatchObject({
      size: 28,
      leading: 1.5,
    });
  });

  it("모르는 값이나 틀린 형식은 그 칸만 기본값으로 돌리고, 깨진 쿠키는 전부 기본값입니다", () => {
    expect(parseViewerSettings('{"theme":"neon","font":"sans","size":"big","leading":2}')).toEqual({
      theme: "auto",
      font: "sans",
      size: 18,
      leading: 2,
    });
    expect(parseViewerSettings("{oops")).toEqual(DEFAULT_SETTINGS);
    expect(parseViewerSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
