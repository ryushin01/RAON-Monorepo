import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Pagination } from "./pagination";

const meta = {
  title: "shared/Pagination",
  component: Pagination,
  args: { page: 2, pageSize: 10, total: 45, hrefFor: (page: number) => `?page=${page}` },
} satisfies Meta<typeof Pagination>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
