import { z } from "zod";

import { VIEWER_COOKIE, VIEWER_FONTS, VIEWER_LIMITS, VIEWER_THEMES } from "@/shared/config";
import { readPreference, writePreference } from "@/shared/lib";

export interface ViewerSettings {
  theme: (typeof VIEWER_THEMES)[number];
  font: (typeof VIEWER_FONTS)[number];
  size: number;
  leading: number;
}

export const DEFAULT_SETTINGS: ViewerSettings = { theme: "auto", font: "serif", size: 18, leading: 1.9 };
export const MIN_SIZE = VIEWER_LIMITS.size.min;
export const MAX_SIZE = VIEWER_LIMITS.size.max;
export const MIN_LEADING = VIEWER_LIMITS.leading.min;
export const MAX_LEADING = VIEWER_LIMITS.leading.max;

/** 쿠키는 사용자가 고칠 수 있으므로 칸마다 따로 확인하고, 틀린 칸만 기본값으로 돌린다. */
const SavedSettings = z.object({
  theme: z.enum(VIEWER_THEMES).catch(DEFAULT_SETTINGS.theme),
  font: z.enum(VIEWER_FONTS).catch(DEFAULT_SETTINGS.font),
  size: z.number().catch(DEFAULT_SETTINGS.size),
  leading: z.number().catch(DEFAULT_SETTINGS.leading),
});

/** 크기와 줄 간격을 범위 안으로 맞춘다. */
export function clampSettings(settings: ViewerSettings): ViewerSettings {
  return {
    ...settings,
    size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, settings.size)),
    leading: Math.round(Math.min(MAX_LEADING, Math.max(MIN_LEADING, settings.leading)) * 10) / 10,
  };
}

/** 저장된 쿠키 값을 설정으로 읽는다. 깨졌거나 모르는 값은 기본값으로 돌린다. */
export function parseViewerSettings(raw: string | null | undefined): ViewerSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return clampSettings(SavedSettings.parse(JSON.parse(raw)));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const listeners = new Set<() => void>();
let current: ViewerSettings | null = null;

const read = (): ViewerSettings => parseViewerSettings(readPreference(VIEWER_COOKIE));

function apply(settings: ViewerSettings) {
  const root = document.documentElement;
  root.dataset.viewerTheme = settings.theme;
  root.dataset.viewerFont = settings.font;
  root.style.setProperty("--viewer-size", `${settings.size}px`);
  root.style.setProperty("--viewer-leading", String(settings.leading));
}

export const viewerSettings = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(): ViewerSettings {
    current ??= read();
    return current;
  },
  getServer: () => DEFAULT_SETTINGS,
  update(patch: Partial<ViewerSettings>) {
    const next = clampSettings({ ...viewerSettings.get(), ...patch });
    current = next;
    apply(next);
    writePreference(VIEWER_COOKIE, JSON.stringify(next));
    for (const listener of listeners) listener();
  },
};
