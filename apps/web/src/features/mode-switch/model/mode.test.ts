import { currentMode, modeWorksHref, parseMode } from "./mode";

it("알 수 없는 값은 기본 모드로 돌아간다", () => {
  expect(parseMode("COMIC")).toBe("COMIC");
  expect(parseMode("MOVIE")).toBe("NOVEL");
  expect(parseMode(undefined)).toBe("NOVEL");
});

it("주소에 드러난 모드를 저장한 값보다 먼저 쓴다", () => {
  expect(currentMode("/webtoon", null, "NOVEL")).toBe("COMIC");
  expect(currentMode("/novel", null, "COMIC")).toBe("NOVEL");
  expect(currentMode("/works", "COMIC", "NOVEL")).toBe("COMIC");
});

it("주소에 없으면 저장한 값을 쓰고, 목록이 아닌 화면의 쿼리는 모드로 보지 않는다", () => {
  expect(currentMode("/works", null, "COMIC")).toBe("COMIC");
  expect(currentMode("/my", "NOVEL", "COMIC")).toBe("COMIC");
  expect(currentMode("/", null, undefined)).toBe("NOVEL");
});

it("모드를 유지한 목록 주소를 만든다", () => {
  expect(modeWorksHref("COMIC")).toBe("/works?format=COMIC");
  expect(modeWorksHref("NOVEL", "genre=SF")).toBe("/works?format=NOVEL&genre=SF");
});
