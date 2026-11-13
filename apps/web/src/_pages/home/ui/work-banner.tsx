"use client";

import { GENRE_LABEL, WORK_STATUS_LABEL, type WorkSummary } from "@raon/contracts";
import Link from "next/link";
import { useState } from "react";
import { coverSrc, WorkCover } from "@/entities/work";
import { Button, ButtonLink } from "@/shared/ui";
import styles from "./work-banner.module.scss";

export interface BannerSlide {
  label: string;
  work: WorkSummary;
}

function Chevron({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * 메인 배너. 자동으로 넘어가지 않고 버튼으로만 넘긴다(KWCAG 5.4.2, 6.2.2).
 * 끌기 동작 없이 단일 포인터로 조작한다(6.5.1).
 */
export function WorkBanner({ slides }: { slides: BannerSlide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const move = (delta: number) => setIndex((current) => (current + delta + count) % count);

  return (
    <section className={styles.banner} aria-label="추천 작품">
      {slides.map(({ label, work }, slideIndex) => (
        <article key={work.id} className={styles.slide} hidden={slideIndex !== index}>
          <WorkCover title={work.title} authorName={work.authorName} imageUrl={coverSrc(work)} />
          <div className={styles.card}>
            <p>({label})</p>
            <h2 className={styles.title}>
              <Link href={`/works/${work.id}`}>{work.title}</Link>
            </h2>
            <p className={styles.synopsis}>{work.synopsis}</p>
            <p className={styles.meta}>
              {work.authorName} · {GENRE_LABEL[work.genre]} · {WORK_STATUS_LABEL[work.status]} · {work.episodeCount}화
            </p>
            {work.firstEpisodeNumber !== null && (
              <p className={styles.cta}>
                <ButtonLink
                  href={`/works/${work.id}/episodes/${work.firstEpisodeNumber}`}
                  aria-label={`첫 화 보기: ${work.title}`}
                  arrow
                >
                  첫 화 보기
                </ButtonLink>
              </p>
            )}
          </div>
        </article>
      ))}
      {count > 1 && (
        <div className={styles.controls}>
          <p className={styles.position} aria-live="polite">
            <span className="visually-hidden">배너 </span>
            {index + 1} / {count}
          </p>
          <Button variant="secondary" className={styles.round} aria-label="이전 배너" onClick={() => move(-1)}>
            <Chevron d="M10 3 5 8l5 5" />
          </Button>
          <Button variant="secondary" className={styles.round} aria-label="다음 배너" onClick={() => move(1)}>
            <Chevron d="m6 3 5 5-5 5" />
          </Button>
        </div>
      )}
    </section>
  );
}
