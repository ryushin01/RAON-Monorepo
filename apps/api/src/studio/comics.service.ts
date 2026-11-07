import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { COMIC_IMAGE_MAX_COUNT, type ComicImage } from "@raon/contracts";
import { and, asc, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { detectImageType, readImageSize } from "../common/image.js";
import type { Database } from "../db/database.js";
import { DB } from "../db/database.module.js";
import { episodeImages, episodes, works } from "../db/schema.js";

const imageColumns = {
  id: episodeImages.id,
  position: episodeImages.position,
  alt: episodeImages.alt,
  width: episodeImages.width,
  height: episodeImages.height,
};

type Tx = Pick<Database, "select">;

@Injectable()
export class ComicsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(authorId: string, episodeId: string): Promise<ComicImage[]> {
    await this.ownedComicEpisode(authorId, episodeId);
    return this.db
      .select(imageColumns)
      .from(episodeImages)
      .where(eq(episodeImages.episodeId, episodeId))
      .orderBy(asc(episodeImages.position));
  }

  /** 공개 전에도 작가가 볼 수 있어야 하므로 독자용 조회와 따로 둔다. */
  async read(authorId: string, episodeId: string, imageId: string) {
    await this.ownedComicEpisode(authorId, episodeId);
    const [row] = await this.db
      .select({ mimeType: episodeImages.mimeType, data: episodeImages.data })
      .from(episodeImages)
      .where(and(eq(episodeImages.id, imageId), eq(episodeImages.episodeId, episodeId)));
    if (!row) throw new NotFoundException("이미지를 찾을 수 없습니다.");
    return row;
  }

  async add(authorId: string, episodeId: string, data: Uint8Array, alt: string): Promise<ComicImage> {
    await this.ownedComicEpisode(authorId, episodeId);
    const mimeType = detectImageType(data);
    if (!mimeType) throw new BadRequestException("JPG, PNG, WebP 이미지만 올릴 수 있습니다.");
    const size = readImageSize(data);
    return this.db.transaction(async (tx) => {
      // 여러 장을 동시에 올려도 순서와 개수 제한이 어긋나지 않게 회차 행을 잠근다.
      const current = await this.lockEpisode(tx, episodeId);
      if (current.status === "PUBLISHED" && !alt) {
        throw new BadRequestException("공개 중인 회차에는 설명을 함께 넣어 올려 주세요.");
      }
      const [{ count, last } = { count: 0, last: 0 }] = await tx
        .select({
          count: sql<number>`count(*)::int`,
          last: sql<number>`coalesce(max(${episodeImages.position}), 0)::int`,
        })
        .from(episodeImages)
        .where(eq(episodeImages.episodeId, episodeId));
      if (count >= COMIC_IMAGE_MAX_COUNT) {
        throw new ConflictException(`이미지는 회차마다 ${COMIC_IMAGE_MAX_COUNT}장까지 올릴 수 있습니다.`);
      }
      const [row] = await tx
        .insert(episodeImages)
        .values({
          episodeId,
          position: last + 1,
          mimeType,
          data,
          alt,
          width: size?.width ?? null,
          height: size?.height ?? null,
        })
        .returning(imageColumns);
      return row!;
    });
  }

  async updateAlt(authorId: string, episodeId: string, imageId: string, alt: string): Promise<ComicImage> {
    const episode = await this.ownedComicEpisode(authorId, episodeId);
    // 독자가 보고 있는 회차의 대체 텍스트를 비우지 못하게 한다.
    if (episode.status === "PUBLISHED" && !alt) {
      throw new BadRequestException("공개 중인 회차의 이미지 설명은 비울 수 없습니다.");
    }
    const [row] = await this.db
      .update(episodeImages)
      .set({ alt })
      .where(and(eq(episodeImages.id, imageId), eq(episodeImages.episodeId, episodeId)))
      .returning(imageColumns);
    if (!row) throw new NotFoundException("이미지를 찾을 수 없습니다.");
    return row;
  }

  /** 끌어 놓기 대신 버튼으로 옮겨 키보드와 단일 포인터로 쓸 수 있게 한다. */
  async move(authorId: string, episodeId: string, imageId: string, direction: "up" | "down"): Promise<void> {
    await this.ownedComicEpisode(authorId, episodeId);
    await this.db.transaction(async (tx) => {
      await this.lockEpisode(tx, episodeId);
      const [current] = await tx
        .select({ id: episodeImages.id, position: episodeImages.position })
        .from(episodeImages)
        .where(and(eq(episodeImages.id, imageId), eq(episodeImages.episodeId, episodeId)));
      if (!current) throw new NotFoundException("이미지를 찾을 수 없습니다.");
      const [neighbor] = await tx
        .select({ id: episodeImages.id, position: episodeImages.position })
        .from(episodeImages)
        .where(
          and(
            eq(episodeImages.episodeId, episodeId),
            direction === "up"
              ? lt(episodeImages.position, current.position)
              : gt(episodeImages.position, current.position),
          ),
        )
        .orderBy(direction === "up" ? desc(episodeImages.position) : asc(episodeImages.position))
        .limit(1);
      if (!neighbor) throw new BadRequestException("더 옮길 수 없습니다.");
      // (회차, 순서) 유일 제약이 있어 임시 순서를 거쳐 맞바꾼다.
      await tx.update(episodeImages).set({ position: -1 }).where(eq(episodeImages.id, current.id));
      await tx.update(episodeImages).set({ position: current.position }).where(eq(episodeImages.id, neighbor.id));
      await tx.update(episodeImages).set({ position: neighbor.position }).where(eq(episodeImages.id, current.id));
    });
  }

  /** 끌어 놓아 정한 순서로 이미지 순서를 다시 매긴다. */
  async reorder(authorId: string, episodeId: string, ids: string[]): Promise<void> {
    await this.ownedComicEpisode(authorId, episodeId);
    await this.db.transaction(async (tx) => {
      await this.lockEpisode(tx, episodeId);
      const current = await tx
        .select({ id: episodeImages.id })
        .from(episodeImages)
        .where(eq(episodeImages.episodeId, episodeId));
      const known = new Set(current.map((row) => row.id));
      if (ids.length !== current.length || ids.some((id) => !known.has(id))) {
        throw new ConflictException("이미지 목록이 바뀌었습니다. 새로 고친 뒤 다시 옮겨 주세요.");
      }
      for (const [index, id] of ids.entries()) {
        await tx
          .update(episodeImages)
          .set({ position: -(index + 1) })
          .where(eq(episodeImages.id, id));
      }
      for (const [index, id] of ids.entries()) {
        await tx
          .update(episodeImages)
          .set({ position: index + 1 })
          .where(eq(episodeImages.id, id));
      }
    });
  }

  async remove(authorId: string, episodeId: string, imageId: string): Promise<void> {
    await this.ownedComicEpisode(authorId, episodeId);
    await this.db.transaction(async (tx) => {
      const current = await this.lockEpisode(tx, episodeId);
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(episodeImages)
        .where(eq(episodeImages.episodeId, episodeId));
      if (current.status === "PUBLISHED" && count <= 1) {
        throw new ConflictException("공개 중인 회차의 마지막 이미지는 지울 수 없습니다.");
      }
      const [row] = await tx
        .delete(episodeImages)
        .where(and(eq(episodeImages.id, imageId), eq(episodeImages.episodeId, episodeId)))
        .returning({ id: episodeImages.id });
      if (!row) throw new NotFoundException("이미지를 찾을 수 없습니다.");
    });
  }

  private async lockEpisode(tx: Tx, episodeId: string) {
    const [row] = await tx
      .select()
      .from(episodes)
      .where(and(eq(episodes.id, episodeId), isNull(episodes.deletedAt)))
      .for("update");
    if (!row) throw new NotFoundException("회차를 찾을 수 없습니다.");
    return row;
  }

  private async ownedComicEpisode(authorId: string, episodeId: string) {
    const [row] = await this.db
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
    if (row.format !== "COMIC") throw new BadRequestException("웹툰 회차가 아닙니다.");
    return row.episode;
  }
}
