import { matchReplaceRule, readReplaceRules, writeReplaceRules } from "./replace-rules";

beforeEach(() => window.localStorage.clear());

it("저장한 규칙을 읽고, 값이 그대로면 같은 배열을 돌려준다", () => {
  expect(readReplaceRules()).toEqual([]);
  expect(writeReplaceRules([{ from: "->", to: "→" }])).toBe(true);
  expect(readReplaceRules()).toEqual([{ from: "->", to: "→" }]);
  expect(readReplaceRules()).toBe(readReplaceRules());
});

it("깨졌거나 모양이 다른 값은 쓰지 않는다", () => {
  window.localStorage.setItem("raon:replace-rules", "{깨짐");
  expect(readReplaceRules()).toEqual([]);
  window.localStorage.setItem(
    "raon:replace-rules",
    JSON.stringify([{ from: "" }, { from: "a", to: 1 }, { from: "b", to: "c" }]),
  );
  expect(readReplaceRules()).toEqual([{ from: "b", to: "c" }]);
});

it("방금 쓴 글자로 끝나는 규칙 중 가장 긴 것을 고른다", () => {
  const rules = [
    { from: "--", to: "–" },
    { from: "---", to: "—" },
  ];
  expect(matchReplaceRule(rules, "앞---")).toEqual({ from: "---", to: "—" });
  expect(matchReplaceRule(rules, "앞--")).toEqual({ from: "--", to: "–" });
  expect(matchReplaceRule(rules, "앞-")).toBeNull();
});
