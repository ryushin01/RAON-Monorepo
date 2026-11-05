import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SiteFooter } from "./site-footer";

const meta = { title: "widgets/SiteFooter", component: SiteFooter } satisfies Meta<typeof SiteFooter>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
