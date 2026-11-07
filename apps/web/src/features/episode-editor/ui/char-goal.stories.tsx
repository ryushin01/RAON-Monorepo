import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CharGoal } from "./char-goal";

const meta = {
  title: "features/CharGoal",
  component: CharGoal,
  args: { withSpaces: 1834, withoutSpaces: 1402, withoutSymbols: 1280 },
} satisfies Meta<typeof CharGoal>;
export default meta;

export const InProgress: StoryObj<typeof meta> = {};

export const Reached: StoryObj<typeof meta> = {
  args: { withSpaces: 5210, withoutSpaces: 4011, withoutSymbols: 3700 },
};
