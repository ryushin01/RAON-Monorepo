import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChargeCoins } from "./charge-coins";

const meta = {
  title: "features/ChargeCoins",
  component: ChargeCoins,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ChargeCoins>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
