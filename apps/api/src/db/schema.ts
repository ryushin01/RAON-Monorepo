import type { EpisodeDoc } from "@raon/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });

export const roleEnum = pgEnum("role", ["READER", "AUTHOR"]);
export const genreEnum = pgEnum("genre", ["FANTASY", "MARTIAL", "ROMANCE", "MODERN", "SF", "MYSTERY"]);
export const workStatusEnum = pgEnum("work_status", ["DRAFT", "ONGOING", "COMPLETED"]);
export const episodeStatusEnum = pgEnum("episode_status", ["DRAFT", "PUBLISHED"]);
export const episodeVersionKindEnum = pgEnum("episode_version_kind", ["AUTO", "MANUAL"]);
export const coinReasonEnum = pgEnum("coin_reason", ["CHARGE", "PURCHASE"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    nickname: text("nickname").notNull().unique(),
    role: roleEnum("role").notNull(),
    coinBalance: integer("coin_balance").notNull().default(0),
    ...timestamps,
  },
  (t) => [check("users_coin_balance_non_negative", sql`${t.coinBalance} >= 0`)],
);

export const works = pgTable(
  "works",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    synopsis: text("synopsis").notNull(),
    genre: genreEnum("genre").notNull(),
    status: workStatusEnum("status").notNull().default("DRAFT"),
    episodePrice: integer("episode_price").notNull(),
    wholePrice: integer("whole_price"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    viewCount: integer("view_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("works_author_idx").on(t.authorId), index("works_status_genre_idx").on(t.status, t.genre)],
);

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<EpisodeDoc>().notNull(),
    authorNote: text("author_note"),
    charCount: integer("char_count").notNull().default(0),
    isFree: boolean("is_free").notNull().default(false),
    status: episodeStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("episodes_work_number_uq").on(t.workId, t.number)],
);

/** 회차의 지난 내용. 가격과 공개 상태는 판매와 맞물리므로 담지 않고 원고만 담는다. */
export const episodeVersions = pgTable(
  "episode_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    kind: episodeVersionKindEnum("kind").notNull(),
    label: text("label"),
    title: text("title").notNull(),
    content: jsonb("content").$type<EpisodeDoc>().notNull(),
    authorNote: text("author_note"),
    charCount: integer("char_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("episode_versions_episode_created_idx").on(t.episodeId, t.createdAt)],
);

/** episodeId가 없으면 작품 전체를 담은 항목이다. */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("cart_episode_uq").on(t.userId, t.episodeId).where(sql`${t.episodeId} is not null`),
    uniqueIndex("cart_work_uq").on(t.userId, t.workId).where(sql`${t.episodeId} is null`),
  ],
);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  /** 같은 키로 다시 보내면 새로 결제하지 않고 처음 주문을 돌려준다. */
  idempotencyKey: uuid("idempotency_key").notNull().unique(),
  total: integer("total").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 구매 권리의 근거. 가격은 구매 당시 값으로 남긴다. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id),
    episodeId: uuid("episode_id").references(() => episodes.id),
    price: integer("price").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("order_items_episode_uq").on(t.userId, t.episodeId).where(sql`${t.episodeId} is not null`),
    uniqueIndex("order_items_work_uq").on(t.userId, t.workId).where(sql`${t.episodeId} is null`),
  ],
);

export const coinLedger = pgTable("coin_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  amount: integer("amount").notNull(),
  reason: coinReasonEnum("reason").notNull(),
  idempotencyKey: uuid("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 선호작 */
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workId] }), index("favorites_work_idx").on(t.workId)],
);

/** 작품별로 마지막에 읽은 회차. 이어 보기에 쓴다. */
export const readingProgress = pgTable(
  "reading_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    episodeNumber: integer("episode_number").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workId] })],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_episode_idx").on(t.episodeId, t.createdAt)],
);

export const ratings = pgTable(
  "ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.workId] }),
    index("ratings_work_idx").on(t.workId),
    check("ratings_score_range", sql`${t.score} between 1 and 5`),
  ],
);

/** 표지 이미지. 파일 서버 없이 로컬에서 실행되도록 DB에 둔다. */
export const workCovers = pgTable("work_covers", {
  workId: uuid("work_id")
    .primaryKey()
    .references(() => works.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
