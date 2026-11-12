import { writePreference } from "@/shared/lib/preferences";
import { PREFERENCES_SCRIPT, VIEWER_COOKIE } from "./index";

const run = (cookie: string) => {
  // 앱이 쿠키를 쓰는 방식 그대로 저장해, 스크립트가 실제로 읽는 값을 확인합니다.
  writePreference(VIEWER_COOKIE, cookie);
  new Function(PREFERENCES_SCRIPT)();
  const root = document.documentElement;
  return {
    theme: root.dataset.viewerTheme,
    size: root.style.getPropertyValue("--viewer-size"),
    leading: root.style.getPropertyValue("--viewer-leading"),
  };
};

describe("첫 그림 전 설정 스크립트", () => {
  afterEach(() => {
    const root = document.documentElement;
    delete root.dataset.viewerTheme;
    root.style.removeProperty("--viewer-size");
    root.style.removeProperty("--viewer-leading");
  });

  it("저장된 뷰어 설정을 적용합니다", () => {
    expect(run('{"theme":"black","font":"sans","size":20,"leading":2}')).toEqual({
      theme: "black",
      size: "20px",
      leading: "2",
    });
  });

  it("고친 쿠키의 크기는 범위 안으로 맞추고, 숫자가 아니거나 모르는 테마는 적용하지 않습니다", () => {
    expect(run('{"theme":"neon","size":999,"leading":"x"}')).toEqual({ theme: undefined, size: "28px", leading: "" });
  });
});
