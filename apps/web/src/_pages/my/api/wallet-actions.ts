"use server";

import type { ChargeInput, Wallet } from "@raon/contracts";
import { revalidatePath } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

export async function chargeCoins(input: ChargeInput): Promise<ActionResult<Wallet>> {
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "로그인이 필요합니다." };
  const result = await toActionResult(() => apiFetch<Wallet>("/wallet/charge", { method: "POST", body: input, token }));
  if (result.ok) revalidatePath("/my");
  return result;
}
