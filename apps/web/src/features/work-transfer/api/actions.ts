"use server";

import type { EpisodeInput, StudioEpisode, WorkExport } from "@raon/contracts";
import { revalidatePath } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

const NEED_LOGIN = { ok: false as const, message: "로그인이 필요합니다." };

export async function fetchWorkExport(workId: string): Promise<ActionResult<WorkExport>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<WorkExport>(`/studio/works/${workId}/export`, { token }));
}

export async function importEpisode(workId: string, body: EpisodeInput): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/works/${workId}/episodes`, { method: "POST", body, token }),
  );
  if (result.ok) revalidatePath(`/studio/works/${workId}`);
  return result;
}
