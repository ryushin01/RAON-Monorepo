import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  type CommentSort,
  type EpisodeCommentList,
  type EpisodeCommentReply,
  EpisodeView,
  FavoriteWork,
  type Paginated,
  type PublicEpisode,
  ReadingEntry,
  stripAuthorComments,
  type WorkAccess,
  type WorkBadge,
  type WorkDetail,
  type WorkSummary,
  type workQuerySchema,
} from "@raon/contracts";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { AuthUser } from "../auth/auth.guard.js";
import { isForeignKeyViolation } from "../common/db-errors.js";
import type { Database } from "../db/database.js";
import { DB } from "../db/database.module.js";
import {
  cartItems,
  commentLikes,
  comments,
  episodeImages,
  episodes,
  favorites,
  orderItems,
  ratings,
  readingProgress,
  users,
  workCovers,
  works,
} from "../db/schema.js";

/** 독자에게 보이는 작품: 공개했고 휴지통에 없다. 판매한 작품은 휴지통으로 옮길 수 없으므로 구매자의 권리는 그대로다. */
const publicWork = () => and(ne(works.status, "DRAFT"), isNull(works.deletedAt));

/** 독자에게 보이는 회차: 공개했고, 예약이라면 그 시각이 지났다. */
const VISIBLE = sql.raw(`e."status" = 'PUBLISHED' and e."published_at" <= now()`);
const visibleEpisode = () => and(eq(episodes.status, "PUBLISHED"), lte(episodes.publishedAt, sql`now()`));

/** 예약만 있고 아직 보이는 회차가 없는 작품은 독자에게 없는 작품으로 다룬다. */
const HAS_VISIBLE_EPISODE = sql`exists (select 1 from "episodes" e where e."work_id" = "works"."id" and ${VISIBLE})`;

const publishedCount = sql<number>`(select count(*)::int from "episodes" e where e."work_id" = "works"."id" and ${VISIBLE})`;
const firstEpisodeNumber = sql<
  number | null
>`(select min(e."number")::int from "episodes" e where e."work_id" = "works"."id" and ${VISIBLE})`;
const latestPublishedAt = sql<
  string | null
>`(select max(e."published_at") from "episodes" e where e."work_id" = "works"."id" and ${VISIBLE})`;
const firstPublishedAt = sql<
  string | null
>`(select min(e."published_at") from "episodes" e where e."work_id" = "works"."id" and ${VISIBLE})`;
const ratingAverage = sql<
  number | null
>`(select round(avg(r."score"), 1)::float8 from "ratings" r where r."work_id" = "works"."id")`;
const ratingCount = sql<number>`(select count(*)::int from "ratings" r where r."work_id" = "works"."id")`;
const coverUpdatedAt = sql<
  string | null
>`(select c."updated_at" from "work_covers" c where c."work_id" = "works"."id")`;

const summaryColumns = {
  id: works.id,
  format: works.format,
  title: works.title,
  authorName: users.nickname,
  genre: works.genre,
  status: works.status,
  synopsis: works.synopsis,
  viewCount: works.viewCount,
  tags: works.tags,
  episodeCount: publishedCount,
  firstEpisodeNumber,
  latestEpisodeAt: latestPublishedAt,
  firstPublishedAt,
  ratingAverage,
  ratingCount,
  coverUpdatedAt,
};

const HOT_VIEW_COUNT = 30_000;
const NEW_WITHIN_DAYS = 14;
const UP_WITHIN_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function badgesOf(viewCount: number, first: string | null, latest: string | null, now = Date.now()): WorkBadge[] {
  const within = (value: string | null, days: number) =>
    value !== null && now - new Date(value).getTime() < days * DAY_MS;
  return [
    ...(viewCount >= HOT_VIEW_COUNT ? (["HOT"] as const) : []),
    ...(within(first, NEW_WITHIN_DAYS) ? (["NEW"] as const) : []),
    ...(within(latest, UP_WITHIN_DAYS) ? (["UP"] as const) : []),
  ];
}

