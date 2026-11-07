import { z } from "zod";

export const POLISH_STYLES = ["natural", "concise", "vivid"] as const;
export type PolishStyle = (typeof POLISH_STYLES)[number];
export const POLISH_STYLE_LABEL: Record<PolishStyle, string> = {
  natural: "자연스럽게",
  concise: "간결하게",
  vivid: "생생하게",
};

/** 한 번에 보내는 글자 수. 비용과 응답 시간을 묶어 두고, 단락 단위로 다듬게 한다. */
export const POLISH_MAX_CHARS = 2000;

export const polishRequestSchema = z.strictObject({
  prompt: z.string().trim().min(1, "다듬을 글을 골라 주세요.").max(POLISH_MAX_CHARS),
  style: z.enum(POLISH_STYLES),
});

/** 단락 안에서만 바꾸므로 줄바꿈은 공백으로 펴서 적용한다. */
export const flattenPolished = (text: string) => text.replace(/\s*\n+\s*/g, " ").trim();
