"use server";

import { getSessionToken } from "@/entities/session/index.server";
import { apiFetch, toActionResult } from "@/shared/api/index.server";

/** 조회수는 집계용이므로 실패해도 읽는 데 지장을 주지 않는다. 성공 여부만 돌려준다. */
export async function recordView(workId: string, number: number): Promise<boolean> {
  const token = await getSessionToken();
  const result = await toActionResult(() =>
    apiFetch<null>(`/works/${workId}/episodes/${number}/view`, { method: "POST", token }),
  );
  return result.ok;
}
