import { flattenPolished, polishRequestSchema } from "./polish";

it("빈 글과 너무 긴 글, 알 수 없는 문체를 거부한다", () => {
  expect(polishRequestSchema.safeParse({ prompt: " ", style: "natural" }).success).toBe(false);
  expect(polishRequestSchema.safeParse({ prompt: "가".repeat(2001), style: "natural" }).success).toBe(false);
  expect(polishRequestSchema.safeParse({ prompt: "글", style: "poem" }).success).toBe(false);
  expect(polishRequestSchema.safeParse({ prompt: "글", style: "vivid", extra: 1 }).success).toBe(false);
  expect(polishRequestSchema.safeParse({ prompt: "글", style: "concise" }).success).toBe(true);
});

it("단락 안에 넣도록 줄바꿈을 공백으로 편다", () => {
  expect(flattenPolished("  첫 문장.\n\n 둘째 문장.\n")).toBe("첫 문장. 둘째 문장.");
});
