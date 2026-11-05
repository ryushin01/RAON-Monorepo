import { type EpisodeInput, episodeDocSchema } from "@raon/contracts";
import { z } from "zod";
import { EPISODE_BACKUP_PREFIX, LOGOUT_SIGNAL_KEY } from "@/shared/config";

export interface DraftBackup {
  input: EpisodeInput;
  /** 언제 쓴 글인지 작가에게 보여 주는 용도다. 브라우저와 서버의 시계가 다를 수 있어 판단에는 쓰지 않는다. */
  savedAt: number;
}

/** 저장소의 값은 깨졌거나 예전 형식일 수 있으므로 쓰기 전에 형식을 확인한다. */
const backupSchema = z.object({
  savedAt: z.number(),
  input: z.object({
    title: z.string(),
    content: episodeDocSchema,
    authorNote: z.string().nullable(),
    isFree: z.boolean(),
  }),
});

const keyOf = (episodeId: string) => `${EPISODE_BACKUP_PREFIX}${episodeId}`;

/** DB의 jsonb는 키 순서를 바꾸므로 키를 정렬해 내용을 비교한다. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

export function writeBackup(episodeId: string, input: EpisodeInput, now = Date.now()): void {
  try {
    localStorage.setItem(keyOf(episodeId), JSON.stringify({ input, savedAt: now } satisfies DraftBackup));
  } catch {
    // 저장소를 쓸 수 없어도 서버 저장은 그대로 동작한다.
  }
}

export function clearBackup(episodeId: string): void {
  try {
    localStorage.removeItem(keyOf(episodeId));
  } catch {
    // 지우지 못하면 다음에 복원을 한 번 더 묻게 될 뿐이다.
  }
}

/** 서버 내용과 다른 백업만 돌려준다. 원고를 잃지 않도록, 다르면 무엇이 최신인지는 작가가 고른다. */
export function readBackup(episodeId: string, current: EpisodeInput): DraftBackup | null {
  try {
    const raw = localStorage.getItem(keyOf(episodeId));
    if (!raw) return null;
    const backup: DraftBackup = backupSchema.parse(JSON.parse(raw));
    if (canonical(backup.input) !== canonical(current)) return backup;
  } catch {
    // 깨진 값은 아래에서 지운다.
  }
  clearBackup(episodeId);
  return null;
}

/** 이 시각 이후에 어느 탭에서든 로그아웃했는지 본다. 같은 브라우저의 시계끼리 비교한다. */
export function loggedOutSince(time: number): boolean {
  try {
    return Number(localStorage.getItem(LOGOUT_SIGNAL_KEY)) >= time && time > 0;
  } catch {
    return false;
  }
}
