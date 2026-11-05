import type { Metadata } from "next";
import { ButtonLink, Main } from "@/shared/ui";
import styles from "./errors.module.scss";

export const notFoundMetadata: Metadata = { title: "페이지를 찾을 수 없습니다" };

export function NotFoundPage() {
  return (
    <Main className={`page ${styles.main}`}>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소가 바뀌었거나 비공개로 전환된 내용일 수 있습니다.</p>
      <ButtonLink href="/works">작품 둘러보기</ButtonLink>
    </Main>
  );
}
