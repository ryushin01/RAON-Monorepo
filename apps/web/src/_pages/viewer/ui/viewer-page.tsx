import { type CommentSort, EPISODE_TYPE_LABEL, type EpisodeView, type Role } from "@raon/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComicContent, EpisodeContent } from "@/entities/episode";
import { getComments, getEpisode } from "@/entities/episode/index.server";
import { getCurrentUser, getSessionToken } from "@/entities/session/index.server";
import { getWork } from "@/entities/work/index.server";
import { AddEpisodeButton } from "@/features/cart";
import { ComicAutoScroll } from "@/features/comic-autoscroll";
import { EpisodeComments } from "@/features/episode-comments";
import { ViewTracker } from "@/features/episode-view";
import { ViewerSettingsToggle } from "@/features/viewer-settings";
import { formatCoins, formatDate } from "@/shared/lib";
import { ButtonLink, Main, Notice } from "@/shared/ui";
import styles from "./viewer.module.scss";

type Params = Promise<{ workId: string; number: string }>;

const parseNumber = (value: string) => (/^\d{1,6}$/.test(value) ? Number(value) : null);

export async function viewerMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workId, number } = await params;
  const work = await getWork(workId);
  const episode = work?.episodes.find((item) => item.number === parseNumber(number));
  return {
    title: work && episode ? `${episode.number}화. ${episode.title} - ${work.title}` : "회차를 찾을 수 없습니다",
  };
}

function LockedPanel({ episode, role, path }: { episode: EpisodeView; role: Role | null; path: string }) {
  return (
    <div className={styles.locked}>
      <strong>유료 회차입니다 · {formatCoins(episode.price)}</strong>
      {role === "READER" && <AddEpisodeButton workId={episode.workId} episodeId={episode.id} />}
      {role === "AUTHOR" && <p>구매는 일반 회원 계정으로 이용할 수 있습니다.</p>}
      {role === null && (
        <>
          <p>로그인하면 구매하고 이어서 읽을 수 있습니다.</p>
          <ButtonLink href={`/login?next=${encodeURIComponent(path)}`}>로그인하기</ButtonLink>
        </>
      )}
      <ButtonLink variant="ghost" href={`/works/${episode.workId}`}>
        회차 목록으로
      </ButtonLink>
    </div>
  );
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ViewerContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ workId, number }, query] = await Promise.all([params, searchParams]);
  const commentSort: CommentSort = query.commentSort === "likes" ? "likes" : "latest";
  const parsed = parseNumber(number);
  if (parsed === null) notFound();

  const [token, user] = await Promise.all([getSessionToken(), getCurrentUser()]);
  const episode = await getEpisode(workId, parsed, token);
  if (!episode) notFound();

  const base = `/works/${workId}/episodes`;
  const path = `${base}/${parsed}`;
  // 유료 회차는 산 사람만 댓글을 볼 수 있으므로 읽을 수 있을 때만 부른다.
  const comments = episode.accessible ? await getComments(episode.id, token, commentSort) : null;
  return (
    <>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link href={`/works/${workId}`} className={styles.back} aria-label={`${episode.workTitle} 회차 목록으로`}>
            ← {episode.workTitle}
          </Link>
          {/* 글꼴과 줄 간격은 글자 본문에만 쓴다. */}
          {episode.format === "NOVEL" && (
            <ViewerSettingsToggle buttonClassName={styles.settingsButton} panelClassName={styles.settingsPanel} />
          )}
        </div>
      </header>

      <Main>
        <article className={styles.body}>
          <header className={styles.head}>
            <p>
              {episode.episodeType !== "REGULAR" && `${EPISODE_TYPE_LABEL[episode.episodeType]} · `}
              {episode.authorName} · {formatDate(episode.publishedAt)}
            </p>
            <h1>
              {episode.number}화. {episode.title}
            </h1>
          </header>
          {episode.accessible && episode.images ? (
            <ComicContent episodeId={episode.id} images={episode.images} />
          ) : episode.accessible && episode.content ? (
            <div className={styles.text}>
              <EpisodeContent doc={episode.content} />
            </div>
          ) : (
            <LockedPanel episode={episode} role={user?.role ?? null} path={path} />
          )}
          {episode.authorNote && (
            <aside className={styles.note} aria-label="작가의 말">
              <h2>작가의 말</h2>
              <p>{episode.authorNote}</p>
            </aside>
          )}
          {episode.accessible && (
            <>
              <ViewTracker workId={workId} episodeId={episode.id} number={parsed} />
              {comments ? (
                <EpisodeComments
                  episodeId={episode.id}
                  path={path}
                  comments={comments.items}
                  total={comments.total}
                  loggedIn={Boolean(user)}
                  sort={commentSort}
                />
              ) : (
                <Notice>댓글을 불러오지 못했습니다. 잠시 뒤 다시 확인해 주세요.</Notice>
              )}
            </>
          )}
        </article>
      </Main>

      {episode.format === "COMIC" ? (
        // 긴 세로 화면에서도 바로 옮길 수 있게 아래에 붙여 둔다. 숨기지 않아 키보드로도 언제나 닿는다.
        <nav className={styles.comicBar} aria-label="회차 이동">
          {episode.prev ? (
            <Link
              href={`${base}/${episode.prev.number}`}
              aria-label={`이전 화: ${episode.prev.number}화. ${episode.prev.title}`}
            >
              이전 화
            </Link>
          ) : (
            <span>첫 회차</span>
          )}
          <Link href={`/works/${workId}`}>회차 목록</Link>
          {episode.next ? (
            <Link
              href={`${base}/${episode.next.number}`}
              aria-label={`다음 화: ${episode.next.number}화. ${episode.next.title}`}
            >
              다음 화
            </Link>
          ) : (
            <span>마지막 회차</span>
          )}
          {episode.accessible && <ComicAutoScroll />}
        </nav>
      ) : (
        <nav className={styles.footer} aria-label="회차 이동">
          {episode.prev ? (
            <Link href={`${base}/${episode.prev.number}`}>
              <small>이전 화</small>
              {episode.prev.number}화. {episode.prev.title}
            </Link>
          ) : (
            <span>첫 회차입니다</span>
          )}
          {episode.next ? (
            <Link href={`${base}/${episode.next.number}`} className={styles.next}>
              <small>다음 화</small>
              {episode.next.number}화. {episode.next.title}
            </Link>
          ) : (
            <span className={styles.next}>마지막 회차입니다</span>
          )}
          <Link href={`/works/${workId}`} className={styles.toList}>
            회차 목록
          </Link>
        </nav>
      )}
    </>
  );
}

export function ViewerPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <div className={styles.viewer}>
      <Suspense fallback={<div aria-busy="true" />}>
        <ViewerContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
