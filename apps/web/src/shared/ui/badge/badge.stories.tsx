import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";

const meta = { title: "shared/Badge", component: Badge, args: { children: "연재 중" } } satisfies Meta<typeof Badge>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Outline: Story = {};
export const Solid: Story = { args: { solid: true, children: "완결" } };
