import { type WorkFormat, workFormatSchema } from "@raon/contracts";

export const DEFAULT_MODE: WorkFormat = "NOVEL";

export const MODE_HOME: Record<WorkFormat, string> = { COMIC: "/webtoon", NOVEL: "/novel" };

/** 쿠키는 사용자가 고칠 수 있으므로 알고 있는 값만 받는다. */
export const parseMode = (value: string | null | undefined): WorkFormat =>
  workFormatSchema.safeParse(value).data ?? DEFAULT_MODE;

/** 주소에 모드가 드러나면 그 값을 따르고, 아니면 마지막으로 고른 모드를 쓴다. */
export function currentMode(pathname: string, format: string | null, saved: string | null | undefined): WorkFormat {
  if (pathname === MODE_HOME.COMIC) return "COMIC";
  if (pathname === MODE_HOME.NOVEL) return "NOVEL";
  const fromQuery = workFormatSchema.safeParse(format).data;
  return (pathname === "/works" ? fromQuery : undefined) ?? parseMode(saved);
}

export const modeWorksHref = (mode: WorkFormat, query = "") => `/works?format=${mode}${query && `&${query}`}`;
