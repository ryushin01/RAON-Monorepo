import { docFromText } from "@raon/contracts";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EpisodeContent } from "./episode-content";

const meta = {
  title: "entities/EpisodeContent",
  component: EpisodeContent,
  args: { doc: docFromText("첫 번째 문단입니다.\n\n“두 번째 문단입니다.” 그가 말했다.") },
} satisfies Meta<typeof EpisodeContent>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
