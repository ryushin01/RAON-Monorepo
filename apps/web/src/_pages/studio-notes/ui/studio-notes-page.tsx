import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/entities/session/index.server";
import { getStudioWork } from "@/entities/studio/index.server";
import { ForeshadowManager } from "@/features/foreshadow-tracker";
import { NotesManager } from "@/features/work-notes";
import { Main } from "@/shared/ui";
import styles from "./studio-notes.module.scss";

export const studioNotesMetadata: Metadata = { title: "설정집과 메모" };

type Params = Promise<{ workId: string }>;

async function StudioNotesContent({ params }: { params: Params }) {
  const { workId } = await params;
  const { token } = await requireUser("AUTHOR", `/studio/works/${workId}/notes`);
  const work = await getStudioWork(workId, token);
  if (!work) notFound();

  return (
    <>
      <div>
        <p className={styles.crumb}>
          <Link href={`/studio/works/${work.id}`}>{work.title}</Link>
        </p>
        <h1 className={styles.title}>설정집과 메모</h1>
        <p className={styles.meta}>작가만 볼 수 있습니다. 독자에게는 보이지 않습니다.</p>
      </div>
      <NotesManager
        workId={work.id}
        episodeNumbers={Object.fromEntries(work.episodes.map((episode) => [episode.id, episode.number]))}
      />
      <ForeshadowManager
        workId={work.id}
        episodes={[...work.episodes, ...work.trash.map((episode) => ({ ...episode, trashed: true }))]}
      />
    </>
  );
}

export function StudioNotesPage({ params }: { params: Params }) {
  return (
    <Main className={`page ${styles.main}`}>
      <Suspense fallback={<p aria-busy="true">설정집을 불러오는 중입니다.</p>}>
        <StudioNotesContent params={params} />
      </Suspense>
    </Main>
  );
}
