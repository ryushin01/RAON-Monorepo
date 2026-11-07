import { GENRE_LABEL, WORK_BADGE_LABEL, WORK_FORMAT_LABEL, WORK_STATUS_LABEL, type WorkSummary } from "@raon/contracts";
import Link from "next/link";
import { formatCompact } from "@/shared/lib";
import { Badge } from "@/shared/ui";
import { coverSrc } from "../lib/cover-src";
import styles from "./work-card.module.scss";
import { WorkCover } from "./work-cover";

export function WorkCard({ work, headingLevel = 3 }: { work: WorkSummary; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as const;
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
