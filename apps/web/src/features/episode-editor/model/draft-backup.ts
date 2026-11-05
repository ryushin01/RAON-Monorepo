import type { EpisodeInput } from "@raon/contracts";
import { EPISODE_BACKUP_PREFIX } from "@/shared/config";

export interface DraftBackup {
  input: EpisodeInput;
  savedAt: number;
}

const keyOf = (episodeId: string) => `${EPISODE_BACKUP_PREFIX}${episodeId}`;

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
    // 지우지 못해도 서버보다 오래된 백업은 readBackup이 걸러 낸다.
  }
}

/** 서버의 마지막 저장보다 새로운 백업만 돌려준다. 오래된 백업은 지운다. */
export function readBackup(episodeId: string, serverUpdatedAt: string): DraftBackup | null {
  try {
    const raw = localStorage.getItem(keyOf(episodeId));
    if (!raw) return null;
    const backup = JSON.parse(raw) as DraftBackup;
    if (backup.savedAt > Date.parse(serverUpdatedAt)) return backup;
  } catch {
    // 깨진 값은 아래에서 지운다.
  }
  clearBackup(episodeId);
  return null;
}
