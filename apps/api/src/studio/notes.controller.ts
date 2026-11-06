import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { noteInputSchema, workSearchQuerySchema } from "@raon/contracts";
import type { z } from "zod";
import { AuthGuard, type AuthUser, CurrentUser, Roles } from "../auth/auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { NotesService } from "./notes.service.js";

type ParsedNote = z.output<typeof noteInputSchema>;

@Controller("studio")
@UseGuards(AuthGuard)
@Roles("AUTHOR")
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get("works/:workId/notes")
  list(@CurrentUser() user: AuthUser, @Param("workId", ParseUUIDPipe) workId: string) {
    return this.notes.list(user.id, workId);
  }

  @Post("works/:workId/notes")
  create(
    @CurrentUser() user: AuthUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @Body(new ZodPipe(noteInputSchema)) body: ParsedNote,
  ) {
    return this.notes.create(user.id, workId, body);
  }

  @Put("notes/:noteId")
  update(
    @CurrentUser() user: AuthUser,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Body(new ZodPipe(noteInputSchema)) body: ParsedNote,
  ) {
    return this.notes.update(user.id, noteId, body);
  }

  @Delete("notes/:noteId")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("noteId", ParseUUIDPipe) noteId: string) {
    await this.notes.remove(user.id, noteId);
  }

  @Get("works/:workId/search")
  search(
    @CurrentUser() user: AuthUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @Query(new ZodPipe(workSearchQuerySchema)) query: { q: string },
  ) {
    return this.notes.search(user.id, workId, query.q);
  }
}
