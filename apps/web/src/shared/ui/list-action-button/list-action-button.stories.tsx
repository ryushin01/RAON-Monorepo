import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ListActionButton } from "./list-action-button";

const meta = {
  title: "shared/ListActionButton",
  component: ListActionButton,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { action: async () => ({ ok: true }), text: "복원", target: "3화" },
} satisfies Meta<typeof ListActionButton>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithConfirm: Story = {
  args: { text: "완전히 지우기", confirmMessage: "3화를 완전히 지울까요? 되돌릴 수 없습니다." },
};
