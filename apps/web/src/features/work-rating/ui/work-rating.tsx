"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/shared/ui";
import { setRating } from "../api/actions";
import styles from "./work-rating.module.scss";

const SCORES = [1, 2, 3, 4, 5] as const;

/** 같은 점수를 다시 누르면 지운다. 라디오는 선택만으로 저장하면 7.2.1에 어긋나므로 버튼으로 만든다. */
export function WorkRating({ workId, myRating }: { workId: string; myRating: number | null }) {
  const router = useRouter();
  const rate = useMutation({
    mutationFn: async (score: number | null) => {
      const result = await setRating(workId, score);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => router.refresh(),
  });
  const current = rate.isPending ? rate.variables : myRating;
  // disabled는 키보드 초점을 빼앗으므로(KWCAG 6.1.2) 처리 중에는 aria-disabled로 표시하고 코드에서 막는다.

  return (
    <div className={styles.rating}>
      <p className={styles.label} id={`rating-${workId}`}>
        내 별점
      </p>
      {/* biome-ignore lint/a11y/useSemanticElements: 입력 요소가 아닌 버튼 묶음이라 fieldset이 맞지 않는다. */}
      <div className={styles.scores} role="group" aria-labelledby={`rating-${workId}`}>
        {SCORES.map((score) => (
          <Button
            key={score}
            variant={current === score ? "primary" : "secondary"}
            small
            aria-pressed={current === score}
            aria-disabled={rate.isPending}
            onClick={() => {
              if (!rate.isPending) rate.mutate(current === score ? null : score);
            }}
          >
            {score}점
          </Button>
        ))}
      </div>
      {rate.error && <Notice tone="error">{rate.error.message}</Notice>}
    </div>
  );
}
