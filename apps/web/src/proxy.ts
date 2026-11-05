import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/shared/config";

/** 로그인이 필요한 화면으로 바로 들어오면 로그인으로 보낸다. 역할과 권한은 화면과 API가 다시 확인한다. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  // 서버 액션은 스스로 로그인을 확인해 안내 문구를 돌려준다. 여기서 보내면 fetch 실패가 되어 네트워크 오류처럼 보인다.
  if (request.headers.has("next-action")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/studio/:path*", "/cart", "/my"] };
