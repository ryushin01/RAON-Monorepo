"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { Button, Notice } from "@/shared/ui";
import { createDraft, deleteDraft, moveEpisode } from "../api/actions";

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
  // 이동을 마칠 때까지 막아 초안이 두 개 생기지 않게 하고, 다른 화면에 다녀오면 다시 쓸 수 있게 한다.
  const { reset } = create;
  useLayoutEffect(() => reset, [reset]);
  const busy = create.isPending || create.isSuccess;

  return (
    <>
      <Button disabled={busy} onClick={() => create.mutate(workId)}>
        {busy ? "만드는 중…" : "새 회차 쓰기"}
      </Button>
      {create.error && <Notice tone="error">{create.error.message}</Notice>}
    </>
  );
}

export function DeleteDraftButton({ workId, episodeId, label }: { workId: string; episodeId: string; label: string }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteDraft(workId, id);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      // 누른 버튼이 사라지므로 초점을 회차 영역의 제목으로 옮긴다.
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

interface MoveProps {
  workId: string;
  episodeId: string;
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** 끌어 놓기 대신 버튼으로 옮긴다. 키보드와 단일 포인터로 쓸 수 있다(KWCAG 6.1.1, 6.5.1). */
export function MoveEpisodeButtons({ workId, episodeId, label, canMoveUp, canMoveDown }: MoveProps) {
  const router = useRouter();
  const move = useMutation({
    mutationFn: async (direction: "up" | "down") => {
      const result = await moveEpisode(workId, episodeId, direction);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => router.refresh(),
  });
  // disabled는 키보드 초점을 빼앗으므로(KWCAG 6.1.2) 처리 중에는 aria-disabled로 표시하고 코드에서 막는다.
  const go = (direction: "up" | "down") => {
    if (!move.isPending) move.mutate(direction);
  };
  return (
    <>
      <Button
        variant="secondary"
        small
        aria-label={`위로: ${label}`}
        aria-disabled={!canMoveUp || move.isPending}
        onClick={() => {
          if (canMoveUp) go("up");
        }}
      >
        위로
      </Button>
      <Button
        variant="secondary"
        small
        aria-label={`아래로: ${label}`}
        aria-disabled={!canMoveDown || move.isPending}
        onClick={() => {
          if (canMoveDown) go("down");
        }}
      >
        아래로
      </Button>
      {move.error && <Notice tone="error">{move.error.message}</Notice>}
    </>
  );
}
