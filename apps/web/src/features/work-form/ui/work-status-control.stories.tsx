import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkStatusControl } from "./work-status-control";

const meta = {
  title: "features/WorkStatusControl",
  component: WorkStatusControl,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { workId: "w1", status: "ONGOING" },
} satisfies Meta<typeof WorkStatusControl>;
export default meta;

export const Ongoing: StoryObj<typeof meta> = {};
