#!/usr/bin/env node
// 타입 검사는 TypeScript 7로 한다. Next.js·Nest CLI·ts-jest 같은 도구는 TS 7에 없는 기존 API가 필요해서
// 각 패키지의 typescript는 6으로 두고, 7은 별칭 패키지(typescript-7)로 함께 설치한다.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const tsc = path.join(path.dirname(require.resolve("typescript-7/package.json")), "bin/tsc");
const { status, error } = spawnSync(process.execPath, [tsc, ...process.argv.slice(2)], { stdio: "inherit" });
if (error) throw error;
process.exit(status ?? 1);
