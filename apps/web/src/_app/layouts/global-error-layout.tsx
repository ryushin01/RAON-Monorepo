"use client";

import "../styles/global.scss";

import { ErrorPage } from "@/_pages/errors";

/** 루트 레이아웃까지 실패했을 때의 화면. 레이아웃을 대신하므로 html·body를 직접 그린다. */
export function GlobalErrorLayout({ retry }: { retry: () => void }) {
  return (
    <html lang="ko">
      <body>
        <title>문제가 생겼습니다 | RAON 라온</title>
        <ErrorPage reset={retry} />
      </body>
    </html>
  );
}
