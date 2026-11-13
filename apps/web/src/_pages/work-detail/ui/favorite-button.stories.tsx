import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FavoriteButton } from "./favorite-button";

const meta = {
  title: "pages/WorkDetail/FavoriteButton",
  component: FavoriteButton,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { workId: "w1", isFavorite: false },
} satisfies Meta<typeof FavoriteButton>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Off: Story = {};
export const On: Story = { args: { isFavorite: true } };
