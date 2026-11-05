import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  type EpisodeView,
  type Paginated,
  type PublicEpisode,
  type WorkAccess,
  type WorkDetail,
  type WorkSummary,
  type workQuerySchema,
} from "@raon/contracts";
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { AuthUser } from "../auth/auth.guard.js";
import type { Database } from "../db/database.js";
import { DB } from "../db/database.module.js";
import { cartItems, episodes, orderItems, users, works } from "../db/schema.js";

const publishedCount = sql<number>`(select count(*)::int from "episodes" e where e."work_id" = "works"."id" and e."status" = 'PUBLISHED')`;
const latestPublishedAt = sql<
  string | null
>`(select max(e."published_at") from "episodes" e where e."work_id" = "works"."id" and e."status" = 'PUBLISHED')`;

const summaryColumns = {
  id: works.id,
  title: works.title,
  authorName: users.nickname,
  genre: works.genre,
  status: works.status,
  synopsis: works.synopsis,
  viewCount: works.viewCount,
  episodeCount: publishedCount,
  latestEpisodeAt: latestPublishedAt,
};

const iso = (value: string | Date | null) => (value ? new Date(value).toISOString() : null);

/** LIKE의 특수문자를 일반 글자로 찾게 한다. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listWorks(query: z.output<typeof workQuerySchema>): Promise<Paginated<WorkSummary>> {
    const pattern = query.q ? `%${escapeLike(query.q)}%` : null;
    const where = and(
      ne(works.status, "DRAFT"),
      query.genre ? eq(works.genre, query.genre) : undefined,
      query.status ? eq(works.status, query.status) : undefined,
      pattern ? or(ilike(works.title, pattern), ilike(users.nickname, pattern)) : undefined,
    );

    const [rows, counted] = await Promise.all([
      this.db
        .select(summaryColumns)
        .from(works)
        .innerJoin(users, eq(works.authorId, users.id))
        .where(where)
        .orderBy(
          query.sort === "latest" ? sql`${latestPublishedAt} desc nulls last` : desc(works.viewCount),
          asc(works.id),
        )
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(works)
        .innerJoin(users, eq(works.authorId, users.id))
        .where(where),
    ]);

    return {
      items: rows.map((row) => ({ ...row, latestEpisodeAt: iso(row.latestEpisodeAt) })),
      page: query.page,
      pageSize: query.pageSize,
      total: counted[0]?.total ?? 0,
    };
  }

  async getWork(workId: string): Promise<WorkDetail> {
    const [row] = await this.db
      .select({ ...summaryColumns, episodePrice: works.episodePrice, wholePrice: works.wholePrice })
      .from(works)
      .innerJoin(users, eq(works.authorId, users.id))
      .where(and(eq(works.id, workId), ne(works.status, "DRAFT")));
    if (!row) throw new NotFoundException("작품을 찾을 수 없습니다.");

    const list = await this.db
      .select({
        id: episodes.id,
        number: episodes.number,
        title: episodes.title,
        isFree: episodes.isFree,
        charCount: episodes.charCount,
        publishedAt: episodes.publishedAt,
      })
      .from(episodes)
      .where(and(eq(episodes.workId, workId), eq(episodes.status, "PUBLISHED")))
      .orderBy(asc(episodes.number));

    return {
      ...row,
      latestEpisodeAt: iso(row.latestEpisodeAt),
      wholePrice: row.status === "COMPLETED" ? row.wholePrice : null,
      episodes: list.map((e): PublicEpisode => ({ ...e, publishedAt: iso(e.publishedAt) as string })),
    };
  }

  async getAccess(workId: string, user: AuthUser): Promise<WorkAccess> {
    const [owned, cart] = await Promise.all([
      this.db
        .select({ episodeId: orderItems.episodeId })
        .from(orderItems)
        .where(and(eq(orderItems.userId, user.id), eq(orderItems.workId, workId))),
      this.db
        .select({ episodeId: cartItems.episodeId })
        .from(cartItems)
        .where(and(eq(cartItems.userId, user.id), eq(cartItems.workId, workId))),
    ]);
    const ids = (rows: { episodeId: string | null }[]) => rows.flatMap((r) => (r.episodeId ? [r.episodeId] : []));
    return {
      ownsWork: owned.some((r) => r.episodeId === null),
      ownedEpisodeIds: ids(owned),
      workInCart: cart.some((r) => r.episodeId === null),
      cartEpisodeIds: ids(cart),
    };
  }

  /** 뷰어용 회차. 권한이 없으면 메타 정보만 돌려주고 본문은 절대 내려보내지 않는다. */
  async getEpisode(workId: string, number: number, user: AuthUser | undefined): Promise<EpisodeView> {
    const [row] = await this.db
      .select({
        episode: episodes,
        workTitle: works.title,
        authorId: works.authorId,
        authorName: users.nickname,
        price: works.episodePrice,
      })
      .from(episodes)
      .innerJoin(works, eq(episodes.workId, works.id))
      .innerJoin(users, eq(works.authorId, users.id))
      .where(
        and(
          eq(episodes.workId, workId),
          eq(episodes.number, number),
          eq(episodes.status, "PUBLISHED"),
          ne(works.status, "DRAFT"),
        ),
      );
    if (!row) throw new NotFoundException("회차를 찾을 수 없습니다.");

    const accessible = await this.canRead(row.episode, row.authorId, user);
    if (accessible) {
      await this.db
        .update(works)
        .set({ viewCount: sql`${works.viewCount} + 1` })
        .where(eq(works.id, workId));
    }

    const neighbors = await this.db
      .select({ number: episodes.number, title: episodes.title })
      .from(episodes)
      .where(
        and(
          eq(episodes.workId, workId),
          eq(episodes.status, "PUBLISHED"),
          inArray(episodes.number, [number - 1, number + 1]),
        ),
      );

    return {
      id: row.episode.id,
      workId,
      workTitle: row.workTitle,
      authorName: row.authorName,
      number,
      title: row.episode.title,
      isFree: row.episode.isFree,
      publishedAt: iso(row.episode.publishedAt) as string,
      prev: neighbors.find((n) => n.number === number - 1) ?? (await this.adjacent(workId, number, "prev")),
      next: neighbors.find((n) => n.number === number + 1) ?? (await this.adjacent(workId, number, "next")),
      accessible,
      price: row.episode.isFree ? 0 : row.price,
      content: accessible ? row.episode.content : null,
      authorNote: accessible ? row.episode.authorNote : null,
    };
  }

  /** 초안이 사이에 끼어 번호가 이어지지 않아도 앞뒤 공개 회차를 찾는다. */
  private async adjacent(workId: string, number: number, direction: "prev" | "next") {
    const [row] = await this.db
      .select({ number: episodes.number, title: episodes.title })
      .from(episodes)
      .where(
        and(
          eq(episodes.workId, workId),
          eq(episodes.status, "PUBLISHED"),
          direction === "prev" ? sql`${episodes.number} < ${number}` : sql`${episodes.number} > ${number}`,
        ),
      )
      .orderBy(direction === "prev" ? desc(episodes.number) : asc(episodes.number))
      .limit(1);
    return row ?? null;
  }

  private async canRead(
    episode: typeof episodes.$inferSelect,
    authorId: string,
    user: AuthUser | undefined,
  ): Promise<boolean> {
    if (episode.isFree) return true;
    if (!user) return false;
    if (user.id === authorId) return true;
    const [owned] = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.userId, user.id),
          eq(orderItems.workId, episode.workId),
          or(eq(orderItems.episodeId, episode.id), isNull(orderItems.episodeId)),
        ),
      )
      .limit(1);
    return Boolean(owned);
  }
}
