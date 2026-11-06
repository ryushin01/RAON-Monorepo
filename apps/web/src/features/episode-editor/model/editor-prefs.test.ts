import { DEFAULT_EDITOR_PREFS, readEditorPrefs, toggleEditorPref } from "./editor-prefs";

beforeEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: 테스트 사이에 쿠키를 지운다.
  document.cookie = "raon_editor_prefs=; max-age=0; path=/";
});

it("저장한 적이 없으면 기본값이고, 값이 그대로면 같은 객체를 돌려준다", () => {
  expect(readEditorPrefs()).toEqual(DEFAULT_EDITOR_PREFS);
  expect(readEditorPrefs()).toBe(readEditorPrefs());
});

it("바꾼 값을 저장한다", () => {
  toggleEditorPref("focus");
  expect(readEditorPrefs().focus).toBe(true);
  toggleEditorPref("smartInput");
  expect(readEditorPrefs()).toMatchObject({ focus: true, smartInput: false });
});

it.each(["{깨진", '{"focus":"yes","dim":true,"other":true}'])("쿠키 값 %s에서 잘못된 부분은 쓰지 않는다", (raw) => {
  // biome-ignore lint/suspicious/noDocumentCookie: 사용자가 고친 쿠키를 흉내 낸다.
  document.cookie = `raon_editor_prefs=${encodeURIComponent(raw)}; path=/`;
  const prefs = readEditorPrefs();
  expect(prefs.focus).toBe(false);
  expect(prefs).not.toHaveProperty("other");
});
