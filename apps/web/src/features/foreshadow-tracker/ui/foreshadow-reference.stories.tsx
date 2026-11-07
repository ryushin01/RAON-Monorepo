import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ForeshadowReference } from "./foreshadow-reference";

const meta = {
  title: "features/ForeshadowReference",
  component: ForeshadowReference,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { workId: "w1", episodeId: "e1", episodes: [{ id: "e1", number: 1, title: "첫 회차" }] },
} satisfies Meta<typeof ForeshadowReference>;
export default meta;

/** 목록은 서버에서 읽으므로 Storybook에서는 입력 칸만 보인다. 전체 동작은 E2E로 검사한다. */
export const Default: StoryObj<typeof meta> = {};
