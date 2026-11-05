"use server";

import type { AuthResult, LoginInput, Role, SignupInput } from "@raon/contracts";
import { redirect } from "next/navigation";
import { clearSession, setSession } from "@/entities/session/index.server";
import { type ActionResult, apiFetch, toActionResult } from "@/shared/api/index.server";
import { safeNextPath } from "@/shared/lib";

export type AuthFormState = ActionResult | null;

function destination(role: Role, next: FormDataEntryValue | null) {
  return role === "AUTHOR" ? safeNextPath(next, "/studio") : safeNextPath(next, "/");
}

export async function login(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = {
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    role: String(form.get("role") ?? "READER") as LoginInput["role"],
  };
  const result = await toActionResult(() => apiFetch<AuthResult>("/auth/login", { method: "POST", body: input }));
  if (!result.ok) return result;
  await setSession(result.data.accessToken);
  redirect(destination(result.data.user.role, form.get("next")));
}

export async function signup(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = {
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    nickname: String(form.get("nickname") ?? ""),
    role: String(form.get("role") ?? "READER") as SignupInput["role"],
  };
  const result = await toActionResult(() => apiFetch<AuthResult>("/auth/signup", { method: "POST", body: input }));
  if (!result.ok) return result;
  await setSession(result.data.accessToken);
  redirect(destination(result.data.user.role, null));
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
