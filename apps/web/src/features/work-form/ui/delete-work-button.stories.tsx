import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeleteWorkButton } from "./delete-work-button";

const meta = {
  title: "features/DeleteWorkButton",
  component: DeleteWorkButton,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { workId: "w1", title: "등대지기의 마지막 항로" },
} satisfies Meta<typeof DeleteWorkButton>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
