import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EpisodePurchaseList } from "./episode-purchase-list";

const episode = (number: number, isFree: boolean) => ({
  id: `e${number}`,
  number,
  title: `제목 ${number}`,
  isFree,
  charCount: 3200,
  publishedAt: "2026-11-01T00:00:00.000Z",
});

const meta = {
  title: "features/EpisodePurchaseList",
  component: EpisodePurchaseList,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    role: "READER",
    access: {
      ownsWork: false,
      ownedEpisodeIds: ["e2"],
      cartEpisodeIds: [],
      workInCart: false,
      isFavorite: false,
      myRating: null,
      lastReadNumber: null,
      wholePriceForUser: 150,
    },
    work: {
      id: "w1",
      title: "작품",
      format: "NOVEL",
      authorName: "작가",
      genre: "SF",
      status: "COMPLETED",
      synopsis: "소개",
      viewCount: 1,
      episodeCount: 4,
      firstEpisodeNumber: 1,
      latestEpisodeAt: null,
      tags: [],
      ratingAverage: null,
      ratingCount: 0,
      coverUpdatedAt: null,
      badges: [],
      episodePrice: 100,
      wholePrice: 250,
      episodes: [episode(1, true), episode(2, false), episode(3, false), episode(4, false)],
    },
  },
} satisfies Meta<typeof EpisodePurchaseList>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
