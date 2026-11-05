import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartView } from "./cart-view";

const meta = {
  title: "features/CartView",
  component: CartView,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    cart: {
      coinBalance: 500,
      total: 350,
      items: [
        {
          id: "1",
          kind: "EPISODE",
          workId: "w",
          workTitle: "등대지기의 마지막 항로",
          episodeId: "e",
          episodeNumber: 3,
          episodeTitle: "지워진 출항 기록",
          price: 100,
          unavailableReason: null,
        },
        {
          id: "2",
          kind: "WORK",
          workId: "x",
          workTitle: "기억을 파는 골목",
          episodeId: null,
          episodeNumber: null,
          episodeTitle: null,
          price: 250,
          unavailableReason: null,
        },
      ],
    },
  },
} satisfies Meta<typeof CartView>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const NotEnoughCoins: Story = { args: { cart: { coinBalance: 100, total: 350, items: meta.args.cart.items } } };
