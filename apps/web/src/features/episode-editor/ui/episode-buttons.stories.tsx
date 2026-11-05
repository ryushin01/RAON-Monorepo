import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NewEpisodeButton } from "./episode-buttons";

const meta = {
  title: "features/NewEpisodeButton",
  component: NewEpisodeButton,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { workId: "w1" },
} satisfies Meta<typeof NewEpisodeButton>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
