import type { EpisodeDoc } from "@raon/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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

export const roleEnum = pgEnum("role", ["READER", "AUTHOR"]);
export const genreEnum = pgEnum("genre", ["FANTASY", "MARTIAL", "ROMANCE", "MODERN", "SF", "MYSTERY"]);
export const workStatusEnum = pgEnum("work_status", ["DRAFT", "ONGOING", "COMPLETED"]);
export const episodeStatusEnum = pgEnum("episode_status", ["DRAFT", "PUBLISHED"]);
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
