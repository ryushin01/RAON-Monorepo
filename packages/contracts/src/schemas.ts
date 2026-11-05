import { z } from "zod";
import { episodeDocSchema } from "./document.js";
import { COIN_PACKAGES, genreSchema, roleSchema, workSortSchema } from "./domain.js";

const email = z
  .email("이메일 형식을 확인해 주세요.")
  .max(254)
  .transform((v) => v.toLowerCase());

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요.").max(128),
  role: roleSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email,
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상으로 입력해 주세요.")
    .max(128, "비밀번호는 128자 이하로 입력해 주세요."),
  nickname: z
    .string()
    .trim()
    .min(2, "닉네임은 2자 이상으로 입력해 주세요.")
    .max(20, "닉네임은 20자 이하로 입력해 주세요."),
  role: roleSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const workQuerySchema = z.object({
  genre: genreSchema.optional(),
  status: z.enum(["ONGOING", "COMPLETED"]).optional(),
  sort: workSortSchema.default("popular"),
  q: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
export type WorkQuery = z.input<typeof workQuerySchema>;

const coins = (label: string) =>
  z.coerce
    .number(`${label}을 숫자로 입력해 주세요.`)
    .int(`${label}은 정수로 입력해 주세요.`)
    .min(10, `${label}은 10코인 이상으로 입력해 주세요.`)
    .max(100000, `${label}은 100,000코인 이하로 입력해 주세요.`);

export const workInputSchema = z.object({
  title: z.string().trim().min(1, "작품명을 입력해 주세요.").max(60, "작품명은 60자 이하로 입력해 주세요."),
  synopsis: z
    .string()
    .trim()
    .min(10, "소개는 10자 이상으로 입력해 주세요.")
    .max(2000, "소개는 2,000자 이하로 입력해 주세요."),
  genre: genreSchema,
  episodePrice: coins("회차 가격"),
  /** 작품 전체 구매 가격. 비워 두면 회차로만 판매한다. 완결 작품에서만 판매된다. */
  wholePrice: coins("작품 가격").nullable(),
});
export type WorkInput = z.infer<typeof workInputSchema>;

export const workStatusInputSchema = z.object({ status: z.enum(["ONGOING", "COMPLETED"]) });

export const episodeInputSchema = z.object({
  title: z.string().trim().min(1, "회차 제목을 입력해 주세요.").max(60, "회차 제목은 60자 이하로 입력해 주세요."),
  content: episodeDocSchema,
  authorNote: z.string().trim().max(500, "작가의 말은 500자 이하로 입력해 주세요.").nullable(),
  isFree: z.boolean(),
});
export type EpisodeInput = z.infer<typeof episodeInputSchema>;

export const addCartItemSchema = z.union([
  z.strictObject({ kind: z.literal("EPISODES"), workId: z.uuid(), episodeIds: z.array(z.uuid()).min(1).max(200) }),
  z.strictObject({ kind: z.literal("WORK"), workId: z.uuid() }),
]);
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const checkoutSchema = z.object({ idempotencyKey: z.uuid() });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const chargeSchema = z.object({
  amount: z.union(COIN_PACKAGES.map((v) => z.literal(v))),
  idempotencyKey: z.uuid(),
});
export type ChargeInput = z.infer<typeof chargeSchema>;
