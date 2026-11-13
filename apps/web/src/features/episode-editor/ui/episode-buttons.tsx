"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";
import { useLockedMutation } from "@/shared/lib";
import { Button, ListActionButton, Notice } from "@/shared/ui";
import { createDraft, moveEpisode, purgeEpisode, restoreFromTrash, trashDraft } from "../api/actions";

/** 빈 초안을 만들고 그 회차의 편집 화면으로 간다. */
export function NewEpisodeButton({ workId }: { workId: string }) {
  const router = useRouter();
  const create = useLockedMutation(
    {
      mutationFn: async (id: string) => {
        const result = await createDraft(id);
        if (!result.ok) throw new Error(result.message);
        return result.data;
      },
      onSuccess: (episode) => router.push(`/studio/works/${workId}/episodes/${episode.id}`),
    },
    { keepLockedOnSuccess: true },
  );
  // 이동을 마칠 때까지 막아 초안이 두 개 생기지 않게 하고, 다른 화면에 다녀오면 다시 쓸 수 있게 한다.
  const { reset } = create;
  useLayoutEffect(() => reset, [reset]);
  const busy = create.isPending || create.isSuccess;

  return (
    <>
      <Button disabled={busy} onClick={() => create.run(workId)}>
        {busy ? "만드는 중…" : "새 회차 쓰기"}
      </Button>
      {create.error && <Notice tone="error">{create.error.message}</Notice>}
    </>
  );
}

interface EpisodeButtonProps {
  workId: string;
  episodeId: string;
  label: string;
}

/** 휴지통에서 되살릴 수 있으므로 묻지 않고 옮긴다. */
export function TrashDraftButton({ workId, episodeId, label }: EpisodeButtonProps) {
  return <ListActionButton action={() => trashDraft(workId, episodeId)} text="휴지통으로" target={label} />;
}

export function RestoreTrashedButton({ workId, episodeId, label }: EpisodeButtonProps) {
  return <ListActionButton action={() => restoreFromTrash(workId, episodeId)} text="복원" target={label} />;
}

export function PurgeTrashedButton({ workId, episodeId, label }: EpisodeButtonProps) {
  return (
    <ListActionButton
      action={() => purgeEpisode(workId, episodeId)}
      text="완전히 지우기"
      target={label}
      confirmMessage={`${label}을 완전히 지울까요? 버전 기록과 회차 메모도 함께 사라지고 되돌릴 수 없습니다.`}
    />
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
  const move = useLockedMutation({
    mutationFn: async (direction: "up" | "down") => {
      const result = await moveEpisode(workId, episodeId, direction);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => router.refresh(),
  });
  // disabled는 키보드 초점을 빼앗으므로(KWCAG 6.1.2) 처리 중에는 aria-disabled로 표시하고, 빠르게 두 번 누르면 잠금으로 막는다.
  const go = (direction: "up" | "down") => move.run(direction);
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
