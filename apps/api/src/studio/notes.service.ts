import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  docToText,
  type noteInputSchema,
  type WorkNote,
  type WorkSearchHit,
  type WorkSearchResult,
} from "@raon/contracts";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "../db/database.js";
import { DB } from "../db/database.module.js";
import { episodes, workNotes, works } from "../db/schema.js";

type ParsedNote = z.output<typeof noteInputSchema>;

const MAX_NOTES = 500;
const SNIPPET_RADIUS = 40;

const toNote = (row: typeof workNotes.$inferSelect): WorkNote => ({
  id: row.id,
  workId: row.workId,
  episodeId: row.episodeId,
  kind: row.kind,
  category: row.category,
  title: row.title,
  aliases: row.aliases,
  body: row.body,
  updatedAt: row.updatedAt.toISOString(),
});

/** 글자 그대로 비교해 특수문자도 일반 글자로 찾는다. 대소문자는 가리지 않는다. */
function matchIn(text: string, query: string): Pick<WorkSearchHit, "matches" | "snippet"> | null {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let matches = 0;
  let first = -1;
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + needle.length)) {
    if (first === -1) first = index;
    matches += 1;
  }
  if (!matches) return null;
  const start = Math.max(first - SNIPPET_RADIUS, 0);
  const end = Math.min(first + needle.length + SNIPPET_RADIUS, text.length);
  const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  return { matches, snippet: `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}` };
}

@Injectable()
export class NotesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(authorId: string, workId: string): Promise<WorkNote[]> {
    await this.assertOwner(authorId, workId);
    const rows = await this.db
      .select()
      .from(workNotes)
      .where(eq(workNotes.workId, workId))
      .orderBy(asc(workNotes.kind), asc(workNotes.category), asc(workNotes.title));
    return rows.map(toNote);
  }

  async create(authorId: string, workId: string, input: ParsedNote): Promise<WorkNote> {
    await this.assertOwner(authorId, workId);
    await this.assertEpisodeLink(workId, input);
    return this.db.transaction(async (tx) => {
      // 동시에 만들어도 개수 제한을 넘지 않도록 작품 행을 잠근 뒤 센다.
      await tx.select({ id: works.id }).from(works).where(eq(works.id, workId)).for("update");
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(workNotes)
        .where(eq(workNotes.workId, workId));
      const existing = input.episodeId
        ? await tx.select({ id: workNotes.id }).from(workNotes).where(eq(workNotes.episodeId, input.episodeId))
        : [];
      // 이미 있는 회차 메모를 고칠 때만 개수가 늘지 않는다.
      if (count >= MAX_NOTES && existing.length === 0) {
        throw new ConflictException(`문서는 작품마다 ${MAX_NOTES}개까지 만들 수 있습니다.`);
      }
      if (input.episodeId) {
        // 회차 메모는 회차마다 하나이므로 이미 있으면 고친다.
        const [row] = await tx
          .insert(workNotes)
          .values({ ...input, workId })
          .onConflictDoUpdate({
            target: workNotes.episodeId,
            targetWhere: sql`${workNotes.episodeId} is not null`,
            set: { ...input, updatedAt: new Date() },
          })
          .returning();
        return toNote(row!);
      }
      const [row] = await tx
        .insert(workNotes)
        .values({ ...input, workId })
        .returning();
      return toNote(row!);
    });
  }

  async update(authorId: string, noteId: string, input: ParsedNote): Promise<WorkNote> {
    const note = await this.ownedNote(authorId, noteId);
    if (input.episodeId !== note.episodeId) throw new BadRequestException("문서의 회차 연결은 바꿀 수 없습니다.");
    await this.assertEpisodeLink(note.workId, input);
    const [row] = await this.db
      .update(workNotes)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(workNotes.id, noteId))
      .returning();
    return toNote(row!);
  }

  async remove(authorId: string, noteId: string): Promise<void> {
    await this.ownedNote(authorId, noteId);
    await this.db.delete(workNotes).where(eq(workNotes.id, noteId));
  }

  async search(authorId: string, workId: string, query: string): Promise<WorkSearchResult> {
    await this.assertOwner(authorId, workId);
    const [episodeRows, noteRows] = await Promise.all([
      this.db
        .select({ id: episodes.id, number: episodes.number, title: episodes.title, content: episodes.content })
        .from(episodes)
        .where(and(eq(episodes.workId, workId), isNull(episodes.deletedAt)))
        .orderBy(asc(episodes.number)),
      this.db.select().from(workNotes).where(eq(workNotes.workId, workId)).orderBy(asc(workNotes.title)),
    ]);
    const result: WorkSearchResult = { episodes: [], notes: [] };
    for (const row of episodeRows) {
      const hit = matchIn(`${row.title}\n${docToText(row.content)}`, query);
      if (hit) result.episodes.push({ id: row.id, number: row.number, title: row.title, ...hit });
    }
    for (const row of noteRows) {
      const hit = matchIn(`${row.title}\n${row.aliases.join(" ")}\n${row.body}`, query);
      if (hit) result.notes.push({ id: row.id, kind: row.kind, title: row.title, ...hit });
    }
    return result;
  }

  /** 회차 메모는 메모 종류여야 하고 같은 작품의 회차에만 달 수 있다. */
  private async assertEpisodeLink(workId: string, input: ParsedNote) {
    if (!input.episodeId) return;
    if (input.kind !== "MEMO") throw new BadRequestException("회차에는 메모만 달 수 있습니다.");
    const [row] = await this.db
      .select({ id: episodes.id })
      .from(episodes)
      .where(and(eq(episodes.id, input.episodeId), eq(episodes.workId, workId), isNull(episodes.deletedAt)));
    if (!row) throw new BadRequestException("이 작품의 회차가 아닙니다.");
  }

  private async assertOwner(authorId: string, workId: string) {
    const [row] = await this.db
      .select({ id: works.id })
      .from(works)
      .where(and(eq(works.id, workId), eq(works.authorId, authorId), isNull(works.deletedAt)));
    if (!row) throw new NotFoundException("작품을 찾을 수 없습니다.");
  }

  private async ownedNote(authorId: string, noteId: string) {
    const [row] = await this.db
      .select({ note: workNotes })
      .from(workNotes)
      .innerJoin(works, eq(workNotes.workId, works.id))
      .where(and(eq(workNotes.id, noteId), eq(works.authorId, authorId), isNull(works.deletedAt)));
    if (!row) throw new NotFoundException("문서를 찾을 수 없습니다.");
    return row.note;
  }
}
