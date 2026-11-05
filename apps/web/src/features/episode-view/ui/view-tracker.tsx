"use client";

import { useEffect } from "react";
import { recordView } from "../api/actions";

const KEY_PREFIX = "raon:viewed:";

function firstVisit(episodeId: string): boolean {
  try {
    const key = `${KEY_PREFIX}${episodeId}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

/**
 * 조회수를 탭 하나에 회차당 한 번만 올린다. 서버 렌더링마다 세면 새로고침이나 댓글 등록만으로 조회수가 늘어난다.
 */
export function ViewTracker({ workId, episodeId, number }: { workId: string; episodeId: string; number: number }) {
  useEffect(() => {
    if (firstVisit(episodeId)) void recordView(workId, number);
  }, [workId, episodeId, number]);
  return null;
}
