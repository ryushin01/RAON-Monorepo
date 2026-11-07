import { GENRE_LABEL, WORK_STATUS_LABEL } from "@raon/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/entities/session/index.server";
import { getStudioWorks, getTrashedWorks } from "@/entities/studio/index.server";
import { PurgeWorkButton, RestoreWorkButton, WorkForm } from "@/features/work-form";
import { formatCompact, formatDate } from "@/shared/lib";
import { ButtonLink, Main } from "@/shared/ui";
import styles from "./studio.module.scss";

export const studioHomeMetadata: Metadata = { title: "작가 스튜디오" };
export const studioNewWorkMetadata: Metadata = { title: "새 작품 만들기" };

async function StudioWorks() {
  const { token } = await requireUser("AUTHOR", "/studio");
  const [works, trash] = await Promise.all([getStudioWorks(token), getTrashedWorks(token)]);

  return (
    <>
      {works.length === 0 ? (
        <div className={styles.empty}>
          <p>아직 만든 작품이 없습니다. 첫 작품을 만들어 보세요.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {works.map((work) => (
            <li key={work.id} className={styles.item}>
              <Link href={`/studio/works/${work.id}`}>{work.title}</Link>
              <p>
                {GENRE_LABEL[work.genre]} · {WORK_STATUS_LABEL[work.status]} · 공개 {work.publishedEpisodeCount}화 ·
                초안 {work.draftEpisodeCount}화 · 조회 {formatCompact(work.viewCount)} · 판매 {work.salesCount}건 ·
                선호작 {work.favoriteCount}명 · 수정 {formatDate(work.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <section aria-label="작품 휴지통" className={styles.trash}>
        <h2 tabIndex={-1} className={styles.trashTitle}>
          작품 휴지통
        </h2>
        {trash.length === 0 ? (
          <p className={styles.trashNote}>휴지통이 비어 있습니다.</p>
        ) : (
          <>
            <p className={styles.trashNote}>
              독자에게 보이지 않습니다. 복원하면 공개 상태와 회차가 그대로 돌아옵니다. 직접 지우기 전에는 사라지지
              않습니다.
            </p>
            <ul className={styles.list}>
              {trash.map((work) => (
                <li key={work.id} className={styles.item}>
                  <span className={styles.trashName}>{work.title}</span>
                  <p>
                    회차 {work.episodeCount}개 · 옮긴 날 {formatDate(work.deletedAt)}
                  </p>
                  <div className={styles.trashActions}>
                    <RestoreWorkButton workId={work.id} title={work.title} />
                    <PurgeWorkButton workId={work.id} title={work.title} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
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
