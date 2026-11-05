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
  it("입력값을 ISO 시각으로 바꾼다", () => {
    expect(toPublishAt("2026-11-06T09:30")).toBe(new Date("2026-11-06T09:30").toISOString());
  });

  it("비어 있으면 null이다", () => {
    expect(toPublishAt("")).toBeNull();
  });
});
