import { GENRE_LABEL, WORK_STATUS_LABEL, type WorkSummary } from "@raon/contracts";
import Link from "next/link";
import { formatCompact } from "@/shared/lib";
import styles from "./work-card.module.scss";
import { WorkCover } from "./work-cover";

export function WorkCard({ work, headingLevel = 3 }: { work: WorkSummary; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article className={styles.card}>
      <Link href={`/works/${work.id}`} className={styles.link}>
        <WorkCover title={work.title} authorName={work.authorName} />
        <Heading className={styles.title}>{work.title}</Heading>
      </Link>
      <p className={styles.meta}>
        {work.authorName} · {GENRE_LABEL[work.genre]} · {WORK_STATUS_LABEL[work.status]}
        <br />
        {work.episodeCount}화 · 조회 {formatCompact(work.viewCount)}
      </p>
    </article>
  );
}
