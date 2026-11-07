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
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  COMIC_IMAGE_MAX_BYTES,
  type ComicImageInput,
  comicImageInputSchema,
  type MoveEpisodeInput,
  moveEpisodeSchema,
} from "@raon/contracts";
import { AuthGuard, type AuthUser, CurrentUser, Roles } from "../auth/auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ComicsService } from "./comics.service.js";

@Controller("studio/episodes/:episodeId/images")
@UseGuards(AuthGuard)
@Roles("AUTHOR")
export class ComicsController {
  constructor(private readonly comics: ComicsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param("episodeId", ParseUUIDPipe) episodeId: string) {
    return this.comics.list(user.id, episodeId);
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: COMIC_IMAGE_MAX_BYTES } }))
  add(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body(new ZodPipe(comicImageInputSchema)) body: ComicImageInput,
  ) {
    if (!file) throw new BadRequestException("이미지 파일을 골라 주세요.");
    return this.comics.add(user.id, episodeId, file.buffer, body.alt);
  }

  @Get(":imageId")
  async read(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ) {
    const image = await this.comics.read(user.id, episodeId, imageId);
    return new StreamableFile(Buffer.from(image.data), { type: image.mimeType });
  }

  @Put(":imageId")
  update(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body(new ZodPipe(comicImageInputSchema)) body: ComicImageInput,
  ) {
    return this.comics.updateAlt(user.id, episodeId, imageId, body.alt);
  }

  @Post(":imageId/move")
  @HttpCode(204)
  async move(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body(new ZodPipe(moveEpisodeSchema)) body: MoveEpisodeInput,
  ) {
    await this.comics.move(user.id, episodeId, imageId, body.direction);
  }

  @Delete(":imageId")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("episodeId", ParseUUIDPipe) episodeId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ) {
    await this.comics.remove(user.id, episodeId, imageId);
  }
}
