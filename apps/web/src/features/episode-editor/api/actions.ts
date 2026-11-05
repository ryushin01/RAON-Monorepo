"use server";

import type { EpisodeInput, StudioEpisode } from "@raon/contracts";
import { revalidatePath, updateTag } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { WORKS_TAG } from "@/entities/work/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

const NEED_LOGIN = { ok: false as const, message: "로그인이 필요합니다." };

/** episodeId가 없으면 새 회차를 만든다. 공개한 회차를 고치면 독자가 보는 정보도 갱신한다. */
export async function saveEpisode(
  workId: string,
  episodeId: string | null,
  input: EpisodeInput,
): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    episodeId
      ? apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}`, { method: "PUT", body: input, token })
      : apiFetch<StudioEpisode>(`/studio/works/${workId}/episodes`, { method: "POST", body: input, token }),
  );
  if (result.ok && result.data.status === "PUBLISHED") updateTag(WORKS_TAG);
  return result;
}

export async function setEpisodePublished(
  workId: string,
  episodeId: string,
  published: boolean,
): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}/${published ? "publish" : "unpublish"}`, {
      method: "POST",
      token,
    }),
  );
  if (result.ok) {
    updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${workId}`);
  }
  return result;
}
