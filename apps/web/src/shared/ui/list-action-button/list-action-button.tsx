"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useLockedMutation } from "@/shared/lib";
import { Button } from "../button/button";
import { Notice } from "../notice/notice";

type ActionResult = { ok: true } | { ok: false; message: string };

interface ListActionButtonProps {
  /** 서버 액션. 실패하면 받은 message를 버튼 아래에 알린다. */
  action: () => Promise<ActionResult>;
  /** 버튼 글자. 예) "복원" */
  text: string;
  /** 무엇에 대한 버튼인지. 목록에 같은 버튼이 여럿이라 접근 이름을 "글자: 대상"으로 한다. */
  target: string;
  /** 있으면 누를 때 먼저 묻는다. */
  confirmMessage?: string;
}

/**
 * 누르면 그 항목이 목록에서 사라지는 버튼(휴지통으로, 복원, 완전히 지우기 등). 회차와 작품 목록이 함께 쓴다.
 * - 처리 중에는 초점을 잃지 않게 disabled 대신 aria-disabled로 막고(KWCAG 6.1.2), 빠른 연속 클릭은 ref 잠금으로 막는다.
 * - 성공하면 누른 버튼이 사라지므로 초점을 그 영역의 제목(h2)으로 옮기고 목록을 새로 받는다. 잠금은 실패했을 때만 푼다.
 */
export function ListActionButton({ action, text, target, confirmMessage }: ListActionButtonProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mutation = useLockedMutation(
    {
      mutationFn: async () => {
        const result = await action();
        if (!result.ok) throw new Error(result.message);
      },
      onSuccess: () => {
        buttonRef.current?.closest("section")?.querySelector<HTMLElement>("h2")?.focus();
        router.refresh();
      },
    },
    { keepLockedOnSuccess: true },
  );
  return (
    <>
      <Button
        ref={buttonRef}
        variant="secondary"
        small
        aria-disabled={mutation.isPending}
        aria-label={`${text}: ${target}`}
        onClick={() => {
          if (mutation.isPending) return;
          if (!confirmMessage || window.confirm(confirmMessage)) mutation.run();
        }}
      >
        {text}
      </Button>
      {mutation.error && <Notice tone="error">{mutation.error.message}</Notice>}
    </>
  );
}
