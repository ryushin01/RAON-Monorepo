import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Main } from "./main";

const meta = { title: "shared/Main", component: Main, args: { children: "본문 영역" } } satisfies Meta<typeof Main>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
