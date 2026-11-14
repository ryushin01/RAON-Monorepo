import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SelectField } from "./field";

const meta = {
  title: "shared/SelectField",
  component: SelectField,
  args: {
    label: "형식",
    defaultValue: "html",
    children: [
      <option key="html" value="html">
        HTML
      </option>,
      <option key="markdown" value="markdown">
        마크다운
      </option>,
    ],
  },
} satisfies Meta<typeof SelectField>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithHint: Story = { args: { hint: "내보낼 파일 형식입니다." } };
export const WithError: Story = { args: { error: "형식을 골라 주세요." } };
export const Disabled: Story = { args: { disabled: true } };
