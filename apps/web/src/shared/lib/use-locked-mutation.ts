"use client";

import { type DefaultError, type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

interface LockOptions {
  /** 성공하면 화면을 떠나거나 누른 항목이 사라지는 동작은 성공해도 잠금을 풀지 않는다. */
  keepLockedOnSuccess?: boolean;
}

/**
 * 중복 실행을 막는 mutation. isPending은 다음 렌더에야 바뀌어, 빠르게 두 번 누르면 요청이 두 번 나간다.
 * 그래서 ref로 잠그고, 버튼과 폼은 mutate 대신 run을 부른다. 잠겨 있으면 아무것도 하지 않고 false를 돌려준다.
 * 실패하면 잠금을 풀어 다시 누를 수 있다. reset도 잠금을 푼다(다른 화면에 다녀왔을 때).
 */
export function useLockedMutation<TData = unknown, TError = DefaultError, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  { keepLockedOnSuccess = false }: LockOptions = {},
) {
  const locked = useRef(false);
  const mutation = useMutation(options);
  const { mutate, reset: resetMutation } = mutation;

  const run = useCallback(
    (variables: TVariables) => {
      if (locked.current) return false;
      locked.current = true;
      mutate(variables, {
        onError: () => {
          locked.current = false;
        },
        onSuccess: () => {
          if (!keepLockedOnSuccess) locked.current = false;
        },
      });
      return true;
    },
    [mutate, keepLockedOnSuccess],
  );

  const reset = useCallback(() => {
    locked.current = false;
    resetMutation();
  }, [resetMutation]);

  return { ...mutation, run, reset };
}
