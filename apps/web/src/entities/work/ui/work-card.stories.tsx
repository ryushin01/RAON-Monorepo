import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkCard } from "./work-card";

const meta = {
  title: "entities/WorkCard",
  component: WorkCard,
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    work: {
      id: "w1",
      title: "등대지기의 마지막 항로",
      format: "NOVEL",
      authorName: "윤슬",
      genre: "FANTASY",
      status: "ONGOING",
      synopsis: "소개",
      viewCount: 48210,
      episodeCount: 5,
      firstEpisodeNumber: 1,
      latestEpisodeAt: null,
      tags: [],
      ratingAverage: 4.5,
      ratingCount: 2,
      coverUpdatedAt: null,
      badges: ["HOT", "UP"],
    },
  },
} satisfies Meta<typeof WorkCard>;
export default meta;

export const Default: StoryObj<typeof meta> = {};

export const Overlay: StoryObj<typeof meta> = { args: { overlay: true } };
