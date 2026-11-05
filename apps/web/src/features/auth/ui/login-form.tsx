"use client";

import { useActionState } from "react";
import { Button, Notice, TextField } from "@/shared/ui";
import { login } from "../api/actions";
import styles from "./auth-form.module.scss";
import { RoleField } from "./role-field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, null);
  const error = state && !state.ok ? state : null;

  return (
    <form action={action} className={styles.form}>
      {next && <input type="hidden" name="next" value={next} />}
      <RoleField legend="회원 유형" />
      <TextField
        label="이메일"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={error?.fieldErrors?.email}
      />
      <TextField
        label="비밀번호"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={error?.fieldErrors?.password}
      />
      {error && !error.fieldErrors && <Notice tone="error">{error.message}</Notice>}
      <Button type="submit" block disabled={pending}>
        {pending ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
