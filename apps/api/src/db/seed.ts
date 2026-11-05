import { countChars, docFromText } from "@raon/contracts";
import { sql } from "drizzle-orm";
import { hashPassword } from "../auth/password.js";
import type { Database } from "./database.js";
import { episodes, users, works } from "./schema.js";
import { DEMO_PASSWORD, DEMO_USERS, DEMO_WORKS } from "./seed-data.js";

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
    const idOf = new Map(created.map((user) => [user.email, user.id]));

    for (const [workIndex, demo] of DEMO_WORKS.entries()) {
      const { author, freeCount, episodes: demoEpisodes, ...fields } = demo;
      const [work] = await tx
        .insert(works)
        .values({ ...fields, authorId: idOf.get(author)! })
        .returning({ id: works.id });

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
  });
}
