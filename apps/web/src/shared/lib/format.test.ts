import { formatCoins, formatCompact, safeNextPath } from "./format";

describe("formatCompact", () => {
  it("만 단위로 줄인다", () => {
    expect(formatCompact(9999)).toBe("9,999");
    expect(formatCompact(10000)).toBe("1만");
    expect(formatCompact(48210)).toBe("4.8만");
  });
});

describe("formatCoins", () => {
  it("천 단위 구분과 단위를 붙인다", () => {
    expect(formatCoins(1200)).toBe("1,200코인");
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/cart", "/cart"],
    ["https://evil.test", "/"],
    ["//evil.test", "/"],
    ["/\\evil.test", "/"],
    [undefined, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
