"use client";

import { useMutation } from "@tanstack/react-query";
import { Button, Notice } from "@/shared/ui";
import { setFavorite } from "../api/actions";

export function FavoriteButton({ workId, isFavorite }: { workId: string; isFavorite: boolean }) {
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const result = await setFavorite(workId, next);
      if (!result.ok) throw new Error(result.message);
    },
  });
  // 서버 값이 다시 올 때까지 누른 값을 먼저 보여 준다.
  const pressed = toggle.isPending ? toggle.variables : isFavorite;

  return (
    <>
      <Button
        variant="secondary"
        aria-pressed={pressed}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!pressed)}
      >
        {pressed ? "✓ 선호작" : "선호작 추가"}
      </Button>
      {toggle.error && <Notice tone="error">{toggle.error.message}</Notice>}
    </>
  );
}
