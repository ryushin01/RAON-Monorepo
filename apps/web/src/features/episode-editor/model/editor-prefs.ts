import { EDITOR_PREFS_COOKIE } from "@/shared/config";
import { readPreference, writePreference } from "@/shared/lib";

export interface EditorPrefs {
  /** 본문과 도구 모음만 남긴다. */
  focus: boolean;
  /** 쓰고 있는 줄을 화면 가운데에 둔다. */
  typewriter: boolean;
  /** 커서가 있는 단락 말고는 흐리게 보여 준다. */
  dim: boolean;
  /** 곧은 따옴표와 점 세 개를 입력할 때 표준 기호로 바꾼다. */
  smartInput: boolean;
  /** 여는 괄호를 쓰면 닫는 괄호를 함께 넣는다. */
  autoBracket: boolean;
  /** 본문의 설정 이름을 표시하고 커서가 놓이면 내용을 보여 준다. */
  noteLinks: boolean;
}

export const DEFAULT_EDITOR_PREFS: EditorPrefs = {
  focus: false,
  typewriter: false,
  dim: false,
  smartInput: true,
  autoBracket: true,
  noteLinks: true,
};

const listeners = new Set<() => void>();
let cachedRaw: string | undefined;
let cached = DEFAULT_EDITOR_PREFS;

export function subscribeEditorPrefs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 값이 그대로면 같은 객체를 돌려준다. useSyncExternalStore가 변경으로 착각하지 않게 하기 위해서다. */
export function readEditorPrefs(): EditorPrefs {
  const raw = readPreference(EDITOR_PREFS_COOKIE);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = { ...DEFAULT_EDITOR_PREFS };
  if (raw) {
    try {
      // 쿠키는 사용자가 고칠 수 있으므로 알고 있는 키의 불리언 값만 받는다.
      const saved = JSON.parse(raw) as Record<string, unknown>;
      for (const key of Object.keys(DEFAULT_EDITOR_PREFS) as (keyof EditorPrefs)[]) {
        const value = saved[key];
        if (typeof value === "boolean") cached[key] = value;
      }
    } catch {
      // 깨진 쿠키는 기본값으로 돌아간다.
    }
  }
  return cached;
}

export function toggleEditorPref(key: keyof EditorPrefs) {
  const prefs = readEditorPrefs();
  writePreference(EDITOR_PREFS_COOKIE, JSON.stringify({ ...prefs, [key]: !prefs[key] }));
  for (const listener of listeners) listener();
}
