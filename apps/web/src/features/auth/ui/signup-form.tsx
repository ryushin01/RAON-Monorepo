"use client";

import { Button, Notice, TextField } from "@/shared/ui";
import { signup } from "../api/actions";
import { readRole, readText, useAuthSubmit } from "../model/use-auth-submit";
import styles from "./auth-form.module.scss";
import { RoleField } from "./role-field";

export function SignupForm() {
  const { formRef, onSubmit, busy, fieldErrors, formError } = useAuthSubmit(signup, (form) => ({
    email: readText(form, "email"),
    password: readText(form, "password"),
    nickname: readText(form, "nickname"),
    role: readRole(form),
  }));

  return (
    <form ref={formRef} onSubmit={onSubmit} className={styles.form}>
      <RoleField legend="가입 유형" />
      <TextField label="이메일" name="email" type="email" autoComplete="email" required error={fieldErrors?.email} />
      <TextField
        label="비밀번호"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="8자 이상으로 입력해 주세요."
        required
        minLength={8}
        error={fieldErrors?.password}
      />
      <TextField
        label="닉네임"
        name="nickname"
        autoComplete="nickname"
        hint="작품과 함께 보이는 이름입니다."
        required
        error={fieldErrors?.nickname}
      />
      {formError && <Notice tone="error">{formError}</Notice>}
      <Button type="submit" block disabled={busy}>
        {busy ? "가입 중…" : "가입하기"}
      </Button>
    </form>
  );
}
