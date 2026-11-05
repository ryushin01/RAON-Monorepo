import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/entities/session/index.server";
import { getStudioEpisode, getStudioWork } from "@/entities/studio/index.server";
import { EpisodeEditor } from "@/features/episode-editor";
import styles from "./studio-episode.module.scss";

export const studioEpisodeMetadata: Metadata = { title: "회차 쓰기" };

type Params = Promise<{ workId: string; episodeId?: string }>;

async function EditorContent({ params }: { params: Params }) {
  const { workId, episodeId } = await params;
  const path = `/studio/works/${workId}/episodes/${episodeId ?? "new"}`;
  const { token } = await requireUser("AUTHOR", path);
  const [work, episode] = await Promise.all([
    getStudioWork(workId, token),
    episodeId ? getStudioEpisode(episodeId, token) : null,
  ]);
  if (!work || (episodeId && episode?.workId !== workId)) notFound();

  return (
    <>
      <h1 className={styles.title}>{work.title}</h1>
      <EpisodeEditor workId={workId} episode={episode ?? undefined} />
    </>
  );
}

export function StudioEpisodePage({ params }: { params: Params }) {
  return (
    <main id="main" className={styles.main}>
      <Suspense fallback={<p aria-busy="true">에디터를 불러오는 중입니다.</p>}>
        <EditorContent params={params} />
      </Suspense>
    </main>
  );
}
