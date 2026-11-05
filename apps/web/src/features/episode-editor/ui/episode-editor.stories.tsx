import { docFromText } from "@raon/contracts";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EpisodeEditor } from "./episode-editor";

const meta = {
  title: "features/EpisodeEditor",
  component: EpisodeEditor,
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
      number: 3,
      title: "지워진 출항 기록",
      status: "DRAFT",
      isFree: false,
      charCount: 12,
      content: docFromText("새벽이 되자 줄은 한 칸 더 늘어나 있었다."),
      authorNote: null,
      updatedAt: "2026-11-05T00:00:00.000Z",
      publishedAt: null,
    },
  },
} satisfies Meta<typeof EpisodeEditor>;
export default meta;

export const Draft: StoryObj<typeof meta> = {};
