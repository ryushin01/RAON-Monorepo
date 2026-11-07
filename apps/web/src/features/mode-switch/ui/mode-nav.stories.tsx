import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ModeNav } from "./mode-nav";

const meta = { title: "features/ModeNav", component: ModeNav } satisfies Meta<typeof ModeNav>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
