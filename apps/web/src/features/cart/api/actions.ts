"use server";

import type { AddCartItemInput, Cart, OrderResult } from "@raon/contracts";
import { revalidatePath } from "next/cache";
import { getSessionToken } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";

const NEED_LOGIN: ActionResult<never> = { ok: false, message: "로그인이 필요합니다." };

export async function addToCart(input: AddCartItemInput): Promise<ActionResult<Cart>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() => apiFetch<Cart>("/cart/items", { method: "POST", body: input, token }));
  if (result.ok) revalidatePath(`/works/${input.workId}`);
  return result;
}

export async function removeFromCart(itemId: string): Promise<ActionResult<Cart>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() => apiFetch<Cart>(`/cart/items/${itemId}`, { method: "DELETE", token }));
  if (result.ok) revalidatePath("/cart");
  return result;
}

export async function checkout(idempotencyKey: string): Promise<ActionResult<OrderResult>> {
  const token = await getSessionToken();
  if (!token) return NEED_LOGIN;
  const result = await toActionResult(() =>
    apiFetch<OrderResult>("/orders", { method: "POST", body: { idempotencyKey }, token }),
  );
  if (result.ok) {
    revalidatePath("/cart");
    revalidatePath("/my");
  }
  return result;
}
