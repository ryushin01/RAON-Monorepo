import { DEFAULT_EPISODE_GOAL, parseEpisodeGoal, readEpisodeGoal, writeEpisodeGoal } from "./episode-goal";

beforeEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: 테스트 사이에 쿠키를 지운다.
  document.cookie = "raon_episode_goal=; max-age=0; path=/";
});

describe("parseEpisodeGoal", () => {
  it.each([
    ["5000", 5000],
    [" 300 ", 300],
    ["", null],
    ["  ", null],
  ])("%j는 %j다", (value, expected) => {
    expect(parseEpisodeGoal(value)).toBe(expected);
  });

  it.each(["0", "-1", "1.5", "1e3", "100001", "많이"])("%j는 잘못된 값이다", (value) => {
    expect(parseEpisodeGoal(value)).toBeUndefined();
  });
});

describe("저장", () => {
  it("저장한 적이 없으면 기본값이다", () => {
    expect(readEpisodeGoal()).toBe(DEFAULT_EPISODE_GOAL);
  });

  it("저장한 목표를 읽고, 목표 없음도 유지한다", () => {
    writeEpisodeGoal(3000);
    expect(readEpisodeGoal()).toBe(3000);
    writeEpisodeGoal(null);
    expect(readEpisodeGoal()).toBeNull();
  });

  it("쿠키 값이 잘못되면 기본값으로 돌아간다", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: 사용자가 고친 쿠키를 흉내 낸다.
    document.cookie = "raon_episode_goal=abc; path=/";
    expect(readEpisodeGoal()).toBe(DEFAULT_EPISODE_GOAL);
  });
});
