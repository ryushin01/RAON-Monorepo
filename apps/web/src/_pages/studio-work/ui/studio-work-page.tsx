import { WORK_STATUS_LABEL } from "@raon/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/entities/session/index.server";
import { getStudioWork } from "@/entities/studio/index.server";
import { DeleteDraftButton, isScheduled, MoveEpisodeButtons, NewEpisodeButton } from "@/features/episode-editor";
import { CoverUpload, DeleteWorkButton, WorkForm, WorkStatusControl } from "@/features/work-form";
import { formatCoins, formatDate, formatDateTime, formatNumber } from "@/shared/lib";
import { Badge, Main } from "@/shared/ui";
import styles from "./studio-work.module.scss";

export const studioWorkMetadata: Metadata = { title: "작품 관리" };

type Params = Promise<{ workId: string }>;

function episodeLabel({ status, publishedAt }: { status: string; publishedAt: string | null }) {
  if (status !== "PUBLISHED") return "초안";
  return publishedAt && isScheduled(publishedAt) ? `예약 ${formatDateTime(publishedAt)}` : "공개";
}

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
        <p className={styles.meta}>
          {WORK_STATUS_LABEL[work.status]} · 판매 {formatNumber(work.salesCount)}건({formatCoins(work.salesCoins)}) ·
          선호작 {formatNumber(work.favoriteCount)}명
        </p>
        <WorkStatusControl workId={work.id} status={work.status} />
      </div>

      <section aria-label="회차">
        <div className={styles.head}>
          <h2>회차</h2>
          <NewEpisodeButton workId={work.id} />
        </div>
        {work.episodes.length === 0 ? (
          <p>아직 쓴 회차가 없습니다.</p>
        ) : (
          <ol className={styles.list}>
            {work.episodes.map((episode, index) => (
              <li key={episode.id}>
                <div>
                  <Link href={`/studio/works/${work.id}/episodes/${episode.id}`}>
                    {episode.number}화. {episode.title}
                  </Link>
                  <small>
                    {formatNumber(episode.charCount)}자 · 수정 {formatDate(episode.updatedAt)}
                  </small>
                </div>
                <div className={styles.badges}>
                  <Badge solid={episode.status === "PUBLISHED"}>{episodeLabel(episode)}</Badge>
                  <Badge>{episode.isFree ? "무료" : "유료"}</Badge>
                  <MoveEpisodeButtons
                    workId={work.id}
                    episodeId={episode.id}
                    label={`${episode.number}화`}
                    canMoveUp={index > 0}
                    canMoveDown={index < work.episodes.length - 1}
                  />
                  {episode.status === "DRAFT" && (
                    <DeleteDraftButton workId={work.id} episodeId={episode.id} label={`${episode.number}화`} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="작품 정보">
        <h2 className={styles.h2}>작품 정보</h2>
        <CoverUpload work={work} />
        <WorkForm work={work} />
        <div className={styles.danger}>
          <DeleteWorkButton workId={work.id} title={work.title} />
        </div>
      </section>
    </>
  );
}

export function StudioWorkPage({ params }: { params: Params }) {
  return (
    <Main className={`page ${styles.main}`}>
      <Suspense fallback={<p aria-busy="true">작품을 불러오는 중입니다.</p>}>
        <StudioWorkContent params={params} />
      </Suspense>
    </Main>
  );
}
