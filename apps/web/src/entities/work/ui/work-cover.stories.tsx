import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkCover } from "./work-cover";

const meta = {
  title: "entities/WorkCover",
  component: WorkCover,
  decorators: [
    (Story) => (
      <div style={{ width: 180 }}>
        <Story />
      </div>
    ),
  ],
  args: { title: "등대지기의 마지막 항로", authorName: "윤슬" },
} satisfies Meta<typeof WorkCover>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
