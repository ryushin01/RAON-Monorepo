import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { type Database, type DatabaseHandle, openDatabase } from "./database.js";
import { seedDemoData } from "./seed.js";

export const DATABASE_HANDLE = Symbol("DATABASE_HANDLE");
export const DB = Symbol("DB");

/** 테스트에서 값을 바꿔 끼울 수 있게 환경 변수 해석을 한곳에 모은다. */
async function open(): Promise<DatabaseHandle> {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("운영 환경에는 DATABASE_URL이 필요합니다.");
  }
  const handle = await openDatabase({
    url: process.env.DATABASE_URL || undefined,
    dataDir: process.env.PGLITE_DATA_DIR ?? ".data/pglite",
  });
  const allowed = process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "1";
  if (allowed) await seedDemoData(handle.db);
  return handle;
}

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_HANDLE) private readonly handle: DatabaseHandle) {}
  async onApplicationShutdown() {
    await this.handle.close();
  }
}

@Global()
@Module({
  providers: [
    { provide: DATABASE_HANDLE, useFactory: open },
    { provide: DB, inject: [DATABASE_HANDLE], useFactory: (h: DatabaseHandle): Database => h.db },
    DatabaseLifecycle,
  ],
  exports: [DB, DATABASE_HANDLE],
})
export class DatabaseModule {}
