import "server-only";

import type { FavoriteWork, ReadingEntry } from "@raon/contracts";
import { apiFetch } from "@/shared/api/index.server";

/** 사용자별 데이터이므로 캐시하지 않는다. */
export const getFavorites = (token: string) => apiFetch<FavoriteWork[]>("/favorites", { token });
export const getReading = (token: string) => apiFetch<ReadingEntry[]>("/reading", { token });
