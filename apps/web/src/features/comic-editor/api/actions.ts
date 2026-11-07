"use server";

import { type ComicImage, EMPTY_DOC, type StudioEpisode } from "@raon/contracts";
import { revalidatePath, updateTag } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { WORKS_TAG } from "@/entities/work/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

const NEED_LOGIN = { ok: false as const, message: "로그인이 필요합니다." };
const imagesPath = (episodeId: string) => `/studio/episodes/${episodeId}/images`;

export async function listImages(episodeId: string): Promise<ActionResult<ComicImage[]>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<ComicImage[]>(imagesPath(episodeId), { token }));
}

/** 서버 액션 크기 제한이 있어 한 장씩 보낸다. */
export async function uploadImage(episodeId: string, data: FormData): Promise<ActionResult<ComicImage>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<ComicImage>(imagesPath(episodeId), { method: "POST", body: data, token }));
}

export async function updateImageAlt(
  episodeId: string,
  imageId: string,
  alt: string,
): Promise<ActionResult<ComicImage>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() =>
    apiFetch<ComicImage>(`${imagesPath(episodeId)}/${imageId}`, { method: "PUT", body: { alt }, token }),
  );
}

export async function moveImage(
  episodeId: string,
  imageId: string,
  direction: "up" | "down",
): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() =>
    apiFetch<null>(`${imagesPath(episodeId)}/${imageId}/move`, { method: "POST", body: { direction }, token }),
  );
}

export async function deleteImage(episodeId: string, imageId: string): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<null>(`${imagesPath(episodeId)}/${imageId}`, { method: "DELETE", token }));
}

export async function saveComicEpisode(
  episode: StudioEpisode,
  input: { title: string; authorNote: string | null; isFree: boolean },
): Promise<ActionResult<StudioEpisode>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<StudioEpisode>(`/studio/episodes/${episode.id}`, {
      method: "PUT",
      body: { ...input, content: EMPTY_DOC },
      token,
    }),
  );
  if (result.ok) {
    if (result.data.status === "PUBLISHED") updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${episode.workId}`);
  }
  return result;
}

export async function setComicPublished(
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
