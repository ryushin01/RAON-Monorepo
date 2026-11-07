"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Button, Notice } from "@/shared/ui";
import { purgeWork, restoreWork, trashWork } from "../api/actions";

/** 공개 중인 작품은 독자에게 바로 보이지 않게 되므로 되돌릴 수 있어도 먼저 묻는다. */
export function DeleteWorkButton({ workId, title }: { workId: string; title: string }) {
  const router = useRouter();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await trashWork(id);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => router.push("/studio"),
  });
  return (
    <>
      <Button
        variant="secondary"
        aria-disabled={remove.isPending}
        onClick={() => {
          if (remove.isPending) return;
          if (window.confirm(`‘${title}’ 작품을 휴지통으로 옮길까요? 독자에게 보이지 않게 됩니다.`)) {
            remove.mutate(workId);
          }
        }}
      >
        휴지통으로 옮기기
      </Button>
      {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
    </>
  );
}

interface TrashActionProps {
  workId: string;
  title: string;
  action: (workId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  text: string;
  confirmMessage?: string;
}

/** 누른 버튼이 목록에서 사라지므로 초점을 그 영역의 제목으로 옮긴다(KWCAG 6.1.2). */
function TrashActionButton({ workId, title, action, text, confirmMessage }: TrashActionProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await action(id);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      buttonRef.current?.closest("section")?.querySelector<HTMLElement>("h2")?.focus();
      router.refresh();
    },
  });
  return (
    <>
      <Button
        ref={buttonRef}
        variant="secondary"
        small
        aria-disabled={mutation.isPending}
        aria-label={`${text}: ${title}`}
        onClick={() => {
          if (mutation.isPending) return;
          if (!confirmMessage || window.confirm(confirmMessage)) mutation.mutate(workId);
        }}
      >
        {text}
      </Button>
      {mutation.error && <Notice tone="error">{mutation.error.message}</Notice>}
    </>
  );
}

export function RestoreWorkButton(props: { workId: string; title: string }) {
  return <TrashActionButton {...props} action={restoreWork} text="복원" />;
}

export function PurgeWorkButton(props: { workId: string; title: string }) {
  return (
    <TrashActionButton
      {...props}
      action={purgeWork}
      text="완전히 지우기"
      confirmMessage={`‘${props.title}’ 작품을 완전히 지울까요? 회차, 버전 기록, 설정집, 복선도 함께 사라지고 되돌릴 수 없습니다.`}
    />
  );
}
