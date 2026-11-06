import { EPISODE_GOAL_COOKIE } from "@/shared/config";
import { readPreference, writePreference } from "@/shared/lib";

/** 웹소설 한 화의 흔한 분량(공백 포함). */
export const DEFAULT_EPISODE_GOAL = 5000;
export const MAX_EPISODE_GOAL = 100_000;

const NO_GOAL = "0";

const listeners = new Set<() => void>();

export function subscribeEpisodeGoal(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 입력값을 목표로 바꾼다. 비우면 목표 없음(null), 잘못된 값이면 undefined다. */
export function parseEpisodeGoal(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const goal = Number(trimmed);
  return goal >= 1 && goal <= MAX_EPISODE_GOAL ? goal : undefined;
}

export function readEpisodeGoal(): number | null {
  const saved = readPreference(EPISODE_GOAL_COOKIE);
  if (saved === undefined) return DEFAULT_EPISODE_GOAL;
  if (saved === NO_GOAL) return null;
  // 쿠키는 사용자가 고칠 수 있으므로 잘못된 값이면 기본값으로 돌아간다.
  return parseEpisodeGoal(saved) ?? DEFAULT_EPISODE_GOAL;
}

export function writeEpisodeGoal(goal: number | null) {
  writePreference(EPISODE_GOAL_COOKIE, goal === null ? NO_GOAL : String(goal));
  for (const listener of listeners) listener();
}
