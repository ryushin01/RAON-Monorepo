import { randomUUID } from "node:crypto";
import { countChars, docFromText } from "@raon/contracts";
import { and, eq, sql } from "drizzle-orm";
import { hashPassword } from "../auth/password.js";
import type { Database } from "./database.js";
import {
  coinLedger,
  comments,
  episodes,
  favorites,
  orderItems,
  orders,
  ratings,
  readingProgress,
  users,
  works,
} from "./schema.js";
import {
  DEMO_COMMENTS,
  DEMO_FAVORITES,
  DEMO_PASSWORD,
  DEMO_PROGRESS,
  DEMO_PURCHASES,
  DEMO_RATINGS,
  DEMO_SCHEDULED,
  DEMO_TAGS,
  DEMO_USERS,
  DEMO_WORKS,
} from "./seed-data.js";

const DAY = 24 * 60 * 60 * 1000;

/** DB가 비어 있을 때만 가상 데이터를 넣는다. */
export async function seedDemoData(db: Database, now = new Date()): Promise<void> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if ((row?.count ?? 0) > 0) return;

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.transaction(async (tx) => {
    const created = await tx
      .insert(users)
      .values(DEMO_USERS.map((user) => ({ ...user, passwordHash })))
      .returning({ id: users.id, email: users.email });
    const userId = (email: string) => created.find((user) => user.email === email)!.id;

    const workIds = new Map<string, string>();
    for (const [workIndex, demo] of DEMO_WORKS.entries()) {
      const { author, freeCount, episodes: demoEpisodes, ...fields } = demo;
      const [work] = await tx
        .insert(works)
        .values({ ...fields, tags: DEMO_TAGS[demo.title] ?? [], authorId: userId(author) })
        .returning({ id: works.id });
      workIds.set(demo.title, work!.id);

      await tx.insert(episodes).values(
        demoEpisodes.map((episode, index) => {
          const content = docFromText(episode.body);
          const daysAgo = workIndex + (demoEpisodes.length - index) * 2;
          return {
            workId: work!.id,
            number: index + 1,
            title: episode.title,
            content,
            charCount: countChars(content),
            isFree: index < freeCount,
            status: "PUBLISHED" as const,
            publishedAt: new Date(now.getTime() - daysAgo * DAY),
          };
        }),
      );
    }

    const workId = (title: string) => workIds.get(title)!;
    const episodeOf = async (title: string, number: number) => {
      const [episode] = await tx
        .select({ id: episodes.id })
        .from(episodes)
        .where(and(eq(episodes.workId, workId(title)), eq(episodes.number, number)));
      return episode!.id;
    };

    const [{ last } = { last: 0 }] = await tx
      .select({ last: sql<number>`max(${episodes.number})::int` })
      .from(episodes)
      .where(eq(episodes.workId, workId(DEMO_SCHEDULED.work)));
    const scheduled = docFromText(DEMO_SCHEDULED.body);
    await tx.insert(episodes).values({
      workId: workId(DEMO_SCHEDULED.work),
      number: last + 1,
      title: DEMO_SCHEDULED.title,
      content: scheduled,
      charCount: countChars(scheduled),
      status: "PUBLISHED",
      publishedAt: new Date(now.getTime() + DEMO_SCHEDULED.inDays * DAY),
    });

    await tx
      .insert(ratings)
      .values(DEMO_RATINGS.map((r) => ({ userId: userId(r.user), workId: workId(r.work), score: r.score })));
    await tx.insert(favorites).values(DEMO_FAVORITES.map((f) => ({ userId: userId(f.user), workId: workId(f.work) })));
    await tx
      .insert(readingProgress)
      .values(
        DEMO_PROGRESS.map((p) => ({ userId: userId(p.user), workId: workId(p.work), episodeNumber: p.episodeNumber })),
      );

    for (const [index, comment] of DEMO_COMMENTS.entries()) {
      await tx.insert(comments).values({
        episodeId: await episodeOf(comment.work, comment.episodeNumber),
        userId: userId(comment.user),
        body: comment.body,
        createdAt: new Date(now.getTime() - (DEMO_COMMENTS.length - index) * 60 * 60 * 1000),
      });
    }

    for (const purchase of DEMO_PURCHASES) {
      const buyer = userId(purchase.user);
      const work = DEMO_WORKS.find((w) => w.title === purchase.work)!;
      const [order] = await tx
        .insert(orders)
        .values({ userId: buyer, idempotencyKey: randomUUID(), total: work.episodePrice })
        .returning({ id: orders.id });
      await tx.insert(orderItems).values({
        orderId: order!.id,
        userId: buyer,
        workId: workId(purchase.work),
        episodeId: await episodeOf(purchase.work, purchase.episodeNumber),
        price: work.episodePrice,
      });
      await tx.insert(coinLedger).values({ userId: buyer, amount: -work.episodePrice, reason: "PURCHASE" });
    }
  });
}
