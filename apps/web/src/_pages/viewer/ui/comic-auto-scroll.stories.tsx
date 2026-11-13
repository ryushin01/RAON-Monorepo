import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ComicAutoScroll } from "./comic-auto-scroll";

const meta = { title: "pages/Viewer/ComicAutoScroll", component: ComicAutoScroll } satisfies Meta<
  typeof ComicAutoScroll
>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
