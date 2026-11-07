import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/entities/session/index.server";
import { getStudioEpisode, getStudioWork } from "@/entities/studio/index.server";
import { ComicEpisodeEditor } from "@/features/comic-editor";
import { EpisodeEditor, Tool } from "@/features/episode-editor";
import { ForeshadowReference } from "@/features/foreshadow-tracker";
import { EpisodeMemo, NoteReference } from "@/features/work-notes";
import { Main } from "@/shared/ui";
import styles from "./studio-episode.module.scss";

export const studioEpisodeMetadata: Metadata = { title: "회차 쓰기" };

type Params = Promise<{ workId: string; episodeId: string }>;

async function EditorContent({ params }: { params: Params }) {
  const { workId, episodeId } = await params;
  const { token } = await requireUser("AUTHOR", `/studio/works/${workId}/episodes/${episodeId}`);
  const [work, episode] = await Promise.all([getStudioWork(workId, token), getStudioEpisode(episodeId, token)]);
  if (!work || episode?.workId !== workId) notFound();

  return (
    <>
      <h1 className={styles.title}>{work.title}</h1>
      {work.format === "COMIC" ? (
        <ComicEpisodeEditor key={episode.id} episode={episode} />
      ) : (
        <EpisodeEditor
          key={episode.id}
          episode={episode}
          tools={
            <>
              <Tool title="설정집 참조">
                <NoteReference workId={workId} />
              </Tool>
              <Tool title="복선">
                <ForeshadowReference
                  workId={workId}
                  episodeId={episode.id}
                  episodes={[...work.episodes, ...work.trash.map((item) => ({ ...item, trashed: true }))]}
                />
              </Tool>
              <Tool title="회차 메모">
                <EpisodeMemo workId={workId} episodeId={episode.id} />
              </Tool>
            </>
          }
        />
      )}
    </>
  );
}

export function StudioEpisodePage({ params }: { params: Params }) {
  return (
    <Main className={styles.main}>
      <Suspense fallback={<p aria-busy="true">에디터를 불러오는 중입니다.</p>}>
        <EditorContent params={params} />
      </Suspense>
    </Main>
  );
}
