const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

export const formatDate = (value: string) => dateFormatter.format(new Date(value));

export const formatNumber = (value: number) => value.toLocaleString("ko-KR");

export const formatCoins = (value: number) => `${formatNumber(value)}코인`;

/** 조회수처럼 큰 수를 줄여 보여 준다. 예: 48,210 → 4.8만 */
export function formatCompact(value: number): string {
  if (value < 10000) return formatNumber(value);
  return `${(value / 10000).toFixed(1).replace(/\.0$/, "")}만`;
}

/** 로그인 뒤 돌아갈 주소. 다른 사이트로 나가는 주소는 받지 않는다. */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
