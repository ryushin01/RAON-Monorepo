"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CART_QUERY_KEY } from "@/entities/cart";
import { Button, Notice } from "@/shared/ui";
import { addToCart } from "../api/actions";

/** 뷰어의 잠긴 회차에서 바로 담고 장바구니로 이동한다. */
export function AddEpisodeButton({ workId, episodeId }: { workId: string; episodeId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: async (input: { workId: string; episodeId: string }) => {
      const result = await addToCart({ kind: "EPISODES", workId: input.workId, episodeIds: [input.episodeId] });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      router.push("/cart");
    },
  });
  return (
    <>
      <Button disabled={add.isPending} onClick={() => add.mutate({ workId, episodeId })}>
        {add.isPending ? "담는 중…" : "장바구니에 담고 결제하기"}
      </Button>
      {add.error && <Notice tone="error">{add.error.message}</Notice>}
    </>
  );
}
