import { GENRE_LABEL, WORK_FORMAT_LABEL, type WorkFormat } from "@raon/contracts";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { coverSrc, WorkCard, WorkCover } from "@/entities/work";
import { getWorks } from "@/entities/work/index.server";
import { parseMode } from "@/features/mode-switch";
import { MODE_COOKIE } from "@/shared/config";
import { formatCompact, formatDate } from "@/shared/lib";
import { ButtonLink, Main } from "@/shared/ui";
import { HomeHero } from "@/widgets/home-hero";
import { type BannerSlide, WorkBanner } from "@/widgets/work-banner";
import styles from "./home.module.scss";

export const homeMetadata: Metadata = { title: { absolute: "RAON 라온 | 웹툰·웹소설 연재 플랫폼" } };
export const webtoonHomeMetadata: Metadata = { title: "웹툰" };
export const novelHomeMetadata: Metadata = { title: "웹소설" };

function SectionHeading({
  label,
  title,
  more,
  center,
}: {
  label: string;
  title: string;
  more?: string;
  center?: boolean;
}) {
  return (
    <div className={`${styles.heading} ${center ? styles.center : ""}`}>
      <div>
        <p className={styles.label}>({label})</p>
        <h2>{title}</h2>
      </div>
      {more && (
        <ButtonLink href={more} aria-label={`더 보기: ${title}`} variant={center ? "secondary" : undefined} arrow>
          더 보기
        </ButtonLink>
      )}
    </div>
  );
}

/** 형식이 없으면 첫 화면이므로 마지막으로 고른 모드로 연다. */
async function resolveFormat(fixed?: WorkFormat) {
  return fixed ?? parseMode((await cookies()).get(MODE_COOKIE)?.value);
}

/** 첫 화면 아래쪽에 부채처럼 펼친 인기 작품 표지. 바로 그 작품으로 간다. */
async function HeroCovers({ format: fixed }: { format?: WorkFormat }) {
  await connection();
  const { items } = await getWorks({ format: await resolveFormat(fixed), sort: "popular", pageSize: 7 });
  if (items.length === 0) return null;
  return (
    <ol className={styles.fan} aria-label="인기 작품 표지">
      {items.slice(0, 5).map((work) => (
        <li key={work.id}>
          <Link href={`/works/${work.id}`} aria-label={work.title}>
            <WorkCover title={work.title} authorName={work.authorName} imageUrl={coverSrc(work)} />
          </Link>
        </li>
      ))}
    </ol>
  );
}

async function HomeContent({ format: fixed }: { format?: WorkFormat }) {
  // 빌드할 때 API가 없어도 되도록 요청 시점에 읽는다. 결과는 캐시를 함께 쓴다.
  await connection();
  const format = await resolveFormat(fixed);
  const more = (query: string) => `/works?format=${format}&${query}`;
  const [popular, latest, completed] = await Promise.all([
    getWorks({ format, sort: "popular", pageSize: 7 }),
    getWorks({ format, sort: "latest", pageSize: 6 }),
    getWorks({ format, status: "COMPLETED", sort: "popular", pageSize: 4 }),
  ]);
  const [first, ...rest] = popular.items;

  if (!first) return <p className="page">아직 공개한 {WORK_FORMAT_LABEL[format]}이 없습니다.</p>;

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
      <div className="page">
        <WorkBanner slides={slides} />
      </div>

      <section className={`on-panel ${styles.panel}`} aria-label="인기 작품">
        <div className="page">
          <SectionHeading label="독자가 고른" title="인기 작품" more={more("sort=popular")} />
          <ol className={styles.popular}>
            {rest.map((work, index) => (
              <li key={work.id}>
                <Link href={`/works/${work.id}`}>
                  <div className={styles.popularText}>
                    <span className={styles.number}>({index + 2})</span>
                    <strong>{work.title}</strong>
                    <span className={styles.popularMeta}>
                      {work.authorName} · 조회 {formatCompact(work.viewCount)}
                    </span>
                  </div>
                  <WorkCover title={work.title} authorName={work.authorName} imageUrl={coverSrc(work)} bare />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page" aria-label="새로 올라온 회차">
        <SectionHeading label="방금 올라온" title="새로 올라온 회차" more={more("sort=latest")} center />
        <ol className={styles.latest}>
          {latest.items.map((work) => (
            <li key={work.id}>
              <Link href={`/works/${work.id}`}>
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
      </section>

      <section className="page" aria-label="완결 작품">
        <SectionHeading label="끝까지 읽는" title="완결 작품" more={more("status=COMPLETED")} />
        <ul className={styles.grid}>
          {completed.items.map((work) => (
            <li key={work.id}>
              <WorkCard work={work} overlay />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function HomePage({ format }: { format?: WorkFormat }) {
  return (
    <Main>
      <HomeHero>
        <Suspense fallback={null}>
          <HeroCovers format={format} />
        </Suspense>
      </HomeHero>
      <div className={styles.main}>
        <Suspense fallback={<div className={styles.skeleton} aria-busy="true" />}>
          <HomeContent format={format} />
        </Suspense>
      </div>
    </Main>
  );
}

export const WebtoonHomePage = () => <HomePage format="COMIC" />;
export const NovelHomePage = () => <HomePage format="NOVEL" />;
