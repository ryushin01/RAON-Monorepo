import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkTransfer } from "./work-transfer";

const meta = {
  title: "features/WorkTransfer",
  component: WorkTransfer,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { workId: "w1" },
} satisfies Meta<typeof WorkTransfer>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
