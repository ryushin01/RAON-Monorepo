"use server";

import { revalidatePath } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

const NEED_LOGIN = { ok: false as const, message: "로그인이 필요합니다." };

export async function addComment(episodeId: string, body: string, path: string): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<null>(`/episodes/${episodeId}/comments`, { method: "POST", body: { body }, token }),
  );
  if (result.ok) revalidatePath(path);
  return result;
}

export async function deleteComment(commentId: string, path: string): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() => apiFetch<null>(`/comments/${commentId}`, { method: "DELETE", token }));
  if (result.ok) revalidatePath(path);
  return result;
}
