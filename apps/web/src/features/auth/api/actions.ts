"use server";

import type { AuthResult, LoginInput, Role, SignupInput } from "@raon/contracts";
import { clearSession, setSession } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";
import { safeNextPath } from "@/shared/lib";

function destination(role: Role, next?: string) {
  return role === "AUTHOR" ? safeNextPath(next, "/studio") : safeNextPath(next, "/");
}

async function authenticate(path: string, body: unknown, next?: string): Promise<ActionResult<{ path: string }>> {
  const result = await toActionResult(() => apiFetch<AuthResult>(path, { method: "POST", body }));
  if (!result.ok) return result;
  await setSession(result.data.accessToken);
  return { ok: true, data: { path: destination(result.data.user.role, next) } };
}

/** 로그인 뒤 갈 주소를 돌려준다. 화면이 전체 새로고침으로 이동해 이전 상태의 숨겨진 화면을 지운다. */
export async function login(input: LoginInput & { next?: string }) {
  const { next, ...body } = input;
  return authenticate("/auth/login", body, next);
}

export async function signup(input: SignupInput) {
  return authenticate("/auth/signup", input);
}

export async function logout(): Promise<void> {
  await clearSession();
}
