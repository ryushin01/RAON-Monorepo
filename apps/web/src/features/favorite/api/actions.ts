"use server";

import { revalidatePath } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

export async function setFavorite(workId: string, favorite: boolean): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() =>
    apiFetch<null>(`/works/${workId}/favorite`, { method: favorite ? "PUT" : "DELETE", token }),
  );
  if (result.ok) {
    revalidatePath(`/works/${workId}`);
    revalidatePath("/my");
  }
  return result;
}
