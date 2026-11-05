import "server-only";

import type { EpisodeComment, EpisodeView, WorkAccess } from "@raon/contracts";
import { ApiError, apiFetch } from "@/shared/api/index.server";

/** 유료 본문이 섞일 수 있으므로 절대 캐시하지 않는다. */
export async function getEpisode(workId: string, number: number, token?: string): Promise<EpisodeView | null> {
  try {
    return await apiFetch<EpisodeView>(`/works/${workId}/episodes/${number}`, { token });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export function getWorkAccess(workId: string, token: string): Promise<WorkAccess> {
  return apiFetch<WorkAccess>(`/works/${workId}/access`, { token });
}

export function getComments(episodeId: string, token?: string): Promise<EpisodeComment[]> {
  return apiFetch<EpisodeComment[]>(`/episodes/${episodeId}/comments`, { token });
}
