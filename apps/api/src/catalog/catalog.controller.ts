import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { type CommentInput, commentInputSchema, workQuerySchema } from "@raon/contracts";
import type { z } from "zod";
import { AuthGuard, type AuthUser, CurrentUser, OptionalAuth } from "../auth/auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CatalogService } from "./catalog.service.js";

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("works")
  list(@Query(new ZodPipe(workQuerySchema)) query: z.output<typeof workQuerySchema>) {
    return this.catalog.listWorks(query);
  }

  @Get("works/:workId")
  get(@Param("workId", ParseUUIDPipe) workId: string) {
    return this.catalog.getWork(workId);
  }

  @Get("works/:workId/access")
  @UseGuards(AuthGuard)
  access(@Param("workId", ParseUUIDPipe) workId: string, @CurrentUser() user: AuthUser) {
    return this.catalog.getAccess(workId, user);
  }

  @Get("works/:workId/episodes/:number")
  @OptionalAuth()
  @UseGuards(AuthGuard)
  episode(
    @Param("workId", ParseUUIDPipe) workId: string,
    @Param("number", ParseIntPipe) number: number,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.catalog.getEpisode(workId, number, user);
  }

  @Put("works/:workId/favorite")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async favorite(@Param("workId", ParseUUIDPipe) workId: string, @CurrentUser() user: AuthUser) {
    await this.catalog.setFavorite(user, workId, true);
  }

  @Delete("works/:workId/favorite")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async unfavorite(@Param("workId", ParseUUIDPipe) workId: string, @CurrentUser() user: AuthUser) {
    await this.catalog.setFavorite(user, workId, false);
  }

  @Get("favorites")
  @UseGuards(AuthGuard)
  favorites(@CurrentUser() user: AuthUser) {
    return this.catalog.listFavorites(user);
  }

  @Get("reading")
  @UseGuards(AuthGuard)
  reading(@CurrentUser() user: AuthUser) {
    return this.catalog.listReading(user);
  }

  @Get("episodes/:episodeId/comments")
  @OptionalAuth()
  @UseGuards(AuthGuard)
  comments(@Param("episodeId", ParseUUIDPipe) episodeId: string, @CurrentUser() user: AuthUser | undefined) {
    return this.catalog.listComments(episodeId, user);
  }

  @Post("episodes/:episodeId/comments")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async addComment(
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(commentInputSchema)) body: CommentInput,
  ) {
    await this.catalog.addComment(episodeId, user, body.body);
  }

  @Delete("comments/:commentId")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async deleteComment(@Param("commentId", ParseUUIDPipe) commentId: string, @CurrentUser() user: AuthUser) {
    await this.catalog.deleteComment(commentId, user);
  }
}
