import { GENRE_LABEL, WORK_STATUS_LABEL, type WorkSummary } from "@raon/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { WorkCard, WorkCover } from "@/entities/work";
import { getWorks } from "@/entities/work/index.server";
import { formatCompact, formatDate } from "@/shared/lib";
import { ButtonLink } from "@/shared/ui";
import styles from "./home.module.scss";

export const homeMetadata: Metadata = { title: { absolute: "RAON 라온 | 웹소설 연재·감상 플랫폼" } };

function Section({ title, more, children }: { title: string; more: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        <Link href={more} aria-label={`${title} 더 보기`}>
          더 보기
        </Link>
      </div>
      {children}
    </section>
  );
}

function Feature({ work }: { work: WorkSummary }) {
  return (
    <article className={styles.feature}>
      <WorkCover title={work.title} authorName={work.authorName} />
      <div>
        <p className={styles.kicker}>인기 1위</p>
        <h2 className={styles.featureTitle}>
          <Link href={`/works/${work.id}`}>{work.title}</Link>
        </h2>
        <p className={styles.meta}>
          {work.authorName} · {GENRE_LABEL[work.genre]} · {WORK_STATUS_LABEL[work.status]} · {work.episodeCount}화
        </p>
        <p>{work.synopsis}</p>
        <p style={{ marginTop: "1rem" }}>
          <ButtonLink href={`/works/${work.id}/episodes/1`} aria-label={`${work.title} 첫 화 보기`}>
            첫 화 보기
          </ButtonLink>
        </p>
      </div>
    </article>
  );
}

async function HomeContent() {
  // 빌드할 때 API가 없어도 되도록 요청 시점에 읽는다. 결과는 캐시를 함께 쓴다.
  await connection();
  const [popular, latest, completed] = await Promise.all([
    getWorks({ sort: "popular", pageSize: 7 }),
    getWorks({ sort: "latest", pageSize: 6 }),
    getWorks({ status: "COMPLETED", sort: "popular", pageSize: 6 }),
  ]);
  const [first, ...rest] = popular.items;

  if (!first) return <p>아직 공개한 작품이 없습니다.</p>;

  return (
    <>
      <div className={styles.top}>
        <Feature work={first} />
        <Section title="인기 작품" more="/works?sort=popular">
          <ol className={styles.rank}>
            {rest.map((work, index) => (
              <li key={work.id}>
                <Link href={`/works/${work.id}`}>
                  <span className={styles.number}>{index + 2}</span>
                  <strong>{work.title}</strong>
                  <small>
                    {work.authorName} · {formatCompact(work.viewCount)}
                  </small>
                </Link>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <Section title="새로 올라온 회차" more="/works?sort=latest">
        <ol className={styles.rank}>
          {latest.items.map((work) => (
            <li key={work.id}>
              <Link href={`/works/${work.id}`} style={{ gridTemplateColumns: "1fr auto" }}>
                <strong>
                  [{GENRE_LABEL[work.genre]}] {work.title}
                </strong>
                <small>
                  {work.episodeCount}화 · {work.latestEpisodeAt ? formatDate(work.latestEpisodeAt) : ""}
                </small>
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="완결 작품" more="/works?status=COMPLETED">
        <ul className={styles.grid}>
          {completed.items.map((work) => (
            <li key={work.id}>
              <WorkCard work={work} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

export function HomePage() {
  return (
    <main id="main" className={`page ${styles.main}`}>
      <h1 className="visually-hidden">라온 웹소설</h1>
      <Suspense fallback={<div className={styles.skeleton} aria-busy="true" />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
