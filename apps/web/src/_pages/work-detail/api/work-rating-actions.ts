"use server";

import { updateTag } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { WORKS_TAG } from "@/entities/work/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

/** score가 null이면 별점을 지운다. */
export async function setRating(workId: string, score: number | null): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() =>
    score === null
      ? apiFetch<null>(`/works/${workId}/rating`, { method: "DELETE", token })
      : apiFetch<null>(`/works/${workId}/rating`, { method: "PUT", body: { score }, token }),
  );
  if (result.ok) updateTag(WORKS_TAG);
  return result;
}
