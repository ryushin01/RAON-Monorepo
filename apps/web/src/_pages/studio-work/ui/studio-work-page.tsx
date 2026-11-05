import { WORK_STATUS_LABEL } from "@raon/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/entities/session/index.server";
import { getStudioWork } from "@/entities/studio/index.server";
import { WorkForm, WorkStatusControl } from "@/features/work-form";
import { formatDate, formatNumber } from "@/shared/lib";
import { Badge, ButtonLink } from "@/shared/ui";
import styles from "./studio-work.module.scss";

export const studioWorkMetadata: Metadata = { title: "작품 관리" };

type Params = Promise<{ workId: string }>;

async function StudioWorkContent({ params }: { params: Params }) {
  const { workId } = await params;
  const { token } = await requireUser("AUTHOR", `/studio/works/${workId}`);
  const work = await getStudioWork(workId, token);
  if (!work) notFound();

  return (
    <>
      <div>
        <p className={styles.crumb}>
          <Link href="/studio">작가 스튜디오</Link>
        </p>
        <h1 className={styles.title}>{work.title}</h1>
        <p className={styles.meta}>{WORK_STATUS_LABEL[work.status]}</p>
        <WorkStatusControl workId={work.id} status={work.status} />
      </div>

      <section aria-labelledby="episodes-heading">
        <div className={styles.head}>
          <h2 id="episodes-heading">회차</h2>
          <ButtonLink href={`/studio/works/${work.id}/episodes/new`}>새 회차 쓰기</ButtonLink>
        </div>
        {work.episodes.length === 0 ? (
          <p>아직 쓴 회차가 없습니다.</p>
        ) : (
          <ol className={styles.list}>
            {work.episodes.map((episode) => (
              <li key={episode.id}>
                <div>
                  <Link href={`/studio/works/${work.id}/episodes/${episode.id}`}>
                    {episode.number}화. {episode.title}
                  </Link>
                  <small>
                    {formatNumber(episode.charCount)}자 · 수정 {formatDate(episode.updatedAt)}
                  </small>
                </div>
                <span className={styles.badges}>
                  <Badge solid={episode.status === "PUBLISHED"}>
                    {episode.status === "PUBLISHED" ? "공개" : "초안"}
                  </Badge>
                  <Badge>{episode.isFree ? "무료" : "유료"}</Badge>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="info-heading">
        <h2 id="info-heading" className={styles.h2}>
          작품 정보
        </h2>
        <WorkForm work={work} />
      </section>
    </>
  );
}

export function StudioWorkPage({ params }: { params: Params }) {
  return (
    <main id="main" className={`page ${styles.main}`}>
      <Suspense fallback={<p aria-busy="true">작품을 불러오는 중입니다.</p>}>
        <StudioWorkContent params={params} />
      </Suspense>
    </main>
  );
}
