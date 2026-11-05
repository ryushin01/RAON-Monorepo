"use client";

import { useTransition } from "react";
import { Button } from "@/shared/ui";
import { logout } from "../api/actions";

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
          window.location.assign("/");
        })
      }
    >
      로그아웃
    </Button>
  );
}
