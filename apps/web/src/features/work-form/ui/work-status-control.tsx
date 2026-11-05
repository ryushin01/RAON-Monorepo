"use client";

import type { WorkStatus } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/shared/ui";
import { setWorkStatus } from "../api/actions";
import styles from "./work-form.module.scss";

export function WorkStatusControl({ workId, status }: { workId: string; status: WorkStatus }) {
  const router = useRouter();
  const change = useMutation({
    mutationFn: async (next: "ONGOING" | "COMPLETED") => {
      const result = await setWorkStatus(workId, next);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => router.refresh(),
  });
  if (status === "DRAFT") return <p>첫 회차를 공개하면 작품이 독자에게 보입니다.</p>;
  const next = status === "ONGOING" ? "COMPLETED" : "ONGOING";

  return (
    <div className={styles.status}>
      <Button variant="secondary" disabled={change.isPending} onClick={() => change.mutate(next)}>
        {next === "COMPLETED" ? "완결로 바꾸기" : "연재 중으로 되돌리기"}
      </Button>
      {change.error && <Notice tone="error">{change.error.message}</Notice>}
    </div>
  );
}
