import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ViewerSettingsPanel } from "./viewer-settings";

const meta = { title: "features/ViewerSettings", component: ViewerSettingsPanel } satisfies Meta<
  typeof ViewerSettingsPanel
>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
