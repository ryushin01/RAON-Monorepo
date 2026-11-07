"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type SortableItem, SortableList } from "@/shared/ui";
import { reorderEpisodes } from "../api/actions";

/** 회차를 끌어 놓아 옮긴다. 각 줄의 위로·아래로 버튼도 그대로 쓸 수 있다. */
export function EpisodeOrderList({
  workId,
  items,
  listClassName,
}: {
  workId: string;
  items: SortableItem[];
  listClassName?: string;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  return (
    <SortableList
      name="회차 목록"
      items={items}
      listClassName={listClassName}
      onReorder={async (ids) => {
        const result = await reorderEpisodes(workId, ids);
        if (!result.ok) throw new Error(result.message);
        // 번호가 새로 매겨졌으므로 서버에서 다시 받는다.
        startRefresh(() => router.refresh());
      }}
    />
  );
}
