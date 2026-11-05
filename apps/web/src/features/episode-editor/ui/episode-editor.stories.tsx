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
  args: { workId: "w1" },
} satisfies Meta<typeof EpisodeEditor>;
export default meta;

export const NewEpisode: StoryObj<typeof meta> = {};
