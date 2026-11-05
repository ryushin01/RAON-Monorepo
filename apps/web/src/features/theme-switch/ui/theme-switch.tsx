"use client";

import { useSyncExternalStore } from "react";
import { THEME_COOKIE } from "@/shared/config";
import { writePreference } from "@/shared/lib";
import { Button } from "@/shared/ui";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  writePreference(THEME_COOKIE, theme);
  for (const listener of listeners) listener();
}

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);
  return (
    <Button
      variant="ghost"
      small
      aria-pressed={theme === null ? undefined : theme === "dark"}
      onClick={() => setTheme(getTheme() === "dark" ? "light" : "dark")}
    >
      어두운 화면
    </Button>
  );
}
