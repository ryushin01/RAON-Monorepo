"use client";

import { useRouter } from "next/navigation";
import { useLockedMutation } from "@/shared/lib";
import { Button, ListActionButton, Notice } from "@/shared/ui";
import { purgeWork, restoreWork, trashWork } from "../api/actions";

/** 공개 중인 작품은 독자에게 바로 보이지 않게 되므로 되돌릴 수 있어도 먼저 묻는다. */
export function DeleteWorkButton({ workId, title }: { workId: string; title: string }) {
  const router = useRouter();
  const remove = useLockedMutation(
    {
      mutationFn: async (id: string) => {
        const result = await trashWork(id);
        if (!result.ok) throw new Error(result.message);
      },
      onSuccess: () => router.push("/studio"),
    },
    { keepLockedOnSuccess: true },
  );
  return (
    <>
      <Button
        variant="secondary"
        aria-disabled={remove.isPending}
        onClick={() => {
          if (remove.isPending) return;
          if (window.confirm(`‘${title}’ 작품을 휴지통으로 옮길까요? 독자에게 보이지 않게 됩니다.`)) {
            remove.run(workId);
          }
        }}
      >
        휴지통으로 옮기기
      </Button>
      {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
    </>
  );
}

export function RestoreWorkButton({ workId, title }: { workId: string; title: string }) {
  return <ListActionButton action={() => restoreWork(workId)} text="복원" target={title} />;
}

export function PurgeWorkButton({ workId, title }: { workId: string; title: string }) {
  return (
    <ListActionButton
      action={() => purgeWork(workId)}
      text="완전히 지우기"
      target={title}
      confirmMessage={`‘${title}’ 작품을 완전히 지울까요? 회차, 버전 기록, 설정집, 복선도 함께 사라지고 되돌릴 수 없습니다.`}
    />
  );
}
