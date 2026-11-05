/** 올린 표지의 주소. 바꾸면 주소도 바뀌어 브라우저 캐시를 쓰지 않는다. 없으면 제목으로 만든 표지를 쓴다. */
export function coverSrc(work: { id: string; coverUpdatedAt: string | null }): string | undefined {
  if (!work.coverUpdatedAt) return undefined;
  return `/api/covers/${work.id}?v=${encodeURIComponent(work.coverUpdatedAt)}`;
}
