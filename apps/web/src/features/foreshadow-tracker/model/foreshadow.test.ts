import type { Foreshadow } from "@raon/contracts";
import { describeForeshadow, isResolved, toForeshadowInput } from "./foreshadow";

const base: Foreshadow = {
  id: "f1",
  workId: "w1",
  title: "나침반",
  body: "",
  plantedEpisodeId: null,
  resolvedEpisodeId: null,
  updatedAt: "2026-11-07T00:00:00.000Z",
};
const episodes = [
  { id: "e1", number: 1, title: "첫" },
  { id: "e3", number: 3, title: "셋" },
  { id: "e9", number: 9, title: "휴지통", trashed: true },
];

it("회차를 고르지 않았으면 그렇게 알린다", () => {
  expect(describeForeshadow(base, episodes)).toBe("아직 심은 회차를 고르지 않았습니다.");
});

it("휴지통을 뺀 마지막 회차까지 몇 회차가 지났는지 알린다", () => {
  expect(describeForeshadow({ ...base, plantedEpisodeId: "e1" }, episodes)).toBe(
    "1화에 심었습니다. 2개 회차가 지나도록 회수하지 않았습니다.",
  );
  expect(describeForeshadow({ ...base, plantedEpisodeId: "e3" }, episodes)).toBe(
    "3화에 심었습니다. 아직 회수하지 않았습니다.",
  );
});

it("휴지통의 회차를 표시한다", () => {
  expect(describeForeshadow({ ...base, plantedEpisodeId: "e9" }, episodes)).toBe(
    "9화(휴지통)에 심었습니다. 아직 회수하지 않았습니다.",
  );
});

it("회수한 복선을 알리고, 순서가 뒤집히면 경고한다", () => {
  expect(describeForeshadow({ ...base, plantedEpisodeId: "e1", resolvedEpisodeId: "e3" }, episodes)).toBe(
    "1화에 심고 3화에서 회수했습니다.",
  );
  expect(describeForeshadow({ ...base, resolvedEpisodeId: "e3" }, episodes)).toBe("3화에서 회수했습니다.");
  expect(describeForeshadow({ ...base, plantedEpisodeId: "e3", resolvedEpisodeId: "e1" }, episodes)).toContain(
    "회수 회차가 심은 회차보다 앞에 있습니다.",
  );
});

it("입력 값으로 바꾸고 일부만 고친다", () => {
  expect(isResolved(base)).toBe(false);
  expect(toForeshadowInput(base, { resolvedEpisodeId: "e1" })).toEqual({
    title: "나침반",
    body: "",
    plantedEpisodeId: null,
    resolvedEpisodeId: "e1",
  });
});
