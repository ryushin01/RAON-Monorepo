"use server";

import type { Foreshadow, ForeshadowInput } from "@raon/contracts";
import { getSessionToken } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

const NEED_LOGIN = { ok: false as const, message: "로그인이 필요합니다." };

export async function listForeshadows(workId: string): Promise<ActionResult<Foreshadow[]>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<Foreshadow[]>(`/studio/works/${workId}/foreshadows`, { token }));
}

export async function saveForeshadow(
  workId: string,
  id: string | null,
  input: ForeshadowInput,
): Promise<ActionResult<Foreshadow>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() =>
    id
      ? apiFetch<Foreshadow>(`/studio/foreshadows/${id}`, { method: "PUT", body: input, token })
      : apiFetch<Foreshadow>(`/studio/works/${workId}/foreshadows`, { method: "POST", body: input, token }),
  );
}

export async function deleteForeshadow(id: string): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  return toActionResult(() => apiFetch<null>(`/studio/foreshadows/${id}`, { method: "DELETE", token }));
}
