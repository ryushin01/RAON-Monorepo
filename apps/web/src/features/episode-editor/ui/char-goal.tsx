"use client";

import { useState, useSyncExternalStore } from "react";
import { TextField } from "@/shared/ui";
import {
  DEFAULT_EPISODE_GOAL,
  MAX_EPISODE_GOAL,
  parseEpisodeGoal,
  readEpisodeGoal,
  subscribeEpisodeGoal,
  writeEpisodeGoal,
} from "../model/episode-goal";
import styles from "./char-goal.module.scss";

const format = (value: number) => value.toLocaleString("ko-KR");

/**
 * 회차 분량과 목표. 목표는 공백 포함 글자 수로 재고, 이 브라우저의 설정 쿠키에 둔다.
 * 입력할 때마다 읽어 주면 글을 쓰는 데 방해가 되므로 목표를 넘어설 때만 상태 영역에 알린다.
 */
export function CharGoal({
  withSpaces,
  withoutSpaces,
  compact = false,
}: {
  withSpaces: number;
  withoutSpaces: number;
  /** 집중 모드에서는 입력 칸을 숨기고 분량과 진행만 보여 준다. */
  compact?: boolean;
}) {
  const goal = useSyncExternalStore(subscribeEpisodeGoal, readEpisodeGoal, () => DEFAULT_EPISODE_GOAL);
  // 입력 중인 값. 고치기 전에는 저장된 목표를 그대로 보여 준다.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseEpisodeGoal(draft) === undefined;
  const reached = goal !== null && withSpaces >= goal;

  return (
    <div className={styles.goal}>
      <p className={styles.count}>
        공백 포함 {format(withSpaces)}자 · 공백 제외 {format(withoutSpaces)}자
      </p>
      <div className={styles.setting}>
        <div hidden={compact}>
          <TextField
            label="회차 목표(공백 포함 글자 수)"
            inputMode="numeric"
            value={draft ?? (goal === null ? "" : String(goal))}
            error={invalid ? `1부터 ${format(MAX_EPISODE_GOAL)} 사이의 숫자로 입력해 주세요.` : undefined}
            hint="비워 두면 목표를 쓰지 않습니다. 이 브라우저에 저장합니다."
            onChange={(event) => {
              const parsed = parseEpisodeGoal(event.target.value);
              setDraft(event.target.value);
              if (parsed !== undefined) writeEpisodeGoal(parsed);
            }}
            onBlur={() => {
              if (!invalid) setDraft(null);
            }}
          />
        </div>
        {goal !== null && (
          <div className={styles.progress}>
            <progress
              className={styles.bar}
              aria-label="회차 목표 달성률"
              value={Math.min(withSpaces, goal)}
              max={goal}
            />
            {!reached && (
              <p className={styles.remaining}>
                목표 {format(goal)}자까지 {format(goal - withSpaces)}자 남음
              </p>
            )}
          </div>
        )}
      </div>
      {/* 상태 영역은 내용이 바뀌기 전부터 있어야 스크린 리더가 읽는다. */}
      <p className={styles.reached} role="status">
        {reached ? `목표 ${format(goal)}자를 달성했습니다.` : ""}
      </p>
    </div>
  );
}
