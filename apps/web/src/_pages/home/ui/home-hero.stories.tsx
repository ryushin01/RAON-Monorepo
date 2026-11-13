import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HomeHero } from "./home-hero";

const meta = { title: "pages/Home/HomeHero", component: HomeHero } satisfies Meta<typeof HomeHero>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
