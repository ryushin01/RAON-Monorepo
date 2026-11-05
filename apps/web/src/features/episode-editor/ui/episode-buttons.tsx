"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/shared/ui";
import { createDraft, deleteDraft } from "../api/actions";

/** 빈 초안을 만들고 그 회차의 편집 화면으로 간다. */
export function NewEpisodeButton({ workId }: { workId: string }) {
  const router = useRouter();
  const create = useMutation({
    mutationFn: async (id: string) => {
      const result = await createDraft(id);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (episode) => router.push(`/studio/works/${workId}/episodes/${episode.id}`),
  });
  return (
    <>
      <Button disabled={create.isPending} onClick={() => create.mutate(workId)}>
        {create.isPending ? "만드는 중…" : "새 회차 쓰기"}
      </Button>
      {create.error && <Notice tone="error">{create.error.message}</Notice>}
    </>
  );
}

export function DeleteDraftButton({ workId, episodeId, label }: { workId: string; episodeId: string; label: string }) {
  const router = useRouter();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteDraft(workId, id);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => router.refresh(),
  });
  return (
    <>
      <Button
        variant="secondary"
        small
        disabled={remove.isPending}
        aria-label={`삭제: ${label}`}
        onClick={() => {
          if (window.confirm(`${label} 초안을 지울까요? 되돌릴 수 없습니다.`)) remove.mutate(episodeId);
        }}
      >
        삭제
      </Button>
      {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
    </>
  );
}
