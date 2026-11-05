"use client";

import { useTransition } from "react";
import { EPISODE_BACKUP_PREFIX, LOGOUT_SIGNAL_KEY } from "@/shared/config";
import { Button } from "@/shared/ui";
import { logout } from "../api/actions";

function writeLogoutSignal(): boolean {
  try {
    localStorage.setItem(LOGOUT_SIGNAL_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

function clearLocalDrafts() {
  // 다른 탭의 에디터가 백업을 다시 쓰지 않도록 먼저 알린다. 저장 공간이 가득 차 실패해도 원고는 지워야 한다.
  const signaled = writeLogoutSignal();
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(EPISODE_BACKUP_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다.
  }
  if (!signaled) writeLogoutSignal();
}

/** 숨겨진 화면에 남은 내 서재와 장바구니를 지우려고 전체 새로고침으로 나간다. */
export function LogoutButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      small
      disabled={pending}
      onClick={() =>
        start(async () => {
          await logout();
          clearLocalDrafts();
          window.location.assign("/");
        })
      }
    >
      로그아웃
    </Button>
  );
}