interface SummaryRow {
  viewCount: number;
  firstPublishedAt: string | Date | null;
  latestEpisodeAt: string | Date | null;
  coverUpdatedAt: string | Date | null;
}

function toSummary<T extends SummaryRow>({ firstPublishedAt: first, ...row }: T) {
  const latestEpisodeAt = iso(row.latestEpisodeAt);
  return {
    ...row,
    latestEpisodeAt,
    coverUpdatedAt: iso(row.coverUpdatedAt),
    badges: badgesOf(row.viewCount, iso(first), latestEpisodeAt),
  };
}

const iso = (value: string | Date | null) => (value ? new Date(value).toISOString() : null);

/** LIKE의 특수문자를 일반 글자로 찾게 한다. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listWorks(query: z.output<typeof workQuerySchema>): Promise<Paginated<WorkSummary>> {
    const pattern = query.q ? `%${escapeLike(query.q)}%` : null;
    const where = and(
      publicWork(),
      HAS_VISIBLE_EPISODE,
      query.format ? eq(works.format, query.format) : undefined,
      query.tag ? sql`${query.tag} = any(${works.tags})` : undefined,
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
          query.sort === "latest"
            ? sql`${latestPublishedAt} desc nulls last`
            : query.sort === "rating"
              ? sql`${ratingAverage} desc nulls last`
              : desc(works.viewCount),
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
      items: rows.map(toSummary),
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
      .where(and(eq(works.id, workId), publicWork(), HAS_VISIBLE_EPISODE));
    if (!row) throw new NotFoundException("작품을 찾을 수 없습니다.");

    const list = await this.db
      .select({
        id: episodes.id,
        number: episodes.number,
        title: episodes.title,
        episodeType: episodes.episodeType,
        isFree: episodes.isFree,
        charCount: episodes.charCount,
        publishedAt: episodes.publishedAt,
      })
      .from(episodes)
      .where(and(eq(episodes.workId, workId), visibleEpisode()))
      .orderBy(asc(episodes.number));

    return {
      ...toSummary(row),
      wholePrice: row.status === "COMPLETED" ? row.wholePrice : null,
      episodes: list.map((e): PublicEpisode => ({ ...e, publishedAt: iso(e.publishedAt) as string })),
    };
  }

  async getAccess(workId: string, user: AuthUser): Promise<WorkAccess> {
    const [owned, cart] = await Promise.all([
      this.db
        .select({ episodeId: orderItems.episodeId, price: orderItems.price })
        .from(orderItems)
        .where(and(eq(orderItems.userId, user.id), eq(orderItems.workId, workId))),
      this.db
        .select({ episodeId: cartItems.episodeId })
        .from(cartItems)
        .where(and(eq(cartItems.userId, user.id), eq(cartItems.workId, workId))),
    ]);
    const ids = (rows: { episodeId: string | null }[]) => rows.flatMap((r) => (r.episodeId ? [r.episodeId] : []));
    const [[favorite], [progress], [work], [rating]] = await Promise.all([
      this.db
        .select({ workId: favorites.workId })
        .from(favorites)
        .where(and(eq(favorites.userId, user.id), eq(favorites.workId, workId))),
      this.db
        .select({ number: readingProgress.episodeNumber })
        .from(readingProgress)
        .where(and(eq(readingProgress.userId, user.id), eq(readingProgress.workId, workId))),
      this.db.select({ status: works.status, wholePrice: works.wholePrice }).from(works).where(eq(works.id, workId)),
      this.db
        .select({ score: ratings.score })
        .from(ratings)
        .where(and(eq(ratings.userId, user.id), eq(ratings.workId, workId))),
    ]);
    const spent = owned.reduce((sum, r) => sum + r.price, 0);
    return {
      ownsWork: owned.some((r) => r.episodeId === null),
      ownedEpisodeIds: ids(owned),
      workInCart: cart.some((r) => r.episodeId === null),
      cartEpisodeIds: ids(cart),
      isFavorite: Boolean(favorite),
      myRating: rating?.score ?? null,
      lastReadNumber: progress?.number ?? null,
      wholePriceForUser:
        work?.status === "COMPLETED" && work.wholePrice !== null ? Math.max(0, work.wholePrice - spent) : null,
    };
  }

  /** 뷰어용 회차. 권한이 없으면 메타 정보만 돌려주고 본문은 절대 내려보내지 않는다. */
  async getEpisode(workId: string, number: number, user: AuthUser | undefined): Promise<EpisodeView> {
    const [row] = await this.db
      .select({
        episode: episodes,
        workTitle: works.title,
        format: works.format,
        authorId: works.authorId,
        authorName: users.nickname,
        price: works.episodePrice,
      })
      .from(episodes)
      .innerJoin(works, eq(episodes.workId, works.id))
      .innerJoin(users, eq(works.authorId, users.id))
      .where(and(eq(episodes.workId, workId), eq(episodes.number, number), visibleEpisode(), publicWork()));
    if (!row) throw new NotFoundException("회차를 찾을 수 없습니다.");

    const accessible = await this.canRead(row.episode, row.authorId, user);
    if (accessible && user) {
      await this.db
        .insert(readingProgress)
        .values({ userId: user.id, workId, episodeNumber: number })
        .onConflictDoUpdate({
          target: [readingProgress.userId, readingProgress.workId],
          set: { episodeNumber: number, updatedAt: new Date() },
        });
    }

    const neighbors = await this.db
      .select({ number: episodes.number, title: episodes.title })
      .from(episodes)
      .where(and(eq(episodes.workId, workId), visibleEpisode(), inArray(episodes.number, [number - 1, number + 1])));

    // 이미지 주소가 곧 본문이므로 볼 수 있는 사람에게만 내려보낸다.
    const images =
      accessible && row.format === "COMIC"
        ? await this.db
            .select({
              id: episodeImages.id,
              position: episodeImages.position,
              alt: episodeImages.alt,
              width: episodeImages.width,
              height: episodeImages.height,
            })
            .from(episodeImages)
            .where(eq(episodeImages.episodeId, row.episode.id))
            .orderBy(asc(episodeImages.position))
        : null;

    return {
      id: row.episode.id,
      workId,
      format: row.format,
      images,
      workTitle: row.workTitle,
      authorName: row.authorName,
      number,
      title: row.episode.title,
      episodeType: row.episode.episodeType,
      isFree: row.episode.isFree,
      publishedAt: iso(row.episode.publishedAt) as string,
      prev: neighbors.find((n) => n.number === number - 1) ?? (await this.adjacent(workId, number, "prev")),
      next: neighbors.find((n) => n.number === number + 1) ?? (await this.adjacent(workId, number, "next")),
      accessible,
      price: row.episode.isFree ? 0 : row.price,
      content: accessible ? stripAuthorComments(row.episode.content) : null,
      authorNote: accessible ? row.episode.authorNote : null,
    };
  }

  /** 조회수는 화면이 한 번만 보낸다. 작가가 자기 글을 확인하는 것과 읽을 수 없는 회차는 세지 않는다. */
  async recordView(workId: string, number: number, user: AuthUser | undefined): Promise<void> {
    const [row] = await this.db
      .select({ episode: episodes, authorId: works.authorId })
      .from(episodes)
      .innerJoin(works, eq(episodes.workId, works.id))
      .where(and(eq(episodes.workId, workId), eq(episodes.number, number), visibleEpisode(), publicWork()));
    if (!row) throw new NotFoundException("회차를 찾을 수 없습니다.");
    if (user?.id === row.authorId || !(await this.canRead(row.episode, row.authorId, user))) return;
    await this.db
      .update(works)
      .set({ viewCount: sql`${works.viewCount} + 1` })
      .where(eq(works.id, workId));
  }

  async setFavorite(user: AuthUser, workId: string, favorite: boolean): Promise<void> {
    if (!favorite) {
      await this.db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.workId, workId)));
      return;
    }
    const [work] = await this.db
      .select({ id: works.id })
      .from(works)
      .where(and(eq(works.id, workId), publicWork(), HAS_VISIBLE_EPISODE));
    if (!work) throw new NotFoundException("작품을 찾을 수 없습니다.");
    await this.db.insert(favorites).values({ userId: user.id, workId }).onConflictDoNothing();
  }

  async setRating(user: AuthUser, workId: string, score: number | null): Promise<void> {
    if (score === null) {
      await this.db.delete(ratings).where(and(eq(ratings.userId, user.id), eq(ratings.workId, workId)));
      return;
    }
    const [work] = await this.db
      .select({ id: works.id })
      .from(works)
      .where(and(eq(works.id, workId), publicWork(), HAS_VISIBLE_EPISODE));
    if (!work) throw new NotFoundException("작품을 찾을 수 없습니다.");
    await this.db
      .insert(ratings)
      .values({ userId: user.id, workId, score })
      .onConflictDoUpdate({ target: [ratings.userId, ratings.workId], set: { score, updatedAt: new Date() } });
  }

  async getCover(workId: string) {
    // 작가가 공개 전에 표지를 확인하므로 초안은 막지 않고, 휴지통의 작품만 뺀다.
    const [row] = await this.db
      .select({ cover: workCovers })
      .from(workCovers)
      .innerJoin(works, eq(workCovers.workId, works.id))
      .where(and(eq(workCovers.workId, workId), isNull(works.deletedAt)));
    const cover = row?.cover;
    if (!cover) throw new NotFoundException("표지가 없습니다.");
    return cover;
  }

  async listFavorites(user: AuthUser): Promise<FavoriteWork[]> {
    const rows = await this.db
      .select({ ...summaryColumns, lastReadNumber: readingProgress.episodeNumber })
      .from(favorites)
      .innerJoin(works, eq(favorites.workId, works.id))
      .innerJoin(users, eq(works.authorId, users.id))
      .leftJoin(readingProgress, and(eq(readingProgress.workId, works.id), eq(readingProgress.userId, user.id)))
      // 상세가 404인 작품은 링크가 깨지므로 뺀다. 회차가 다시 공개되면 목록에 돌아온다.
      .where(and(eq(favorites.userId, user.id), publicWork(), HAS_VISIBLE_EPISODE))
      .orderBy(desc(favorites.createdAt));
    return rows.map(toSummary);
  }

  async listReading(user: AuthUser): Promise<ReadingEntry[]> {
    const rows = await this.db
      .select({
        ...summaryColumns,
        lastReadNumber: readingProgress.episodeNumber,
        lastReadAt: readingProgress.updatedAt,
      })
      .from(readingProgress)
      .innerJoin(works, eq(readingProgress.workId, works.id))
      .innerJoin(users, eq(works.authorId, users.id))
      .where(
        and(
          eq(readingProgress.userId, user.id),
          publicWork(),
          // 읽던 회차를 작가가 내렸으면 이어 보기 링크가 깨지므로 뺀다.
          sql`exists (select 1 from "episodes" e where e."work_id" = "works"."id" and e."number" = ${readingProgress.episodeNumber} and ${VISIBLE})`,
        ),
      )
      .orderBy(desc(readingProgress.updatedAt))
      .limit(10);
    return rows.map((row) => ({
      ...toSummary(row),
      lastReadAt: row.lastReadAt.toISOString(),
    }));
  }

  async listComments(
    episodeId: string,
    user: AuthUser | undefined,
    sort: CommentSort = "latest",
  ): Promise<EpisodeCommentList> {
    const target = await this.readableEpisode(episodeId, user);
    const likeCount = sql<number>`(select count(*)::int from "comment_likes" l where l."comment_id" = "comments"."id")`;
    const columns = {
      id: comments.id,
      userId: comments.userId,
      authorName: users.nickname,
      body: comments.body,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      likeCount,
      likedByMe: user
        ? sql<boolean>`exists (select 1 from "comment_likes" l where l."comment_id" = "comments"."id" and l."user_id" = ${user.id})`
        : sql<boolean>`false`,
    };
    const rows = await this.db
      .select(columns)
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(and(eq(comments.episodeId, episodeId), isNull(comments.parentId)))
      .orderBy(...(sort === "likes" ? [desc(likeCount)] : []), desc(comments.createdAt), desc(comments.id))
      .limit(100);
    const replies = rows.length
      ? await this.db
          .select({ ...columns, parentId: comments.parentId })
          .from(comments)
          .innerJoin(users, eq(comments.userId, users.id))
          .where(
            inArray(
              comments.parentId,
              rows.map((row) => row.id),
            ),
          )
          .orderBy(asc(comments.createdAt), asc(comments.id))
      : [];
    const [counted] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(eq(comments.episodeId, episodeId), isNull(comments.deletedAt)));

    const toReply = (row: Omit<(typeof rows)[number], "deletedAt">): EpisodeCommentReply => ({
      id: row.id,
      authorName: row.authorName,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      canDelete: Boolean(user && (user.id === row.userId || user.id === target.authorId)),
      isAuthor: row.userId === target.authorId,
      likeCount: row.likeCount,
      likedByMe: row.likedByMe,
    });
    return {
      total: counted?.total ?? 0,
      items: rows.map((row) => {
        const own = replies.filter((reply) => reply.parentId === row.id).map(toReply);
        // 지운 댓글은 답글의 자리만 지키고, 쓴 사람과 내용은 내보내지 않는다.
        if (row.deletedAt) {
          return {
            ...toReply(row),
            authorName: "",
            body: "",
            canDelete: false,
            isAuthor: false,
            likeCount: 0,
            likedByMe: false,
            deleted: true,
            replies: own,
          };
        }
        return { ...toReply(row), deleted: false, replies: own };
      }),
    };
  }

  /** 유료 회차의 이미지는 주소를 알아도 산 사람만 받는다. 요청마다 권한을 확인한다. */
  async getEpisodeImage(episodeId: string, imageId: string, user: AuthUser | undefined) {
    await this.readableEpisode(episodeId, user);
    const [image] = await this.db
      .select({ mimeType: episodeImages.mimeType, data: episodeImages.data })
      .from(episodeImages)
      .where(and(eq(episodeImages.id, imageId), eq(episodeImages.episodeId, episodeId)));
    if (!image) throw new NotFoundException("이미지를 찾을 수 없습니다.");
    return image;
  }

  /** 본문을 읽을 수 있는 사람만 댓글을 보고 쓴다. 유료 회차의 내용이 댓글로 새지 않게 하기 위해서다. */
  async addComment(episodeId: string, user: AuthUser, body: string, parentId?: string | null): Promise<void> {
    await this.readableEpisode(episodeId, user);
    let rootId: string | null = null;
    if (parentId) {
      const [parent] = await this.db
        .select({ id: comments.id, parentId: comments.parentId, deletedAt: comments.deletedAt })
        .from(comments)
        .where(and(eq(comments.id, parentId), eq(comments.episodeId, episodeId)));
      if (!parent) throw new NotFoundException("답글을 달 댓글을 찾을 수 없습니다.");
      if (parent.deletedAt) throw new ConflictException("지운 댓글에는 답글을 달 수 없습니다.");
      // 깊이는 한 단계이므로 답글의 답글은 같은 묶음에 이어 붙인다.
      rootId = parent.parentId ?? parent.id;
    }
    try {
      await this.db.insert(comments).values({ episodeId, userId: user.id, body, parentId: rootId });
    } catch (error) {
      // 확인과 저장 사이에 댓글이 완전히 지워지면 외래 키가 막는다.
      if (isForeignKeyViolation(error)) throw new NotFoundException("답글을 달 댓글을 찾을 수 없습니다.");
      throw error;
    }
  }

  /** 답글이 남아 있으면 자리를 지키고, 마지막 답글을 지우면 자리만 남은 댓글도 함께 지운다. */
  async deleteComment(commentId: string, user: AuthUser): Promise<void> {
    const [row] = await this.db
      .select({
        userId: comments.userId,
        authorId: works.authorId,
        parentId: comments.parentId,
        deletedAt: comments.deletedAt,
      })
      .from(comments)
      .innerJoin(episodes, eq(comments.episodeId, episodes.id))
      .innerJoin(works, eq(episodes.workId, works.id))
      .where(eq(comments.id, commentId));
    if (!row || row.deletedAt) throw new NotFoundException("댓글을 찾을 수 없습니다.");
    if (row.userId !== user.id && row.authorId !== user.id) {
      throw new ForbiddenException("쓴 사람과 작가만 지울 수 있습니다.");
    }
    await this.db.transaction(async (tx) => {
      // 답글이 동시에 달려도 자리가 사라지지 않게 묶음의 첫 댓글을 잠근다.
      const rootId = row.parentId ?? commentId;
      await tx.select({ id: comments.id }).from(comments).where(eq(comments.id, rootId)).for("update");
      if (row.parentId) {
        await tx.delete(comments).where(eq(comments.id, commentId));
        const [left] = await tx
          .select({ id: comments.id })
          .from(comments)
          .where(eq(comments.parentId, rootId))
          .limit(1);
        if (!left) await tx.delete(comments).where(and(eq(comments.id, rootId), isNotNull(comments.deletedAt)));
        return;
      }
      const [reply] = await tx
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.parentId, commentId))
        .limit(1);
      if (reply) {
        await tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
        // 지운 글의 공감은 더 쓰이지 않는다.
        await tx.delete(commentLikes).where(eq(commentLikes.commentId, commentId));
      } else {
        await tx.delete(comments).where(eq(comments.id, commentId));
      }
    });
  }

  /** 읽을 수 있는 회차의 댓글에만 공감한다. 같은 값을 다시 보내도 결과가 같다. */
  async setCommentLike(commentId: string, user: AuthUser, liked: boolean): Promise<void> {
    const [row] = await this.db
      .select({ episodeId: comments.episodeId, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, commentId));
    if (!row || row.deletedAt) throw new NotFoundException("댓글을 찾을 수 없습니다.");
    await this.readableEpisode(row.episodeId, user);
    if (!liked) {
      await this.db
        .delete(commentLikes)
        .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, user.id)));
      return;
    }
    try {
      await this.db.insert(commentLikes).values({ commentId, userId: user.id }).onConflictDoNothing();
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new NotFoundException("댓글을 찾을 수 없습니다.");
      throw error;
    }
  }

  private async readableEpisode(episodeId: string, user: AuthUser | undefined) {
    const [row] = await this.db
      .select({ episode: episodes, authorId: works.authorId })
      .from(episodes)
      .innerJoin(works, eq(episodes.workId, works.id))
      .where(and(eq(episodes.id, episodeId), visibleEpisode(), publicWork()));
    if (!row) throw new NotFoundException("회차를 찾을 수 없습니다.");
    if (!(await this.canRead(row.episode, row.authorId, user))) {
      throw new ForbiddenException("이 회차를 구매한 뒤 이용할 수 있습니다.");
    }
    return row;
  }

  /** 초안이 사이에 끼어 번호가 이어지지 않아도 앞뒤 공개 회차를 찾는다. */
  private async adjacent(workId: string, number: number, direction: "prev" | "next") {
    const [row] = await this.db
      .select({ number: episodes.number, title: episodes.title })
      .from(episodes)
      .where(
        and(
          eq(episodes.workId, workId),
          visibleEpisode(),
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
