import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { type ForeshadowInput, foreshadowInputSchema } from "@raon/contracts";
import { AuthGuard, type AuthUser, CurrentUser, Roles } from "../auth/auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ForeshadowsService } from "./foreshadows.service.js";

@Controller("studio")
@UseGuards(AuthGuard)
@Roles("AUTHOR")
export class ForeshadowsController {
  constructor(private readonly foreshadows: ForeshadowsService) {}

  @Get("works/:workId/foreshadows")
  list(@CurrentUser() user: AuthUser, @Param("workId", ParseUUIDPipe) workId: string) {
    return this.foreshadows.list(user.id, workId);
  }

  @Post("works/:workId/foreshadows")
  create(
    @CurrentUser() user: AuthUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @Body(new ZodPipe(foreshadowInputSchema)) body: ForeshadowInput,
  ) {
    return this.foreshadows.create(user.id, workId, body);
  }

  @Put("foreshadows/:id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(foreshadowInputSchema)) body: ForeshadowInput,
  ) {
    return this.foreshadows.update(user.id, id, body);
  }

  @Delete("foreshadows/:id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.foreshadows.remove(user.id, id);
  }
}
