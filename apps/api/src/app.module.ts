import { Controller, Get, Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogController } from "./catalog/catalog.controller.js";
import { CatalogService } from "./catalog/catalog.service.js";
import { CommerceController } from "./commerce/commerce.controller.js";
import { CommerceService } from "./commerce/commerce.service.js";
import { DatabaseModule } from "./db/database.module.js";
import { ForeshadowsController } from "./studio/foreshadows.controller.js";
import { ForeshadowsService } from "./studio/foreshadows.service.js";
import { NotesController } from "./studio/notes.controller.js";
import { NotesService } from "./studio/notes.service.js";
import { StudioController } from "./studio/studio.controller.js";
import { StudioService } from "./studio/studio.service.js";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    HealthController,
    CatalogController,
    CommerceController,
    StudioController,
    NotesController,
    ForeshadowsController,
  ],
  providers: [CatalogService, CommerceService, StudioService, NotesService, ForeshadowsService],
})
export class AppModule {}
