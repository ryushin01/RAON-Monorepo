import { NotFoundException } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../db/database.js";
import { episodes, works } from "../db/schema.js";

/** 작가 본인의 지우지 않은 작품인지 확인한다. 남의 작품이면 있는지도 알리지 않도록 없는 작품과 같은 404를 낸다. */
export async function assertWorkOwner(db: Database, authorId: string, workId: string) {
  const [row] = await db
    .select({ id: works.id })
    .from(works)
    .where(and(eq(works.id, workId), eq(works.authorId, authorId), isNull(works.deletedAt)));
  if (!row) throw new NotFoundException("작품을 찾을 수 없습니다.");
}

/** 작가 본인 작품의 지우지 않은 회차와 그 작품의 형식. 없거나 남의 회차면 404를 낸다. */
export async function findOwnedEpisode(db: Database, authorId: string, episodeId: string) {
  const [row] = await db
    .select({ episode: episodes, format: works.format })
    .from(episodes)
    .innerJoin(works, eq(episodes.workId, works.id))
    .where(
      and(
        eq(episodes.id, episodeId),
        eq(works.authorId, authorId),
        isNull(episodes.deletedAt),
        isNull(works.deletedAt),
      ),
    );
  if (!row) throw new NotFoundException("회차를 찾을 수 없습니다.");
  return row;
}
