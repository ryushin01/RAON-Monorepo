"use server";

import type { StudioWorkDetail, WorkInput } from "@raon/contracts";
import { revalidatePath, updateTag } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { WORKS_TAG } from "@/entities/work/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

type WorkDraft = Omit<WorkInput, "episodePrice" | "wholePrice" | "tags"> & {
  episodePrice: string;
  wholePrice: string;
  /** 쉼표로 구분한 태그 */
  tags: string;
};

function toBody(draft: WorkDraft) {
  return {
    ...draft,
    wholePrice: draft.wholePrice.trim() === "" ? null : draft.wholePrice,
    tags: draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
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

/** 독자에게 바로 보이지 않게 되므로 공개 목록의 캐시도 비운다. */
async function changeWork(path: string, method: "POST" | "DELETE"): Promise<ActionResult<null>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() => apiFetch<null>(path, { method, token }));
  if (result.ok) {
    updateTag(WORKS_TAG);
    revalidatePath("/studio");
  }
  return result;
}

export async function trashWork(workId: string): Promise<ActionResult<null>> {
  return changeWork(`/studio/works/${workId}`, "DELETE");
}

export async function restoreWork(workId: string): Promise<ActionResult<null>> {
  return changeWork(`/studio/works/${workId}/restore`, "POST");
}

export async function purgeWork(workId: string): Promise<ActionResult<null>> {
  return changeWork(`/studio/works/${workId}/permanent`, "DELETE");
}

export async function uploadCover(workId: string, data: FormData): Promise<ActionResult<StudioWorkDetail>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() =>
    apiFetch<StudioWorkDetail>(`/studio/works/${workId}/cover`, { method: "PUT", body: data, token }),
  );
  if (result.ok) {
    updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${workId}`);
  }
  return result;
}

export async function deleteCover(workId: string): Promise<ActionResult<StudioWorkDetail>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() =>
    apiFetch<StudioWorkDetail>(`/studio/works/${workId}/cover`, { method: "DELETE", token }),
  );
  if (result.ok) {
    updateTag(WORKS_TAG);
    revalidatePath(`/studio/works/${workId}`);
  }
  return result;
}
