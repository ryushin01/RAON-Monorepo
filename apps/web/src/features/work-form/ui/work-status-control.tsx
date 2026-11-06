"use client";

import type { WorkStatus } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, Notice } from "@/shared/ui";
import { setWorkStatus } from "../api/actions";
import styles from "./work-form.module.scss";

export function WorkStatusControl({ workId, status }: { workId: string; status: WorkStatus }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const change = useMutation({
    mutationFn: async (next: "ONGOING" | "COMPLETED") => {
      const result = await setWorkStatus(workId, next);
      if (!result.ok) throw new Error(result.message);
    },
    // 새 화면을 받기 전에는 status가 옛값이라 다시 누르면 같은 값을 또 보내므로 함께 막는다.
    onSuccess: () => startRefresh(() => router.refresh()),
  });
  if (status === "DRAFT") return <p>첫 회차를 공개하면 작품이 독자에게 보입니다.</p>;
  const next = status === "ONGOING" ? "COMPLETED" : "ONGOING";

  return (
    <div className={styles.status}>
      <Button variant="secondary" disabled={change.isPending || refreshing} onClick={() => change.mutate(next)}>
        {next === "COMPLETED" ? "완결로 바꾸기" : "연재 중으로 되돌리기"}
      </Button>
      {change.error && <Notice tone="error">{change.error.message}</Notice>}
    </div>
  );
}
