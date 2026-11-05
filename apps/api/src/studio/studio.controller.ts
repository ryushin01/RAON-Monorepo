import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import {
  type EpisodeInput,
  episodeInputSchema,
  type WorkInput,
  workInputSchema,
  workStatusInputSchema,
} from "@raon/contracts";
import { AuthGuard, type AuthUser, CurrentUser, Roles } from "../auth/auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { StudioService } from "./studio.service.js";

@Controller("studio")
@UseGuards(AuthGuard)
@Roles("AUTHOR")
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  @Get("works")
  list(@CurrentUser() user: AuthUser) {
    return this.studio.listWorks(user.id);
  }

  @Post("works")
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(workInputSchema)) body: WorkInput) {
    return this.studio.createWork(user.id, body);
  }

  @Get("works/:workId")
  get(@CurrentUser() user: AuthUser, @Param("workId", ParseUUIDPipe) workId: string) {
    return this.studio.getWork(user.id, workId);
  }

  @Put("works/:workId")
  update(
    @CurrentUser() user: AuthUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @Body(new ZodPipe(workInputSchema)) body: WorkInput,
  ) {
    return this.studio.updateWork(user.id, workId, body);
  }

  @Post("works/:workId/status")
  @HttpCode(200)
  status(
    @CurrentUser() user: AuthUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @Body(new ZodPipe(workStatusInputSchema)) body: { status: "ONGOING" | "COMPLETED" },
  ) {
    return this.studio.setWorkStatus(user.id, workId, body.status);
  }

  @Post("works/:workId/episodes")
  createEpisode(
    @CurrentUser() user: AuthUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @Body(new ZodPipe(episodeInputSchema)) body: EpisodeInput,
  ) {
    return this.studio.createEpisode(user.id, workId, body);
  }

  @Get("episodes/:episodeId")
  episode(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    return this.studio.getEpisode(user.id, episodeId);
  }

  @Put("episodes/:episodeId")
  saveEpisode(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Body(new ZodPipe(episodeInputSchema)) body: EpisodeInput,
  ) {
    return this.studio.saveEpisode(user.id, episodeId, body);
  }

  @Post("episodes/:episodeId/publish")
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    return this.studio.publishEpisode(user.id, episodeId);
  }

  @Post("episodes/:episodeId/unpublish")
  @HttpCode(200)
  unpublish(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    return this.studio.unpublishEpisode(user.id, episodeId);
  }

  @Delete("episodes/:episodeId")
  @HttpCode(204)
  async deleteEpisode(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    await this.studio.deleteEpisode(user.id, episodeId);
  }

  @Delete("works/:workId")
  @HttpCode(204)
  async deleteWork(@CurrentUser() user: AuthUser, @Param("workId", ParseUUIDPipe) workId: string) {
    await this.studio.deleteWork(user.id, workId);
  }
}
