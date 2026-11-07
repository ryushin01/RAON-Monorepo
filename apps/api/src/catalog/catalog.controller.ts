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
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  type CommentInput,
  type CommentSort,
  commentInputSchema,
  commentQuerySchema,
  type RatingInput,
  ratingInputSchema,
  workQuerySchema,
} from "@raon/contracts";
import type { z } from "zod";
import { AuthGuard, type AuthUser, CurrentUser, OptionalAuth, Roles } from "../auth/auth.guard.js";
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

  @Post("works/:workId/episodes/:number/view")
  @HttpCode(204)
  @OptionalAuth()
  @UseGuards(AuthGuard)
  async view(
    @Param("workId", ParseUUIDPipe) workId: string,
    @Param("number", ParseIntPipe) number: number,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    await this.catalog.recordView(workId, number, user);
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

  @Put("works/:workId/rating")
  @HttpCode(204)
  @Roles("READER")
  @UseGuards(AuthGuard)
  async rate(
    @Param("workId", ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(ratingInputSchema)) body: RatingInput,
  ) {
    await this.catalog.setRating(user, workId, body.score);
  }

  @Delete("works/:workId/rating")
  @HttpCode(204)
  @Roles("READER")
  @UseGuards(AuthGuard)
  async unrate(@Param("workId", ParseUUIDPipe) workId: string, @CurrentUser() user: AuthUser) {
    await this.catalog.setRating(user, workId, null);
  }

  @Get("works/:workId/cover")
  async cover(@Param("workId", ParseUUIDPipe) workId: string) {
    const cover = await this.catalog.getCover(workId);
    return new StreamableFile(Buffer.from(cover.data), { type: cover.mimeType });
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

  @Get("episodes/:episodeId/images/:imageId")
  @OptionalAuth()
  @UseGuards(AuthGuard)
  async episodeImage(
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    const image = await this.catalog.getEpisodeImage(episodeId, imageId, user);
    return new StreamableFile(Buffer.from(image.data), { type: image.mimeType });
  }

  @Get("episodes/:episodeId/comments")
  @OptionalAuth()
  @UseGuards(AuthGuard)
  comments(
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query(new ZodPipe(commentQuerySchema)) query: { sort: CommentSort },
  ) {
    return this.catalog.listComments(episodeId, user, query.sort);
  }

  @Post("episodes/:episodeId/comments")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async addComment(
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(commentInputSchema)) body: CommentInput,
  ) {
    await this.catalog.addComment(episodeId, user, body.body, body.parentId);
  }

  @Put("comments/:commentId/like")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async like(@Param("commentId", ParseUUIDPipe) commentId: string, @CurrentUser() user: AuthUser) {
    await this.catalog.setCommentLike(commentId, user, true);
  }

  @Delete("comments/:commentId/like")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async unlike(@Param("commentId", ParseUUIDPipe) commentId: string, @CurrentUser() user: AuthUser) {
    await this.catalog.setCommentLike(commentId, user, false);
  }

  @Delete("comments/:commentId")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async deleteComment(@Param("commentId", ParseUUIDPipe) commentId: string, @CurrentUser() user: AuthUser) {
    await this.catalog.deleteComment(commentId, user);
  }
}
