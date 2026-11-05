import { NextResponse } from "next/server";
import { getCart } from "@/entities/cart/index.server";
import { getSessionToken } from "@/entities/session/index.server";
import { ApiError } from "@/shared/api/index.server";

/** 머리글의 장바구니 수를 위한 조회. 일반 회원이 아니면 빈 값이다. */
export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ count: 0 });
  try {
    const cart = await getCart(token);
    return NextResponse.json({ count: cart.items.length });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return NextResponse.json({ count: 0 });
    }
    throw error;
  }
}
