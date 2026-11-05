import { GENRE_LABEL, WORK_STATUS_LABEL } from "@raon/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getWorkAccess } from "@/entities/episode/index.server";
import { getCurrentUser, getSessionToken } from "@/entities/session/index.server";
import { WorkCover } from "@/entities/work";
import { getWork } from "@/entities/work/index.server";
import { EpisodePurchaseList } from "@/features/cart";
import { formatCompact, formatNumber } from "@/shared/lib";
import { Badge, ButtonLink } from "@/shared/ui";
import styles from "./work-detail.module.scss";

type Params = Promise<{ workId: string }>;

export async function workDetailMetadata({ params }: { params: Params }): Promise<Metadata> {
  const work = await getWork((await params).workId);
  return work ? { title: work.title, description: work.synopsis.slice(0, 120) } : { title: "작품을 찾을 수 없습니다" };
}

async function WorkDetailContent({ params }: { params: Params }) {
  const { workId } = await params;
  const [work, user, token] = await Promise.all([getWork(workId), getCurrentUser(), getSessionToken()]);
  if (!work) notFound();

  const access = user && token ? await getWorkAccess(workId, token) : null;
  const first = work.episodes[0];

  return (
    <>
      <div className={styles.head}>
        <WorkCover title={work.title} authorName={work.authorName} />
        <div>
          <div className={styles.badges}>
            <Badge solid={work.status === "COMPLETED"}>{WORK_STATUS_LABEL[work.status]}</Badge>
            <Badge>{GENRE_LABEL[work.genre]}</Badge>
          </div>
          <h1 className={styles.title}>{work.title}</h1>
          <p className={styles.meta}>
            {work.authorName} · 총 {formatNumber(work.episodeCount)}화 · 조회 {formatCompact(work.viewCount)}
          </p>
          <p className={styles.synopsis}>{work.synopsis}</p>
          {first && (
            <p className={styles.cta}>
              <ButtonLink href={`/works/${work.id}/episodes/${first.number}`}>첫 화 보기</ButtonLink>
            </p>
          )}
        </div>
      </div>
      <section aria-labelledby="episodes-heading">
        <h2 id="episodes-heading" className={styles.h2}>
          회차
        </h2>
        <EpisodePurchaseList work={work} access={access} role={user?.role ?? null} />
      </section>
    </>
  );
}

export function WorkDetailPage({ params }: { params: Params }) {
  return (
    <main id="main" className={`page ${styles.main}`}>
      <Suspense fallback={<div className={styles.skeleton} aria-busy="true" />}>
        <WorkDetailContent params={params} />
      </Suspense>
    </main>
  );
}
