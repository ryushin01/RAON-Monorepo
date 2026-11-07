"use server";

import {
  EMPTY_DOC,
  type EpisodeInput,
  type EpisodeVersion,
  type EpisodeVersionSummary,
  type StudioEpisode,
  type WorkNote,
  type WritingStage,
} from "@raon/contracts";
import { revalidatePath, updateTag } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { WORKS_TAG } from "@/entities/work/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";
import { UNTITLED } from "../model/constants";

const NEED_LOGIN = { ok: false as const, message: "로그인이 필요합니다." };

/** 빈 초안을 먼저 만든다. 편집 화면은 항상 이미 있는 회차를 다룬다. */
export async function createDraft(workId: string): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const body: EpisodeInput = { title: UNTITLED, content: EMPTY_DOC, authorNote: null, isFree: false };
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/works/${workId}/episodes`, { method: "POST", body, token }),
  );
  if (result.ok) revalidatePath(`/studio/works/${workId}`);
  return result;
}

export async function fetchEpisode(episodeId: string): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}`, { token }));
}

/** 공개한 회차를 고치면 독자가 보는 정보도 갱신한다. */
export async function saveEpisode(episodeId: string, input: EpisodeInput): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}`, { method: "PUT", body: input, token }),
  );
  if (result.ok) {
    if (result.data.status === "PUBLISHED") updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${result.data.workId}`);
  }
  return result;
}

export async function listVersions(episodeId: string): Promise<ActionResult<EpisodeVersionSummary[]>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<EpisodeVersionSummary[]>(`/studio/episodes/${episodeId}/versions`, { token }));
}

export async function getVersion(episodeId: string, versionId: string): Promise<ActionResult<EpisodeVersion>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() =>
    apiFetch<EpisodeVersion>(`/studio/episodes/${episodeId}/versions/${versionId}`, { token }),
  );
}

export async function createVersion(
  episodeId: string,
  label: string | null,
): Promise<ActionResult<EpisodeVersionSummary>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() =>
    apiFetch<EpisodeVersionSummary>(`/studio/episodes/${episodeId}/versions`, {
      method: "POST",
      body: { label },
      token,
    }),
  );
}

export async function deleteVersion(episodeId: string, versionId: string): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() =>
    apiFetch<null>(`/studio/episodes/${episodeId}/versions/${versionId}`, { method: "DELETE", token }),
  );
}

/** 공개한 회차를 되돌리면 독자가 보는 정보도 갱신한다. */
export async function restoreVersion(episodeId: string, versionId: string): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}/versions/${versionId}/restore`, { method: "POST", token }),
  );
  if (result.ok) {
    if (result.data.status === "PUBLISHED") updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${result.data.workId}`);
  }
  return result;
}

export async function setEpisodePublished(
  workId: string,
  episodeId: string,
  published: boolean,
  publishAt?: string,
): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}/${published ? "publish" : "unpublish"}`, {
      method: "POST",
      body: published && publishAt ? { publishAt } : undefined,
      token,
    }),
  );
  if (result.ok) {
    updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${workId}`);
  }
  return result;
}

export async function moveEpisode(
  workId: string,
  episodeId: string,
  direction: "up" | "down",
): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<null>(`/studio/episodes/${episodeId}/move`, { method: "POST", body: { direction }, token }),
  );
  if (result.ok) {
    updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${workId}`);
  }
  return result;
}

/** 본문의 설정 이름을 표시하는 데 쓴다. 메모는 인물이나 장소의 이름이 아니므로 뺀다. */
export async function listSettingNotes(workId: string): Promise<ActionResult<WorkNote[]>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() => apiFetch<WorkNote[]>(`/studio/works/${workId}/notes`, { token }));
  return result.ok ? { ...result, data: result.data.filter((note) => note.kind === "SETTING") } : result;
}

export async function setWritingStage(episodeId: string, stage: WritingStage): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}/stage`, { method: "PUT", body: { stage }, token }),
  );
  if (result.ok) revalidatePath(`/studio/works/${result.data.workId}`);
  return result;
}

/** 초안을 휴지통으로 옮긴다. */
export async function trashDraft(workId: string, episodeId: string): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<null>(`/studio/episodes/${episodeId}`, { method: "DELETE", token }),
  );
  if (result.ok) revalidatePath(`/studio/works/${workId}`);
  return result;
}

export async function restoreFromTrash(workId: string, episodeId: string): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/episodes/${episodeId}/restore`, { method: "POST", token }),
  );
  if (result.ok) revalidatePath(`/studio/works/${workId}`);
  return result;
}

export async function purgeEpisode(workId: string, episodeId: string): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<null>(`/studio/episodes/${episodeId}/permanent`, { method: "DELETE", token }),
  );
  if (result.ok) revalidatePath(`/studio/works/${workId}`);
  return result;
}
