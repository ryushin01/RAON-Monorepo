import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Foreshadow, ForeshadowInput } from "@raon/contracts";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { isForeignKeyViolation } from "../common/db-errors.js";
import type { Database } from "../db/database.js";
import { DB } from "../db/database.module.js";
import { episodes, foreshadows, works } from "../db/schema.js";

const MAX_FORESHADOWS = 200;

const toForeshadow = (row: typeof foreshadows.$inferSelect): Foreshadow => ({
  id: row.id,
  workId: row.workId,
  title: row.title,
  body: row.body,
  plantedEpisodeId: row.plantedEpisodeId,
  resolvedEpisodeId: row.resolvedEpisodeId,
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class ForeshadowsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(authorId: string, workId: string): Promise<Foreshadow[]> {
    await this.assertOwner(authorId, workId);
    const rows = await this.db
      .select()
      .from(foreshadows)
      .where(eq(foreshadows.workId, workId))
      .orderBy(asc(foreshadows.createdAt), asc(foreshadows.id));
    return rows.map(toForeshadow);
  }

  async create(authorId: string, workId: string, input: ForeshadowInput): Promise<Foreshadow> {
    await this.assertOwner(authorId, workId);
    await this.assertEpisodes(workId, input);
    return this.linked(() =>
      this.db.transaction(async (tx) => {
        // 동시에 만들어도 개수 제한을 넘지 않도록 작품 행을 잠근 뒤 센다.
        await tx.select({ id: works.id }).from(works).where(eq(works.id, workId)).for("update");
        const [{ count } = { count: 0 }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(foreshadows)
          .where(eq(foreshadows.workId, workId));
        if (count >= MAX_FORESHADOWS) {
          throw new ConflictException(`복선은 작품마다 ${MAX_FORESHADOWS}개까지 만들 수 있습니다.`);
        }
        const [row] = await tx
          .insert(foreshadows)
          .values({ ...input, workId })
          .returning();
        return toForeshadow(row!);
      }),
    );
  }

  async update(authorId: string, id: string, input: ForeshadowInput): Promise<Foreshadow> {
    const current = await this.owned(authorId, id);
    await this.assertEpisodes(current.workId, input);
    return this.linked(async () => {
      const [row] = await this.db
        .update(foreshadows)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(foreshadows.id, id))
        .returning();
      if (!row) throw new NotFoundException("복선을 찾을 수 없습니다.");
      return toForeshadow(row);
    });
  }

  async remove(authorId: string, id: string): Promise<void> {
    await this.owned(authorId, id);
    await this.db.delete(foreshadows).where(eq(foreshadows.id, id));
  }

  /** 휴지통의 회차도 복원할 수 있으므로 연결을 유지한다. 다른 작품의 회차만 막는다. */
  private async assertEpisodes(workId: string, input: ForeshadowInput) {
    const ids = [...new Set([input.plantedEpisodeId, input.resolvedEpisodeId].filter((id) => id !== null))];
    if (!ids.length) return;
    const rows = await this.db
      .select({ id: episodes.id })
      .from(episodes)
      .where(and(eq(episodes.workId, workId), inArray(episodes.id, ids)));
    if (rows.length !== ids.length) throw new BadRequestException("이 작품의 회차가 아닙니다.");
  }

  /** 확인과 저장 사이에 회차를 완전히 지우면 외래 키가 막는다. */
  private async linked<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new BadRequestException("이 작품의 회차가 아닙니다.");
      throw error;
    }
  }

  private async assertOwner(authorId: string, workId: string) {
    const [row] = await this.db
      .select({ id: works.id })
      .from(works)
      .where(and(eq(works.id, workId), eq(works.authorId, authorId), isNull(works.deletedAt)));
    if (!row) throw new NotFoundException("작품을 찾을 수 없습니다.");
  }

  private async owned(authorId: string, id: string) {
    const [row] = await this.db
      .select({ foreshadow: foreshadows })
      .from(foreshadows)
      .innerJoin(works, eq(foreshadows.workId, works.id))
      .where(and(eq(foreshadows.id, id), eq(works.authorId, authorId), isNull(works.deletedAt)));
    if (!row) throw new NotFoundException("복선을 찾을 수 없습니다.");
    return row.foreshadow;
  }
}
