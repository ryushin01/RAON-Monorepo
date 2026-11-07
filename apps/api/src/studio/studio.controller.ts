import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  COVER_MAX_BYTES,
  type EpisodeInput,
  type EpisodeVersionInput,
  episodeInputSchema,
  episodeVersionInputSchema,
  type MoveEpisodeInput,
  moveEpisodeSchema,
  type PublishInput,
  publishInputSchema,
  type WorkInput,
  type WritingStageInput,
  workInputSchema,
  workStatusInputSchema,
  writingStageInputSchema,
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

  @Get("works/:workId/export")
  exportWork(@CurrentUser() user: AuthUser, @Param("workId", ParseUUIDPipe) workId: string) {
    return this.studio.exportWork(user.id, workId);
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

  @Put("episodes/:episodeId/stage")
  writingStage(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Body(new ZodPipe(writingStageInputSchema)) body: WritingStageInput,
  ) {
    return this.studio.setWritingStage(user.id, episodeId, body.stage);
  }

  @Get("episodes/:episodeId/versions")
  versions(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    return this.studio.listVersions(user.id, episodeId);
  }

  @Post("episodes/:episodeId/versions")
  createVersion(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Body(new ZodPipe(episodeVersionInputSchema)) body: EpisodeVersionInput,
  ) {
    return this.studio.createVersion(user.id, episodeId, body.label);
  }

  @Get("episodes/:episodeId/versions/:versionId")
  version(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
  ) {
    return this.studio.getVersion(user.id, episodeId, versionId);
  }

  @Post("episodes/:episodeId/versions/:versionId/restore")
  @HttpCode(200)
  restoreVersion(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
  ) {
    return this.studio.restoreVersion(user.id, episodeId, versionId);
  }

  @Delete("episodes/:episodeId/versions/:versionId")
  @HttpCode(204)
  async deleteVersion(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
  ) {
    await this.studio.deleteVersion(user.id, episodeId, versionId);
  }

  @Post("episodes/:episodeId/publish")
  @HttpCode(200)
  publish(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Body(new ZodPipe(publishInputSchema)) body: PublishInput,
  ) {
    return this.studio.publishEpisode(user.id, episodeId, body.publishAt);
  }

  @Post("episodes/:episodeId/move")
  @HttpCode(204)
  async move(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Body(new ZodPipe(moveEpisodeSchema)) body: MoveEpisodeInput,
  ) {
    await this.studio.moveEpisode(user.id, episodeId, body.direction);
  }

  @Put("works/:workId/cover")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: COVER_MAX_BYTES } }))
  cover(
    @CurrentUser() user: AuthUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    if (!file) throw new BadRequestException("이미지 파일을 골라 주세요.");
    return this.studio.setCover(user.id, workId, file.buffer);
  }

  @Delete("works/:workId/cover")
  removeCover(@CurrentUser() user: AuthUser, @Param("workId", ParseUUIDPipe) workId: string) {
    return this.studio.deleteCover(user.id, workId);
  }

  @Post("episodes/:episodeId/unpublish")
  @HttpCode(200)
  unpublish(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    return this.studio.unpublishEpisode(user.id, episodeId);
  }

  @Delete("episodes/:episodeId")
  @HttpCode(204)
  async trashEpisode(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    await this.studio.trashEpisode(user.id, episodeId);
  }

  @Post("episodes/:episodeId/restore")
  @HttpCode(200)
  restoreEpisode(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    return this.studio.restoreEpisode(user.id, episodeId);
  }

  @Delete("episodes/:episodeId/permanent")
  @HttpCode(204)
  async purgeEpisode(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    await this.studio.purgeEpisode(user.id, episodeId);
  }

  @Delete("works/:workId")
  @HttpCode(204)
  async deleteWork(@CurrentUser() user: AuthUser, @Param("workId", ParseUUIDPipe) workId: string) {
    await this.studio.deleteWork(user.id, workId);
  }
}
