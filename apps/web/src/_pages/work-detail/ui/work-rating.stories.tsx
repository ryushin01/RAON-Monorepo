import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkRating } from "./work-rating";

const meta = {
  title: "pages/WorkDetail/WorkRating",
  component: WorkRating,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { workId: "w1", myRating: 4 },
} satisfies Meta<typeof WorkRating>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
