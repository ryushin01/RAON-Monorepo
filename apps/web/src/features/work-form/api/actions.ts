"use server";

import type { StudioWorkDetail, WorkInput } from "@raon/contracts";
import { revalidatePath, updateTag } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { WORKS_TAG } from "@/entities/work/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

type WorkDraft = Omit<WorkInput, "episodePrice" | "wholePrice"> & { episodePrice: string; wholePrice: string };

function toBody(draft: WorkDraft) {
  return { ...draft, wholePrice: draft.wholePrice.trim() === "" ? null : draft.wholePrice };
}

export async function saveWork(workId: string | null, draft: WorkDraft): Promise<ActionResult<StudioWorkDetail>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() =>
    workId
      ? apiFetch<StudioWorkDetail>(`/studio/works/${workId}`, { method: "PUT", body: toBody(draft), token })
      : apiFetch<StudioWorkDetail>("/studio/works", { method: "POST", body: toBody(draft), token }),
  );
  if (result.ok) {
    updateTag(WORKS_TAG);
    revalidatePath("/studio");
  }
  return result;
}

export async function setWorkStatus(
  workId: string,
  status: "ONGOING" | "COMPLETED",
): Promise<ActionResult<StudioWorkDetail>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() =>
    apiFetch<StudioWorkDetail>(`/studio/works/${workId}/status`, { method: "POST", body: { status }, token }),
  );
  if (result.ok) {
    updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${workId}`);
  }
  return result;
}
