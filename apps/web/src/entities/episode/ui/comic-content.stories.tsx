import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ComicContent } from "./comic-content";

const meta = {
  title: "entities/ComicContent",
  component: ComicContent,
  args: {
    episodeId: "e1",
    images: [{ id: "i1", position: 1, alt: "달이 뜬 밤의 능선", width: 480, height: 640 }],
  },
} satisfies Meta<typeof ComicContent>;
export default meta;

/** 이미지는 서버에서 받으므로 Storybook에서는 대체 텍스트만 보인다. 전체 동작은 E2E로 검사한다. */
export const Default: StoryObj<typeof meta> = {};
