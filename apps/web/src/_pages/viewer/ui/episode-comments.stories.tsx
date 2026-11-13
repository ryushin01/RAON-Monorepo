import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EpisodeComments } from "./episode-comments";

const meta = {
  title: "pages/Viewer/EpisodeComments",
  component: EpisodeComments,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    episodeId: "e1",
    path: "/works/w/episodes/1",
    loggedIn: true,
    total: 1,
    comments: [
      {
        id: "1",
        authorName: "책벌레",
        body: "다음 화가 기다려져요.",
        createdAt: "2026-11-05T00:00:00.000Z",
        canDelete: true,
        isAuthor: false,
        likeCount: 3,
        likedByMe: true,
        deleted: false,
        replies: [
          {
            id: "2",
            authorName: "윤슬",
            body: "고맙습니다. 곧 올리겠습니다.",
            createdAt: "2026-11-05T01:00:00.000Z",
            canDelete: false,
            isAuthor: true,
            likeCount: 1,
            likedByMe: false,
          },
        ],
      },
    ],
  },
} satisfies Meta<typeof EpisodeComments>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
