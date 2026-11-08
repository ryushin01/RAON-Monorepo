import { GENRE_LABEL, WORK_BADGE_LABEL, WORK_FORMAT_LABEL, WORK_STATUS_LABEL, type WorkSummary } from "@raon/contracts";
import Link from "next/link";
import { formatCompact } from "@/shared/lib";
import { Badge } from "@/shared/ui";
import { coverSrc } from "../lib/cover-src";
import styles from "./work-card.module.scss";
import { WorkCover } from "./work-cover";

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" />
      </svg>
    </span>
  );
}

export function WorkCard({
  work,
  headingLevel = 3,
  overlay,
}: {
  work: WorkSummary;
  headingLevel?: 2 | 3;
  /** 표지를 크게 쓰고 제목을 표지 위에 얹는다. */
  overlay?: boolean;
}) {
  const Heading = `h${headingLevel}` as const;
  if (overlay) {
    return (
      <article>
        <Link href={`/works/${work.id}`} className={styles.overlay}>
          <WorkCover title={work.title} authorName={work.authorName} imageUrl={coverSrc(work)} bare />
          <div className={styles.caption}>
            <div>
              <Heading className={styles.overlayTitle}>{work.title}</Heading>
              <p>
                {work.authorName} · {GENRE_LABEL[work.genre]} · {work.episodeCount}화
              </p>
            </div>
            <Arrow />
          </div>
        </Link>
      </article>
    );
  }
  return (
    <article className={styles.card}>
      <Link href={`/works/${work.id}`} className={styles.link}>
        <WorkCover title={work.title} authorName={work.authorName} imageUrl={coverSrc(work)} />
        <Heading className={styles.title}>{work.title}</Heading>
      </Link>
      {work.badges.length > 0 && (
        <p className={styles.badges}>
          {work.badges.map((badge) => (
            <Badge key={badge} solid={badge === "HOT"}>
              {WORK_BADGE_LABEL[badge]}
            </Badge>
          ))}
        </p>
      )}
      <p className={styles.meta}>
        {work.authorName} · {WORK_FORMAT_LABEL[work.format]} · {GENRE_LABEL[work.genre]} ·{" "}
        {WORK_STATUS_LABEL[work.status]}
        <br />
        {work.episodeCount}화 · 조회 {formatCompact(work.viewCount)}
        {work.ratingAverage !== null && ` · 별점 ${work.ratingAverage}`}
      </p>
    </article>
  );
}
