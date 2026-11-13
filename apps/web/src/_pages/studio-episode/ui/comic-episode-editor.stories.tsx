import { docFromText } from "@raon/contracts";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ComicEpisodeEditor } from "./comic-episode-editor";

const meta = {
  title: "pages/StudioEpisode/ComicEpisodeEditor",
  component: ComicEpisodeEditor,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    episode: {
      id: "e1",
      workId: "w1",
      number: 1,
      title: "첫 장면",
      status: "DRAFT",
      writingStage: "DRAFTING",
      episodeType: "REGULAR",
      pointOfView: "",
      isFree: true,
      charCount: 0,
      content: docFromText(""),
      authorNote: null,
      updatedAt: "2026-11-07T00:00:00.000Z",
      publishedAt: null,
    },
  },
} satisfies Meta<typeof ComicEpisodeEditor>;
export default meta;

/** 이미지는 서버에서 읽으므로 Storybook에서는 불러오는 상태만 보인다. 전체 동작은 E2E로 검사한다. */
export const Default: StoryObj<typeof meta> = {};
