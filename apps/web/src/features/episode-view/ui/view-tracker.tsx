"use client";

import { useEffect } from "react";
import { recordView } from "../api/actions";

const KEY_PREFIX = "raon:viewed:";
const inFlight = new Set<string>();

function alreadyViewed(episodeId: string): boolean {
  try {
    return sessionStorage.getItem(`${KEY_PREFIX}${episodeId}`) !== null;
  } catch {
    return false;
  }
}

function markViewed(episodeId: string) {
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${episodeId}`, "1");
  } catch {
    // 저장하지 못하면 다음 방문에 한 번 더 세어질 뿐이다.
  }
}

/**
 * 조회수를 탭 하나에 회차당 한 번만 올린다. 서버 렌더링마다 세면 새로고침이나 댓글 등록만으로 조회수가 늘어난다.
 * 기록에 실패하면 표시하지 않아 다음 방문 때 다시 보낸다.
 */
export function ViewTracker({ workId, episodeId, number }: { workId: string; episodeId: string; number: number }) {
  useEffect(() => {
    if (alreadyViewed(episodeId) || inFlight.has(episodeId)) return;
    inFlight.add(episodeId);
    void recordView(workId, number)
      .then((ok) => {
        if (ok) markViewed(episodeId);
      })
      // 서버 액션 호출 자체가 실패해도 읽는 데 지장이 없다. 표시하지 않았으니 다음 방문에 다시 보낸다.
      .catch(() => {})
      .finally(() => inFlight.delete(episodeId));
  }, [workId, episodeId, number]);
  return null;
}
