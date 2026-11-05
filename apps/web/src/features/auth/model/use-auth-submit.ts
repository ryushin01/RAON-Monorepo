import type { Role } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef } from "react";
import type { ActionResult } from "@/shared/api";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * 로그인과 회원가입의 공통 제출 흐름. 폼 값을 mutate로 직접 넘기고, 처리 중이거나 이동 중이면 다시 보내지 않는다.
 * 성공하면 전체 새로고침으로 이동하고, 실패하면 첫 번째 잘못된 입력 칸으로 초점을 옮긴다.
 */
export function useAuthSubmit<Input>(
  send: (input: Input) => Promise<ActionResult<{ path: string }>>,
  read: (form: FormData) => Input,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const mutation = useMutation({
    mutationFn: async (input: Input) => {
      const result = await send(input);
      if (!result.ok) throw new AuthError(result.message, result.fieldErrors);
      return result.data.path;
    },
    onSuccess: (path) => window.location.assign(path),
  });
  const fieldErrors = mutation.error instanceof AuthError ? mutation.error.fieldErrors : undefined;
  const busy = mutation.isPending || mutation.isSuccess;

  useEffect(() => {
    if (fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy) mutation.mutate(read(new FormData(event.currentTarget)));
  };

  return { formRef, onSubmit, busy, fieldErrors, formError: fieldErrors ? undefined : mutation.error?.message };
}

export const readText = (form: FormData, name: string) => String(form.get(name) ?? "");
export const readRole = (form: FormData) => readText(form, "role") as Role;
