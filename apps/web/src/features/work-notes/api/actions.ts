"use server";

import type { NoteInput, WorkNote, WorkSearchResult } from "@raon/contracts";
import { getSessionToken } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

const NEED_LOGIN = { ok: false as const, message: "로그인이 필요합니다." };

export async function listNotes(workId: string): Promise<ActionResult<WorkNote[]>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<WorkNote[]>(`/studio/works/${workId}/notes`, { token }));
}

export async function saveNote(
  workId: string,
  noteId: string | null,
  input: NoteInput,
): Promise<ActionResult<WorkNote>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() =>
    noteId
      ? apiFetch<WorkNote>(`/studio/notes/${noteId}`, { method: "PUT", body: input, token })
      : apiFetch<WorkNote>(`/studio/works/${workId}/notes`, { method: "POST", body: input, token }),
  );
}

export async function deleteNote(noteId: string): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<null>(`/studio/notes/${noteId}`, { method: "DELETE", token }));
}

export async function searchWork(workId: string, query: string): Promise<ActionResult<WorkSearchResult>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() =>
    apiFetch<WorkSearchResult>(`/studio/works/${workId}/search?q=${encodeURIComponent(query)}`, { token }),
  );
}
