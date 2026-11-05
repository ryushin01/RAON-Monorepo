/** @jest-environment node */
import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/shared/config";
import { proxy } from "./proxy";

const URL_STUDIO = "http://localhost:3100/studio/works/1";

function run(headers: Record<string, string> = {}) {
  return proxy(new NextRequest(URL_STUDIO, { headers }));
}

describe("proxy", () => {
  it("세션 없이 화면에 들어오면 로그인으로 보낸다", () => {
    expect(run().headers.get("location")).toContain("/login?next=%2Fstudio%2Fworks%2F1");
  });

  it("세션이 있으면 통과한다", () => {
    expect(run({ cookie: `${SESSION_COOKIE}=token` }).headers.get("location")).toBeNull();
  });

  it("세션 없는 서버 액션은 보내지 않아 액션이 로그인 안내를 돌려줄 수 있다", () => {
    expect(run({ "next-action": "abc" }).headers.get("location")).toBeNull();
  });
});
