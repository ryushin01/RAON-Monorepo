"use client";

import { useActionState } from "react";
import { Button, Notice, TextField } from "@/shared/ui";
import { signup } from "../api/actions";
import styles from "./auth-form.module.scss";
import { RoleField } from "./role-field";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, null);
  const error = state && !state.ok ? state : null;

  return (
    <form action={action} className={styles.form}>
      <RoleField legend="가입 유형" />
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
        autoComplete="new-password"
        hint="8자 이상으로 입력해 주세요."
        required
        minLength={8}
        error={error?.fieldErrors?.password}
      />
      <TextField
        label="닉네임"
        name="nickname"
        autoComplete="nickname"
        hint="작품과 함께 보이는 이름입니다."
        required
        error={error?.fieldErrors?.nickname}
      />
      {error && !error.fieldErrors && <Notice tone="error">{error.message}</Notice>}
      <Button type="submit" block disabled={pending}>
        {pending ? "가입 중…" : "가입하기"}
      </Button>
    </form>
  );
}
