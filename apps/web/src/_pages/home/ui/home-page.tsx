import { GENRE_LABEL } from "@raon/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { WorkCard } from "@/entities/work";
import { getWorks } from "@/entities/work/index.server";
import { formatCompact, formatDate } from "@/shared/lib";
import { Main } from "@/shared/ui";
import { type BannerSlide, WorkBanner } from "@/widgets/work-banner";
import styles from "./home.module.scss";

export const homeMetadata: Metadata = { title: { absolute: "RAON 라온 | 웹소설 연재·감상 플랫폼" } };

function Section({ title, more, children }: { title: string; more: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        <Link href={more} aria-label={`더 보기: ${title}`}>
          더 보기
        </Link>
      </div>
      {children}
    </section>
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

  // 같은 작품이 겹치지 않게 각 목록에서 아직 쓰지 않은 첫 작품을 고른다.
  const slides: BannerSlide[] = [{ label: "인기 1위", work: first }];
  for (const [label, list] of [
    ["새로 올라온 회차", latest.items],
    ["완결 추천", completed.items],
  ] as const) {
    const work = list.find((item) => !slides.some((slide) => slide.work.id === item.id));
    if (work) slides.push({ label, work });
  }

  return (
    <>
      <div className={styles.top}>
        <WorkBanner slides={slides} />
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
              <Link href={`/works/${work.id}`} className={styles.latestLink}>
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
    <Main className={`page ${styles.main}`}>
      <h1 className="visually-hidden">라온 웹소설</h1>
      <Suspense fallback={<div className={styles.skeleton} aria-busy="true" />}>
        <HomeContent />
      </Suspense>
    </Main>
  );
}
