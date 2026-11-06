import { docFromText } from "@raon/contracts";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VersionHistory } from "./version-history";

const meta = {
  title: "features/VersionHistory",
  component: VersionHistory,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    episodeId: "e1",
    isPublic: false,
    getDoc: () => docFromText("지금 본문"),
    saveFirst: async () => true,
    onRestored: () => {},
  },
} satisfies Meta<typeof VersionHistory>;
export default meta;

/** 목록은 서버에서 읽으므로 Storybook에서는 불러오는 상태만 보인다. 전체 동작은 E2E로 검사한다. */
export const Default: StoryObj<typeof meta> = {};
