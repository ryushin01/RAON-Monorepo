import { REPLACE_RULES_KEY } from "@/shared/config";

export interface ReplaceRule {
  from: string;
  to: string;
}

export const MAX_REPLACE_RULES = 50;
export const MAX_RULE_LENGTH = 20;

const NO_RULES: ReplaceRule[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached = NO_RULES;

export function subscribeReplaceRules(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isRule = (item: unknown): item is ReplaceRule => {
  const rule = item as Partial<ReplaceRule> | null;
  return typeof rule?.from === "string" && rule.from.length > 0 && typeof rule.to === "string";
};

/** 값이 그대로면 같은 배열을 돌려준다. useSyncExternalStore가 변경으로 착각하지 않게 하기 위해서다. */
export function readReplaceRules(): ReplaceRule[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(REPLACE_RULES_KEY);
  } catch {
    return NO_RULES;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    // 저장소는 사용자가 고칠 수 있으므로 모양이 맞는 규칙만 받는다.
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed) ? parsed.filter(isRule) : NO_RULES;
  } catch {
    cached = NO_RULES;
  }
  return cached;
}

/** 저장 공간이 가득 차거나 저장소가 막혀 있으면 false를 돌려준다. */
export function writeReplaceRules(rules: ReplaceRule[]): boolean {
  try {
    window.localStorage.setItem(REPLACE_RULES_KEY, JSON.stringify(rules));
  } catch {
    return false;
  }
  for (const listener of listeners) listener();
  return true;
}

/** 방금 쓴 글자로 끝나는 규칙 중 가장 긴 것을 고른다. ‘---’가 ‘--’보다 먼저 걸리게 하기 위해서다. */
export function matchReplaceRule(rules: ReplaceRule[], typed: string): ReplaceRule | null {
  let best: ReplaceRule | null = null;
  for (const rule of rules) {
    if (typed.endsWith(rule.from) && (!best || rule.from.length > best.from.length)) best = rule;
  }
  return best;
}
