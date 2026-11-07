import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NoteLinkCard } from "./note-link-card";

const meta = {
  title: "features/NoteLinkCard",
  component: NoteLinkCard,
  args: {
    note: {
      title: "이안",
      category: "인물",
      aliases: ["등대지기"],
      properties: [{ name: "나이", value: "서른둘" }],
      body: "소금 사막의 마지막 등대지기다.",
    },
  },
} satisfies Meta<typeof NoteLinkCard>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
