import "server-only";

import type { Role, User } from "@raon/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError, apiFetch } from "@/shared/api/index.server";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/shared/config";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSession(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** 요청 하나에서 여러 번 불러도 API는 한 번만 부른다. 토큰이 만료되었으면 비로그인으로 다룬다. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiFetch<User>("/me", { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

/**
 * 화면 진입 조건을 확인한다. 실제 권한은 API가 다시 검사한다.
 * 역할이 맞지 않으면 그 역할의 첫 화면으로 보낸다.
 */
export async function requireUser(role: Role, nextPath: string): Promise<{ user: User; token: string }> {
  const user = await getCurrentUser();
  const token = await getSessionToken();
  if (!user || !token) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.role !== role) redirect(user.role === "AUTHOR" ? "/studio" : "/");
  return { user, token };
}
