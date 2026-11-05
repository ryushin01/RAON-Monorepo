"use client";

import { Button, ButtonLink, Main } from "@/shared/ui";
import styles from "./errors.module.scss";

export function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Main className={`page ${styles.main}`}>
      <h1>잠시 문제가 생겼습니다</h1>
      <p role="alert">내용을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>
      <Button onClick={reset}>다시 시도</Button>
      <ButtonLink variant="ghost" href="/">
        첫 화면으로
      </ButtonLink>
    </Main>
  );
}
