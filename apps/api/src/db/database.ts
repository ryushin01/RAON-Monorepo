import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.js";

const migrationsFolder = path.join(import.meta.dirname, "migrations");

async function openPglite(dataDir?: string) {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = await PGlite.create(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db, close: () => client.close() };
}

async function openPostgres(url: string) {
  const client = postgres(url);
  const db = drizzlePostgres(client, { schema });
  await migratePostgres(db, { migrationsFolder });
  return { db, close: () => client.end() };
}

/** 드라이버가 달라도 쿼리 API는 같으므로 PGlite 타입 하나로 다룬다. */
export type Database = Awaited<ReturnType<typeof openPglite>>["db"];
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DatabaseHandle {
  db: Database;
  close: () => Promise<unknown>;
}

/** DATABASE_URL이 있으면 PostgreSQL, 없으면 PGlite. dataDir이 없으면 메모리에서만 동작한다(테스트). */
export async function openDatabase(options: { url?: string; dataDir?: string }): Promise<DatabaseHandle> {
  if (options.url) return (await openPostgres(options.url)) as unknown as DatabaseHandle;
  return openPglite(options.dataDir);
}
