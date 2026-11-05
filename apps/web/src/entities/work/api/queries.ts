import "server-only";

import type { Paginated, WorkDetail, WorkQuery, WorkSummary } from "@raon/contracts";
import { cacheLife, cacheTag } from "next/cache";
import { ApiError, apiFetch } from "@/shared/api/index.server";

/** 작품 목록과 상세처럼 사용자마다 같은 데이터에 붙는 캐시 태그. 작가가 내용을 바꾸면 비운다. */
export const WORKS_TAG = "works";

export async function getWorks(query: WorkQuery = {}): Promise<Paginated<WorkSummary>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(WORKS_TAG);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return apiFetch<Paginated<WorkSummary>>(`/works?${params}`);
}

/** 없는 작품은 null. 공개 정보만 담으므로 캐시해도 안전하다. 사용자별 권리는 getWorkAccess로 따로 읽는다. */
export async function getWork(workId: string): Promise<WorkDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(WORKS_TAG);

  try {
    return await apiFetch<WorkDetail>(`/works/${workId}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
