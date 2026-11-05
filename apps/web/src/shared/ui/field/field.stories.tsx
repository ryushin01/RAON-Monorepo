import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextField } from "./field";

const meta = { title: "shared/TextField", component: TextField, args: { label: "이메일" } } satisfies Meta<
  typeof TextField
>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithHint: Story = { args: { hint: "로그인할 때 씁니다." } };
export const WithError: Story = { args: { error: "이메일 형식을 확인해 주세요." } };
