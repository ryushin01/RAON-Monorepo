"use client";

import { useLockedMutation } from "@/shared/lib";
import { Button, Notice } from "@/shared/ui";
import { setFavorite } from "../api/favorite-actions";

export function FavoriteButton({ workId, isFavorite }: { workId: string; isFavorite: boolean }) {
  const toggle = useLockedMutation({
    mutationFn: async (next: boolean) => {
      const result = await setFavorite(workId, next);
      if (!result.ok) throw new Error(result.message);
    },
  });
  // 서버 값이 다시 올 때까지 누른 값을 먼저 보여 준다.
  const pressed = toggle.isPending ? toggle.variables : isFavorite;
  // disabled는 키보드 초점을 빼앗으므로(KWCAG 6.1.2) 처리 중에는 aria-disabled로 표시하고 코드에서 막는다.

  return (
    <>
      <Button
        variant="secondary"
        aria-pressed={pressed}
        aria-disabled={toggle.isPending}
        onClick={() => {
          if (!toggle.isPending) toggle.run(!pressed);
        }}
      >
        {pressed ? "✓ 선호작" : "선호작 추가"}
      </Button>
      {toggle.error && <Notice tone="error">{toggle.error.message}</Notice>}
    </>
  );
}
