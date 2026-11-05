import "server-only";

import type { StudioEpisode, StudioWork, StudioWorkDetail } from "@raon/contracts";
import { ApiError, apiFetch } from "@/shared/api/index.server";

const orNull = async <T>(run: Promise<T>): Promise<T | null> => {
  try {
    return await run;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
};

/** 초안을 다루므로 캐시하지 않는다. */
export const getStudioWorks = (token: string) => apiFetch<StudioWork[]>("/studio/works", { token });
export const getStudioWork = (workId: string, token: string) =>
  orNull(apiFetch<StudioWorkDetail>(`/studio/works/${workId}`, { token }));
export const getStudioEpisode = (episodeId: string, token: string) =>
  orNull(apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}`, { token }));
