import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/shared/config";

/** 로그인이 필요한 화면으로 바로 들어오면 로그인으로 보낸다. 역할과 권한은 화면과 API가 다시 확인한다. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/studio/:path*", "/cart", "/my"] };
