/** 공개 시각이 아직 오지 않은 회차인지 본다. */
export function isScheduled(publishedAt: string | null, now = Date.now()): boolean {
  return publishedAt !== null && Date.parse(publishedAt) > now;
}

/** datetime-local 입력값을 한국 시간으로 읽어 ISO 시각으로 바꾼다. 화면의 날짜 표시도 한국 시간이다. 잘못되면 null이다. */
export function toPublishAt(localValue: string): string | null {
  const time = Date.parse(`${localValue}+09:00`);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}
