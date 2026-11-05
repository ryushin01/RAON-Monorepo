import { GENRE_LABEL, WORK_STATUS_LABEL } from "@raon/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/entities/session/index.server";
import { getStudioWorks } from "@/entities/studio/index.server";
import { WorkForm } from "@/features/work-form";
import { formatCompact, formatDate } from "@/shared/lib";
import { ButtonLink, Main } from "@/shared/ui";
import styles from "./studio.module.scss";

export const studioHomeMetadata: Metadata = { title: "작가 스튜디오" };
export const studioNewWorkMetadata: Metadata = { title: "새 작품 만들기" };

async function StudioWorks() {
  const { token } = await requireUser("AUTHOR", "/studio");
  const works = await getStudioWorks(token);

  if (works.length === 0) {
    return (
      <div className={styles.empty}>
        <p>아직 만든 작품이 없습니다. 첫 작품을 만들어 보세요.</p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {works.map((work) => (
        <li key={work.id} className={styles.item}>
          <Link href={`/studio/works/${work.id}`}>{work.title}</Link>
          <p>
            {GENRE_LABEL[work.genre]} · {WORK_STATUS_LABEL[work.status]} · 공개 {work.publishedEpisodeCount}화 · 초안{" "}
            {work.draftEpisodeCount}화 · 조회 {formatCompact(work.viewCount)} · 판매 {work.salesCount}건 · 선호작{" "}
            {work.favoriteCount}명 · 수정 {formatDate(work.updatedAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function StudioHomePage() {
  return (
    <Main className={`page ${styles.main}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>작가 스튜디오</h1>
        <ButtonLink href="/studio/works/new">새 작품 만들기</ButtonLink>
      </div>
      <Suspense fallback={<p aria-busy="true">작품을 불러오는 중입니다.</p>}>
        <StudioWorks />
      </Suspense>
    </Main>
  );
}

/** 화면 진입 조건만 확인한다. 폼은 정적 셸에 두어 인증 확인을 기다리지 않고 바로 보여 준다. */
async function AuthorGate() {
  await requireUser("AUTHOR", "/studio/works/new");
  return null;
}

export function StudioNewWorkPage() {
  return (
    <Main className={`page ${styles.main}`}>
      <h1 className={styles.title}>새 작품 만들기</h1>
      <Suspense fallback={null}>
        <AuthorGate />
      </Suspense>
      <WorkForm />
    </Main>
  );
}
