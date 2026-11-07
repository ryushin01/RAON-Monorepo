import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";

const meta = { title: "shared/Button", component: Button, args: { children: "장바구니 담기" } } satisfies Meta<
  typeof Button
>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Disabled: Story = { args: { disabled: true } };
export const WithArrow: Story = { args: { arrow: true, children: "작품 둘러보기" } };
export const SecondaryWithArrow: Story = { args: { variant: "secondary", arrow: true, children: "인기순으로 보기" } };
