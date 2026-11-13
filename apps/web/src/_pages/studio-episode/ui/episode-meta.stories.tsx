import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EpisodeMeta } from "./episode-meta";

const meta = {
  title: "pages/StudioEpisode/EpisodeMeta",
  component: EpisodeMeta,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { episode: { id: "e1", episodeType: "SIDE", pointOfView: "이안" } },
} satisfies Meta<typeof EpisodeMeta>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
