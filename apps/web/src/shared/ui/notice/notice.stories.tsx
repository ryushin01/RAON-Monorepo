import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Notice } from "./notice";

const meta = { title: "shared/Notice", component: Notice, args: { children: "저장했습니다." } } satisfies Meta<
  typeof Notice
>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Info: Story = {};
export const ErrorTone: Story = { args: { tone: "error", children: "코인이 부족합니다." } };
