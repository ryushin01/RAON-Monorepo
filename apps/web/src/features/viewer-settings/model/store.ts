import { VIEWER_STORAGE_KEY } from "@/shared/config";

export interface ViewerSettings {
  theme: "auto" | "white" | "gray" | "black";
  font: "serif" | "sans";
  size: number;
  leading: number;
}

export const DEFAULT_SETTINGS: ViewerSettings = { theme: "auto", font: "serif", size: 18, leading: 1.9 };
export const MIN_SIZE = 14;
export const MAX_SIZE = 28;
export const MIN_LEADING = 1.5;
export const MAX_LEADING = 2.4;

const listeners = new Set<() => void>();
let current: ViewerSettings | null = null;

function read(): ViewerSettings {
  try {
    const raw = localStorage.getItem(VIEWER_STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ViewerSettings>) };
  } catch {
    // 저장소를 쓸 수 없거나 값이 깨졌으면 기본값을 쓴다.
  }
  return DEFAULT_SETTINGS;
}

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
    const next = { ...viewerSettings.get(), ...patch };
    next.size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, next.size));
    next.leading = Math.round(Math.min(MAX_LEADING, Math.max(MIN_LEADING, next.leading)) * 10) / 10;
    current = next;
    apply(next);
    try {
      localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장하지 못해도 이번 화면에는 적용된다.
    }
    for (const listener of listeners) listener();
  },
};
