import { z } from "zod";
import { episodeDocSchema } from "./document.js";
import {
  COIN_PACKAGES,
  episodeTypeSchema,
  genreSchema,
  MAX_NOTE_PROPERTIES,
  MAX_TAGS,
  roleSchema,
  workFormatSchema,
  workSortSchema,
  writingStageSchema,
} from "./domain.js";

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
  format: workFormatSchema.optional(),
  genre: genreSchema.optional(),
  status: z.enum(["ONGOING", "COMPLETED"]).optional(),
  sort: workSortSchema.default("popular"),
  q: z.string().trim().max(50).optional(),
  tag: z.string().trim().max(10).optional(),
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
  /** 만들 때만 쓰고 고칠 때는 무시한다. 형식에 따라 회차의 내용이 달라지기 때문이다. */
  format: workFormatSchema.default("NOVEL"),
  title: z.string().trim().min(1, "작품명을 입력해 주세요.").max(60, "작품명은 60자 이하로 입력해 주세요."),
  synopsis: z
    .string()
    .trim()
    .min(10, "소개는 10자 이상으로 입력해 주세요.")
    .max(2000, "소개는 2,000자 이하로 입력해 주세요."),
  genre: genreSchema,
  episodePrice: coins("회차 가격"),
  tags: z
    .array(z.string().trim().min(1, "태그를 입력해 주세요.").max(10, "태그는 10자 이하로 입력해 주세요."))
    .max(MAX_TAGS, `태그는 ${MAX_TAGS}개까지 입력할 수 있습니다.`)
    .transform((tags) => [...new Set(tags)]),
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

/** 화면을 읽어 주는 대체 텍스트. 공개하려면 모든 이미지에 있어야 한다(KWCAG 5.1.1). */
export const comicImageInputSchema = z.object({
  alt: z.string().trim().max(1000, "이미지 설명은 1,000자 이하로 입력해 주세요."),
});
export type ComicImageInput = z.infer<typeof comicImageInputSchema>;

export const episodeMetaInputSchema = z.object({
  episodeType: episodeTypeSchema,
  /** 작가만 보는 시점 표시. 비우면 쓰지 않는다. */
  pointOfView: z.string().trim().max(30, "시점은 30자 이하로 입력해 주세요."),
});
export type EpisodeMetaInput = z.infer<typeof episodeMetaInputSchema>;

export const writingStageInputSchema = z.object({ stage: writingStageSchema });
export type WritingStageInput = z.infer<typeof writingStageInputSchema>;

export const episodeVersionInputSchema = z.object({
  label: z.string().trim().max(40, "버전 이름은 40자 이하로 입력해 주세요.").nullable(),
});
export type EpisodeVersionInput = z.infer<typeof episodeVersionInputSchema>;

export const NOTE_KINDS = ["SETTING", "MEMO"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const noteInputSchema = z.object({
  kind: z.enum(NOTE_KINDS),
  category: z.string().trim().max(20, "분류는 20자 이하로 입력해 주세요."),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(60, "제목은 60자 이하로 입력해 주세요."),
  aliases: z
    .array(z.string().trim().min(1).max(30, "다른 이름은 30자 이하로 입력해 주세요."))
    .max(10, "다른 이름은 10개까지 입력할 수 있습니다.")
    .transform((aliases) => [...new Set(aliases)]),
  /** 나이, 소속처럼 이름과 값으로 정리하는 속성. 보내지 않으면 고칠 때 기존 값을 그대로 둔다. */
  properties: z
    .array(
      z.strictObject({
        name: z.string().trim().min(1, "속성 이름을 입력해 주세요.").max(20, "속성 이름은 20자 이하로 입력해 주세요."),
        value: z.string().trim().max(200, "속성 값은 200자 이하로 입력해 주세요."),
      }),
    )
    .max(MAX_NOTE_PROPERTIES, `속성은 ${MAX_NOTE_PROPERTIES}개까지 입력할 수 있습니다.`)
    .optional(),
  body: z.string().max(20_000, "내용은 20,000자 이하로 입력해 주세요."),
  /** 회차별 메모일 때만 값이 있다. */
  episodeId: z.uuid().nullable(),
});
export type NoteInput = z.input<typeof noteInputSchema>;

export const foreshadowInputSchema = z.object({
  title: z.string().trim().min(1, "복선 이름을 입력해 주세요.").max(60, "복선 이름은 60자 이하로 입력해 주세요."),
  body: z.string().trim().max(2000, "내용은 2,000자 이하로 입력해 주세요."),
  plantedEpisodeId: z.uuid().nullable(),
  /** 값이 있으면 회수한 복선이다. */
  resolvedEpisodeId: z.uuid().nullable(),
});
export type ForeshadowInput = z.infer<typeof foreshadowInputSchema>;

export const workSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "검색어를 입력해 주세요.").max(50, "검색어는 50자 이하로 입력해 주세요."),
});

export const addCartItemSchema = z.union([
  z.strictObject({ kind: z.literal("EPISODES"), workId: z.uuid(), episodeIds: z.array(z.uuid()).min(1).max(200) }),
  z.strictObject({ kind: z.literal("WORK"), workId: z.uuid() }),
]);
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const ratingInputSchema = z.object({ score: z.number().int().min(1).max(5) });
export type RatingInput = z.infer<typeof ratingInputSchema>;

/** publishAt이 있으면 그 시각에 독자에게 보이는 예약 공개다. */
export const publishInputSchema = z.object({ publishAt: z.iso.datetime().optional() }).default({});
export type PublishInput = z.infer<typeof publishInputSchema>;

export const moveEpisodeSchema = z.object({ direction: z.enum(["up", "down"]) });
export type MoveEpisodeInput = z.infer<typeof moveEpisodeSchema>;

export const commentInputSchema = z.object({
  body: z.string().trim().min(1, "댓글 내용을 입력해 주세요.").max(500, "댓글은 500자 이하로 입력해 주세요."),
  /** 답글이면 이어 쓸 댓글. 답글의 답글은 같은 묶음에 이어 붙인다. */
  parentId: z.uuid().nullish(),
});

export const COMMENT_SORTS = ["latest", "likes"] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];
export const commentQuerySchema = z.object({ sort: z.enum(COMMENT_SORTS).default("latest") });
export type CommentInput = z.infer<typeof commentInputSchema>;

export const checkoutSchema = z.object({ idempotencyKey: z.uuid() });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const chargeSchema = z.object({
  amount: z.union(COIN_PACKAGES.map((v) => z.literal(v))),
  idempotencyKey: z.uuid(),
});
export type ChargeInput = z.infer<typeof chargeSchema>;
