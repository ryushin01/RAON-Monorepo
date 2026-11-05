"use client";

import { Button, Notice, TextField } from "@/shared/ui";
import { login } from "../api/actions";
import { readRole, readText, useAuthSubmit } from "../model/use-auth-submit";
import styles from "./auth-form.module.scss";
import { RoleField } from "./role-field";

export function LoginForm({ next }: { next?: string }) {
  const { formRef, onSubmit, busy, fieldErrors, formError } = useAuthSubmit(login, (form) => ({
    email: readText(form, "email"),
    password: readText(form, "password"),
    role: readRole(form),
    next,
  }));

  return (
    <form ref={formRef} onSubmit={onSubmit} className={styles.form}>
      <RoleField legend="회원 유형" />
      <TextField label="이메일" name="email" type="email" autoComplete="email" required error={fieldErrors?.email} />
      <TextField
        label="비밀번호"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldErrors?.password}
      />
      {formError && <Notice tone="error">{formError}</Notice>}
      <Button type="submit" block disabled={busy}>
        {busy ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
