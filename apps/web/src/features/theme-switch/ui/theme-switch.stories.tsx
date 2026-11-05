import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeSwitch } from "./theme-switch";

const meta = { title: "features/ThemeSwitch", component: ThemeSwitch } satisfies Meta<typeof ThemeSwitch>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
