import { Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { workQuerySchema } from "@raon/contracts";
import type { z } from "zod";
import { AuthGuard, type AuthUser, CurrentUser, OptionalAuth } from "../auth/auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CatalogService } from "./catalog.service.js";

@Controller("works")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query(new ZodPipe(workQuerySchema)) query: z.output<typeof workQuerySchema>) {
    return this.catalog.listWorks(query);
  }

  @Get(":workId")
  get(@Param("workId", ParseUUIDPipe) workId: string) {
    return this.catalog.getWork(workId);
  }

  @Get(":workId/access")
  @UseGuards(AuthGuard)
  access(@Param("workId", ParseUUIDPipe) workId: string, @CurrentUser() user: AuthUser) {
    return this.catalog.getAccess(workId, user);
  }

  @Get(":workId/episodes/:number")
  @OptionalAuth()
  @UseGuards(AuthGuard)
  episode(
    @Param("workId", ParseUUIDPipe) workId: string,
    @Param("number", ParseIntPipe) number: number,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.catalog.getEpisode(workId, number, user);
  }
}
