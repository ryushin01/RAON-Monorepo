import { isDeepStrictEqual } from "node:util";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  countChars,
  type EpisodeInput,
  type EpisodeVersion,
  type EpisodeVersionSummary,
  type StudioEpisode,
  type StudioWork,
  type StudioWorkDetail,
  type WorkInput,
} from "@raon/contracts";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { isForeignKeyViolation } from "../common/db-errors.js";
import { detectImageType } from "../common/image.js";
import type { Database } from "../db/database.js";
import { DB } from "../db/database.module.js";
import { episodes, episodeVersions, orderItems, workCovers, works } from "../db/schema.js";

/** 자동 버전은 이 간격마다 하나만 남긴다. 초안은 입력이 멈출 때마다 저장되기 때문이다. */
export const AUTO_VERSION_INTERVAL_MS = 10 * 60 * 1000;
const MAX_AUTO_VERSIONS = 30;
const MAX_MANUAL_VERSIONS = 50;

type VersionRow = typeof episodeVersions.$inferSelect;

const toVersionSummary = (row: Omit<VersionRow, "content" | "authorNote" | "episodeId">): EpisodeVersionSummary => ({
  id: row.id,
  kind: row.kind,
  label: row.label,
  title: row.title,
  charCount: row.charCount,
  createdAt: row.createdAt.toISOString(),
});

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
  salesCount: sql<number>`(select count(*)::int from "order_items" o where o."work_id" = "works"."id")`,
  salesCoins: sql<number>`(select coalesce(sum(o."price"), 0)::int from "order_items" o where o."work_id" = "works"."id")`,
  tags: works.tags,
  coverUpdatedAt: sql<
    string | Date | null
  >`(select c."updated_at" from "work_covers" c where c."work_id" = "works"."id")`,
  favoriteCount: sql<number>`(select count(*)::int from "favorites" f where f."work_id" = "works"."id")`,
  updatedAt: works.updatedAt,
};

