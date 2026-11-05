import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  countChars,
  type EpisodeInput,
  type StudioEpisode,
  type StudioWork,
  type StudioWorkDetail,
  type WorkInput,
} from "@raon/contracts";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/database.js";
import { DB } from "../db/database.module.js";
import { episodes, orderItems, works } from "../db/schema.js";

const countOf = (status: "PUBLISHED" | "DRAFT") =>
  // 단일 테이블 조회에서 Drizzle은 컬럼을 테이블 없이 출력하므로, 서브쿼리에서는 테이블명을 직접 적는다.
  sql<number>`(select count(*)::int from "episodes" e where e."work_id" = "works"."id" and e."status" = ${status})`;

const workColumns = {
  id: works.id,
  title: works.title,
  genre: works.genre,
  status: works.status,
  synopsis: works.synopsis,
  episodePrice: works.episodePrice,
  wholePrice: works.wholePrice,
  viewCount: works.viewCount,
  publishedEpisodeCount: countOf("PUBLISHED"),
  draftEpisodeCount: countOf("DRAFT"),
  updatedAt: works.updatedAt,
};

type WorkRow = Omit<StudioWork, "updatedAt"> & { updatedAt: Date };
const toWork = (row: WorkRow): StudioWork => ({ ...row, updatedAt: row.updatedAt.toISOString() });

const toEpisode = (row: typeof episodes.$inferSelect): StudioEpisode => ({
  id: row.id,
  workId: row.workId,
  number: row.number,
  title: row.title,
  status: row.status,
  isFree: row.isFree,
  charCount: row.charCount,
  content: row.content,
  authorNote: row.authorNote,
  updatedAt: row.updatedAt.toISOString(),
  publishedAt: row.publishedAt?.toISOString() ?? null,
});

@Injectable()
export class StudioService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listWorks(authorId: string): Promise<StudioWork[]> {
    const rows = await this.db
      .select(workColumns)
      .from(works)
      .where(eq(works.authorId, authorId))
      .orderBy(desc(works.updatedAt));
    return rows.map(toWork);
  }

  async getWork(authorId: string, workId: string): Promise<StudioWorkDetail> {
    const [row] = await this.db
      .select(workColumns)
      .from(works)
      .where(and(eq(works.id, workId), eq(works.authorId, authorId)));
    if (!row) throw new NotFoundException("작품을 찾을 수 없습니다.");
    const list = await this.db.select().from(episodes).where(eq(episodes.workId, workId)).orderBy(asc(episodes.number));
    return {
      ...toWork(row),
      episodes: list.map(({ id, number, title, status, isFree, charCount, updatedAt, publishedAt }) => ({
        id,
        number,
        title,
        status,
        isFree,
        charCount,
        updatedAt: updatedAt.toISOString(),
        publishedAt: publishedAt?.toISOString() ?? null,
      })),
    };
  }

  async createWork(authorId: string, input: WorkInput): Promise<StudioWorkDetail> {
    const [row] = await this.db
      .insert(works)
      .values({ ...input, authorId })
      .returning({ id: works.id });
    return this.getWork(authorId, row!.id);
  }

  async updateWork(authorId: string, workId: string, input: WorkInput): Promise<StudioWorkDetail> {
    await this.assertOwner(authorId, workId);
    await this.db
      .update(works)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(works.id, workId));
    return this.getWork(authorId, workId);
  }

  async setWorkStatus(authorId: string, workId: string, status: "ONGOING" | "COMPLETED"): Promise<StudioWorkDetail> {
    const work = await this.getWork(authorId, workId);
    if (work.publishedEpisodeCount === 0) {
      throw new BadRequestException("공개한 회차가 있어야 작품 상태를 바꿀 수 있습니다.");
    }
    await this.db.update(works).set({ status, updatedAt: new Date() }).where(eq(works.id, workId));
    return this.getWork(authorId, workId);
  }

  async createEpisode(authorId: string, workId: string, input: EpisodeInput): Promise<StudioEpisode> {
    await this.assertOwner(authorId, workId);
    return this.db.transaction(async (tx) => {
      // 같은 작품에 회차를 동시에 만들어도 번호가 겹치지 않게 작품 행을 잠근다.
      await tx.select({ id: works.id }).from(works).where(eq(works.id, workId)).for("update");
      const [{ next } = { next: 1 }] = await tx
        .select({ next: sql<number>`coalesce(max(${episodes.number}), 0)::int + 1` })
        .from(episodes)
        .where(eq(episodes.workId, workId));
      const [row] = await tx
        .insert(episodes)
        .values({ ...input, workId, number: next, charCount: countChars(input.content) })
        .returning();
      return toEpisode(row!);
    });
  }

  async getEpisode(authorId: string, episodeId: string): Promise<StudioEpisode> {
    return toEpisode(await this.ownedEpisode(authorId, episodeId));
  }

  async saveEpisode(authorId: string, episodeId: string, input: EpisodeInput): Promise<StudioEpisode> {
    const current = await this.ownedEpisode(authorId, episodeId);
    if (current.status === "PUBLISHED") this.assertPublishable(input);
    const [row] = await this.db
      .update(episodes)
      .set({ ...input, charCount: countChars(input.content), updatedAt: new Date() })
      .where(eq(episodes.id, episodeId))
      .returning();
    return toEpisode(row!);
  }

  async publishEpisode(authorId: string, episodeId: string): Promise<StudioEpisode> {
    const current = await this.ownedEpisode(authorId, episodeId);
    this.assertPublishable({ content: current.content });
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(episodes)
        .set({ status: "PUBLISHED", publishedAt: current.publishedAt ?? new Date(), updatedAt: new Date() })
        .where(eq(episodes.id, episodeId))
        .returning();
      // 첫 회차를 공개하면 작품도 목록에 나온다.
      await tx
        .update(works)
        .set({
          status: sql`case when ${works.status} = 'DRAFT' then 'ONGOING'::work_status else ${works.status} end`,
          updatedAt: new Date(),
        })
        .where(eq(works.id, current.workId));
      return toEpisode(row!);
    });
  }

  async unpublishEpisode(authorId: string, episodeId: string): Promise<StudioEpisode> {
    const current = await this.ownedEpisode(authorId, episodeId);
    const [sold] = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.episodeId, episodeId))
      .limit(1);
    if (sold) throw new ConflictException("이미 판매한 회차는 비공개로 바꿀 수 없습니다.");
    const [row] = await this.db
      .update(episodes)
      .set({ status: "DRAFT", updatedAt: new Date() })
      .where(eq(episodes.id, current.id))
      .returning();
    return toEpisode(row!);
  }

  private assertPublishable(input: Pick<EpisodeInput, "content">) {
    if (countChars(input.content) === 0) throw new BadRequestException("본문을 쓴 뒤에 공개할 수 있습니다.");
  }

  private async assertOwner(authorId: string, workId: string) {
    const [row] = await this.db
      .select({ id: works.id })
      .from(works)
      .where(and(eq(works.id, workId), eq(works.authorId, authorId)));
    if (!row) throw new NotFoundException("작품을 찾을 수 없습니다.");
  }

  private async ownedEpisode(authorId: string, episodeId: string) {
    const [row] = await this.db
      .select({ episode: episodes })
      .from(episodes)
      .innerJoin(works, eq(episodes.workId, works.id))
      .where(and(eq(episodes.id, episodeId), eq(works.authorId, authorId)));
    if (!row) throw new NotFoundException("회차를 찾을 수 없습니다.");
    return row.episode;
  }
}
