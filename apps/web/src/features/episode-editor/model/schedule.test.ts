import { isScheduled, toPublishAt } from "./schedule";

describe("isScheduled", () => {
  const now = Date.parse("2026-11-05T00:00:00Z");

  it("공개 시각이 지났는지 구분한다", () => {
    expect(isScheduled("2026-11-06T00:00:00Z", now)).toBe(true);
    expect(isScheduled("2026-11-04T00:00:00Z", now)).toBe(false);
    expect(isScheduled(null, now)).toBe(false);
  });
});

describe("toPublishAt", () => {
  it("입력값을 한국 시간으로 읽는다", () => {
    expect(toPublishAt("2026-11-06T09:30")).toBe("2026-11-06T00:30:00.000Z");
  });

  it("비어 있으면 null이다", () => {
    expect(toPublishAt("")).toBeNull();
  });
});