type WorkRow = Omit<StudioWork, "updatedAt" | "coverUpdatedAt"> & {
  updatedAt: Date;
  coverUpdatedAt: string | Date | null;
};
const toWork = (row: WorkRow): StudioWork => ({
  ...row,
  updatedAt: row.updatedAt.toISOString(),
  coverUpdatedAt: row.coverUpdatedAt ? new Date(row.coverUpdatedAt).toISOString() : null,
});

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
    // 예약만 걸린 회차는 아직 공개한 것이 아니다.
    const now = Date.now();
    const visible = work.episodes.some(
      (episode) =>
        episode.status === "PUBLISHED" && episode.publishedAt !== null && Date.parse(episode.publishedAt) <= now,
    );
    if (!visible) {
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
    return this.db.transaction(async (tx) => {
      await this.snapshotBeforeSave(tx, current, input);
      const [row] = await tx
        .update(episodes)
        .set({ ...input, charCount: countChars(input.content), updatedAt: new Date() })
        .where(eq(episodes.id, episodeId))
        .returning();
      return toEpisode(row!);
    });
  }

  /** 덮어쓰기 전의 원고를 남긴다. 빈 원고나 바뀌지 않은 저장은 남기지 않는다. */
  private async snapshotBeforeSave(
    tx: Pick<Database, "select" | "insert" | "delete">,
    current: typeof episodes.$inferSelect,
    input: EpisodeInput,
  ) {
    if (current.charCount === 0) return;
    const unchanged =
      current.title === input.title &&
      current.authorNote === input.authorNote &&
      // jsonb는 키 순서를 바꿔 저장하므로 문자열로 비교하면 같은 원고도 다르게 나온다.
      isDeepStrictEqual(current.content, input.content);
    if (unchanged) return;
    const [latest] = await tx
      .select({ createdAt: episodeVersions.createdAt })
      .from(episodeVersions)
      .where(and(eq(episodeVersions.episodeId, current.id), eq(episodeVersions.kind, "AUTO")))
      .orderBy(desc(episodeVersions.createdAt))
      .limit(1);
    if (latest && Date.now() - latest.createdAt.getTime() < AUTO_VERSION_INTERVAL_MS) return;
    await this.insertVersion(tx, current, "AUTO", null);
    const stale = await tx
      .select({ id: episodeVersions.id })
      .from(episodeVersions)
      .where(and(eq(episodeVersions.episodeId, current.id), eq(episodeVersions.kind, "AUTO")))
      .orderBy(desc(episodeVersions.createdAt))
      .offset(MAX_AUTO_VERSIONS);
    if (stale.length) {
      await tx.delete(episodeVersions).where(
        inArray(
          episodeVersions.id,
          stale.map((row) => row.id),
        ),
      );
    }
  }

  private async insertVersion(
    tx: Pick<Database, "insert">,
    episode: typeof episodes.$inferSelect,
    kind: "AUTO" | "MANUAL",
    label: string | null,
  ) {
    const [row] = await tx
      .insert(episodeVersions)
      .values({
        episodeId: episode.id,
        kind,
        label,
        title: episode.title,
        content: episode.content,
        authorNote: episode.authorNote,
        charCount: episode.charCount,
      })
      .returning();
    return row!;
  }

  async listVersions(authorId: string, episodeId: string): Promise<EpisodeVersionSummary[]> {
    await this.ownedEpisode(authorId, episodeId);
    const rows = await this.db
      .select({
        id: episodeVersions.id,
        kind: episodeVersions.kind,
        label: episodeVersions.label,
        title: episodeVersions.title,
        charCount: episodeVersions.charCount,
        createdAt: episodeVersions.createdAt,
      })
      .from(episodeVersions)
      .where(eq(episodeVersions.episodeId, episodeId))
      .orderBy(desc(episodeVersions.createdAt), desc(episodeVersions.id));
    return rows.map(toVersionSummary);
  }

  async createVersion(authorId: string, episodeId: string, label: string | null): Promise<EpisodeVersionSummary> {
    const current = await this.ownedEpisode(authorId, episodeId);
    const [{ count } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(episodeVersions)
      .where(and(eq(episodeVersions.episodeId, episodeId), eq(episodeVersions.kind, "MANUAL")));
    if (count >= MAX_MANUAL_VERSIONS) {
      throw new ConflictException(`직접 남긴 버전은 ${MAX_MANUAL_VERSIONS}개까지입니다. 필요 없는 버전을 지워 주세요.`);
    }
    return toVersionSummary(await this.insertVersion(this.db, current, "MANUAL", label || null));
  }

  async getVersion(authorId: string, episodeId: string, versionId: string): Promise<EpisodeVersion> {
    await this.ownedEpisode(authorId, episodeId);
    const row = await this.versionOf(episodeId, versionId);
    return { ...toVersionSummary(row), content: row.content, authorNote: row.authorNote };
  }

  /** 지금 원고를 버전으로 남긴 뒤 되돌린다. 복원도 복원할 수 있고, 가격과 공개 상태는 그대로다. */
  async restoreVersion(authorId: string, episodeId: string, versionId: string): Promise<StudioEpisode> {
    const current = await this.ownedEpisode(authorId, episodeId);
    const version = await this.versionOf(episodeId, versionId);
    if (current.status === "PUBLISHED") this.assertPublishable({ content: version.content });
    return this.db.transaction(async (tx) => {
      await this.insertVersion(tx, current, "AUTO", "복원 전");
      const [row] = await tx
        .update(episodes)
        .set({
          title: version.title,
          content: version.content,
          authorNote: version.authorNote,
          charCount: version.charCount,
          updatedAt: new Date(),
        })
        .where(eq(episodes.id, episodeId))
        .returning();
      return toEpisode(row!);
    });
  }

  async deleteVersion(authorId: string, episodeId: string, versionId: string): Promise<void> {
    await this.ownedEpisode(authorId, episodeId);
    await this.versionOf(episodeId, versionId);
    await this.db.delete(episodeVersions).where(eq(episodeVersions.id, versionId));
  }

  private async versionOf(episodeId: string, versionId: string): Promise<VersionRow> {
    const [row] = await this.db
      .select()
      .from(episodeVersions)
      .where(and(eq(episodeVersions.id, versionId), eq(episodeVersions.episodeId, episodeId)));
    if (!row) throw new NotFoundException("버전을 찾을 수 없습니다.");
    return row;
  }

  /** publishAt이 있으면 그 시각까지 독자에게 보이지 않는다. 예약 중인 회차는 바로 공개하거나 시각을 바꿀 수 있다. */
  async publishEpisode(authorId: string, episodeId: string, publishAt?: string): Promise<StudioEpisode> {
    const current = await this.ownedEpisode(authorId, episodeId);
    this.assertPublishable({ content: current.content });
    const now = new Date();
    const alreadyPublic = current.status === "PUBLISHED" && current.publishedAt !== null && current.publishedAt <= now;
    let publishedAt: Date;
    if (publishAt) {
      publishedAt = new Date(publishAt);
      if (publishedAt <= now) throw new BadRequestException("예약 시각은 지금보다 뒤여야 합니다.");
      if (alreadyPublic) throw new ConflictException("이미 공개한 회차는 예약할 수 없습니다.");
    } else {
      // 비공개로 내렸다가 다시 공개하면 처음 공개한 날짜를 유지한다.
      publishedAt = current.publishedAt && current.publishedAt <= now ? current.publishedAt : now;
    }
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(episodes)
        .set({ status: "PUBLISHED", publishedAt, updatedAt: now })
        .where(eq(episodes.id, episodeId))
        .returning();
      // 첫 회차를 공개하면 작품도 목록에 나온다.
      await tx
        .update(works)
        .set({
          status: sql`case when ${works.status} = 'DRAFT' then 'ONGOING'::work_status else ${works.status} end`,
          updatedAt: now,
        })
        .where(eq(works.id, current.workId));
      return toEpisode(row!);
    });
  }

  /** 바로 앞이나 뒤의 회차와 번호를 맞바꾼다. 구매와 댓글은 회차 id에 묶여 있어 그대로 유지된다. */
  async moveEpisode(authorId: string, episodeId: string, direction: "up" | "down"): Promise<void> {
    const { workId } = await this.ownedEpisode(authorId, episodeId);
    await this.db.transaction(async (tx) => {
      await tx.select({ id: works.id }).from(works).where(eq(works.id, workId)).for("update");
      // 동시에 옮기는 요청이 있어도 잠근 뒤의 번호로 이웃을 찾는다.
      const [current] = await tx
        .select({ id: episodes.id, number: episodes.number })
        .from(episodes)
        .where(eq(episodes.id, episodeId));
      if (!current) throw new NotFoundException("회차를 찾을 수 없습니다.");
      const [neighbor] = await tx
        .select({ id: episodes.id, number: episodes.number })
        .from(episodes)
        .where(
          and(
            eq(episodes.workId, workId),
            direction === "up" ? lt(episodes.number, current.number) : gt(episodes.number, current.number),
          ),
        )
        .orderBy(direction === "up" ? desc(episodes.number) : asc(episodes.number))
        .limit(1);
      if (!neighbor) throw new BadRequestException("더 옮길 수 없습니다.");
      // (작품, 번호) 유일 제약이 있어 임시 번호를 거쳐 맞바꾼다.
      await tx.update(episodes).set({ number: -1 }).where(eq(episodes.id, current.id));
      await tx.update(episodes).set({ number: current.number }).where(eq(episodes.id, neighbor.id));
      await tx.update(episodes).set({ number: neighbor.number }).where(eq(episodes.id, current.id));
    });
  }

  async setCover(authorId: string, workId: string, data: Uint8Array): Promise<StudioWorkDetail> {
    await this.assertOwner(authorId, workId);
    const mimeType = detectImageType(data);
    if (!mimeType) throw new BadRequestException("JPG, PNG, WebP 이미지만 올릴 수 있습니다.");
    const updatedAt = new Date();
    await this.db
      .insert(workCovers)
      .values({ workId, mimeType, data, updatedAt })
      .onConflictDoUpdate({ target: workCovers.workId, set: { mimeType, data, updatedAt } });
    return this.getWork(authorId, workId);
  }

  async deleteCover(authorId: string, workId: string): Promise<StudioWorkDetail> {
    await this.assertOwner(authorId, workId);
    await this.db.delete(workCovers).where(eq(workCovers.workId, workId));
    return this.getWork(authorId, workId);
  }

  async unpublishEpisode(authorId: string, episodeId: string): Promise<StudioEpisode> {
    const current = await this.ownedEpisode(authorId, episodeId);
    // 아직 공개하지 않은 예약 회차는 산 사람이 읽은 적이 없으므로 취소할 수 있다.
    const wasPublic = current.publishedAt !== null && current.publishedAt <= new Date();
    if (wasPublic && (await this.isSold(current.workId, episodeId))) {
      throw new ConflictException("이미 판매한 회차는 비공개로 바꿀 수 없습니다.");
    }
    const [row] = await this.db
      .update(episodes)
      .set({
        status: "DRAFT",
        publishedAt: current.publishedAt && current.publishedAt > new Date() ? null : current.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(episodes.id, current.id))
      .returning();
    return toEpisode(row!);
  }

  /** 쓰다 만 초안을 지운다. 공개한 적 없는 내용이므로 번호에 빈자리가 생겨도 독자에게 영향이 없다. */
  async deleteEpisode(authorId: string, episodeId: string): Promise<void> {
    const current = await this.ownedEpisode(authorId, episodeId);
    if (current.status === "PUBLISHED")
      throw new ConflictException("공개 중인 회차는 비공개로 바꾼 뒤 지울 수 있습니다.");
    if (current.publishedAt && (await this.isSold(current.workId, episodeId))) {
      throw new ConflictException("이미 판매한 회차는 지울 수 없습니다.");
    }
    await this.db.delete(episodes).where(eq(episodes.id, episodeId));
  }

  /** 판매 기록은 구매자의 권리이므로 판매한 작품은 지우지 않는다. */
  async deleteWork(authorId: string, workId: string): Promise<void> {
    await this.assertOwner(authorId, workId);
    const [sold] = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.workId, workId))
      .limit(1);
    if (sold) throw new ConflictException("판매 기록이 있는 작품은 지울 수 없습니다.");
    try {
      await this.db.delete(works).where(eq(works.id, workId));
    } catch (error) {
      // 확인과 삭제 사이에 결제가 끝나면 주문의 외래 키가 막는다.
      if (isForeignKeyViolation(error)) throw new ConflictException("판매 기록이 있는 작품은 지울 수 없습니다.");
      throw error;
    }
  }

  /** 회차를 직접 샀거나, 작품 전체를 산 사람이 있으면 판매한 것이다. */
  private async isSold(workId: string, episodeId: string): Promise<boolean> {
    const [sold] = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(and(eq(orderItems.workId, workId), or(eq(orderItems.episodeId, episodeId), isNull(orderItems.episodeId))))
      .limit(1);
    return Boolean(sold);
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
