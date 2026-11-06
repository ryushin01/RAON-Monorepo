import { docFromText } from "@raon/contracts";
import { diffParagraphs } from "./paragraph-diff";

const doc = (...paragraphs: string[]) => docFromText(paragraphs.join("\n\n"));
const summary = (before: string[], after: string[]) =>
  diffParagraphs(doc(...before), doc(...after)).map(({ type, text }) => `${type[0]}:${text}`);

it("같으면 모두 same이다", () => {
  expect(summary(["가", "나"], ["가", "나"])).toEqual(["s:가", "s:나"]);
});

it("추가와 삭제, 바뀐 단락을 찾는다", () => {
  expect(summary(["가", "나", "다"], ["가", "다", "라"])).toEqual(["s:가", "r:나", "s:다", "a:라"]);
  expect(summary(["가"], ["나"])).toEqual(["r:가", "a:나"]);
});

it("중간의 같은 단락을 유지한다", () => {
  expect(summary(["가", "나", "다", "라"], ["마", "나", "바", "라"])).toEqual([
    "r:가",
    "a:마",
    "s:나",
    "r:다",
    "a:바",
    "s:라",
  ]);
});

it("한쪽이 비어 있어도 된다", () => {
  expect(summary([], ["가"])).toEqual(["a:가"]);
  expect(summary(["가"], [])).toEqual(["r:가"]);
});

it("너무 크면 바뀐 구간을 통째로 지우고 넣은 것으로 보여 주며 앞뒤는 유지한다", () => {
  const big = (prefix: string) => Array.from({ length: 2001 }, (_, index) => `${prefix}${index}`);
  const lines = diffParagraphs(doc("앞", ...big("가"), "뒤"), doc("앞", ...big("나"), "뒤"));
  expect(lines[0]).toEqual({ type: "same", text: "앞" });
  expect(lines[1]?.type).toBe("removed");
  expect(lines[2002]?.type).toBe("added");
  expect(lines.at(-1)).toEqual({ type: "same", text: "뒤" });
});
