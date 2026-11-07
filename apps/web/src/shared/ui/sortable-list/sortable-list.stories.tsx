import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SortableList } from "./sortable-list";

const meta = {
  title: "shared/SortableList",
  component: SortableList,
  args: {
    name: "회차",
    onReorder: async () => {},
    items: ["불을 끄지 말 것", "소금 위의 신호", "지워진 출항 기록"].map((title, index) => ({
      id: String(index),
      label: `${index + 1}화`,
      content: (
        <span>
          {index + 1}화. {title}
        </span>
      ),
    })),
  },
} satisfies Meta<typeof SortableList>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
