"use server";

import type { EpisodeMetaInput, StudioEpisode } from "@raon/contracts";
import { revalidatePath, updateTag } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { WORKS_TAG } from "@/entities/work/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

/** 유형은 독자에게 보이므로 공개한 회차면 공개 목록의 캐시도 비운다. */
export async function saveEpisodeMeta(
  episodeId: string,
  input: EpisodeMetaInput,
): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}/meta`, { method: "PUT", body: input, token }),
  );
  if (result.ok) {
    if (result.data.status === "PUBLISHED") updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${result.data.workId}`);
  }
  return result;
}
