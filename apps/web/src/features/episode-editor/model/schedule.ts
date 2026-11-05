/** 공개 시각이 아직 오지 않은 회차인지 본다. */
export function isScheduled(publishedAt: string | null, now = Date.now()): boolean {
  return publishedAt !== null && Date.parse(publishedAt) > now;
}

/** datetime-local 입력값(브라우저 시간대)을 서버에 보낼 ISO 시각으로 바꾼다. 비었거나 잘못되면 null이다. */
export function toPublishAt(localValue: string): string | null {
  const time = Date.parse(localValue);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}
