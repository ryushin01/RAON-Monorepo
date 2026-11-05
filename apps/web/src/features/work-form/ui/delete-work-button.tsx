"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/shared/ui";
import { deleteWork } from "../api/actions";

export function DeleteWorkButton({ workId, title }: { workId: string; title: string }) {
  const router = useRouter();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteWork(id);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => router.push("/studio"),
  });
  return (
    <>
      <Button
        variant="secondary"
        disabled={remove.isPending}
        onClick={() => {
          if (window.confirm(`‘${title}’ 작품과 모든 회차를 지울까요? 되돌릴 수 없습니다.`)) remove.mutate(workId);
        }}
      >
        작품 삭제
      </Button>
      {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
    </>
  );
}
