import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkBanner } from "./work-banner";

const work = {
  id: "w1",
  title: "등대지기의 마지막 항로",
  format: "NOVEL",
  authorName: "윤슬",
  genre: "FANTASY",
  status: "ONGOING",
  synopsis: "바다가 사라진 세계에서 불을 지키는 마지막 등대지기의 이야기입니다.",
  viewCount: 48210,
  episodeCount: 5,
  firstEpisodeNumber: 1,
  latestEpisodeAt: null,
  tags: [],
  ratingAverage: null,
  ratingCount: 0,
  coverUpdatedAt: null,
  badges: [],
} as const;

const meta = {
  title: "widgets/WorkBanner",
  component: WorkBanner,
  args: {
    slides: [
      { label: "인기 1위", work: { ...work, tags: [], badges: [] } },
      { label: "새 회차", work: { ...work, id: "w2", title: "궤도 위의 우체부", tags: [], badges: [] } },
    ],
  },
} satisfies Meta<typeof WorkBanner>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
