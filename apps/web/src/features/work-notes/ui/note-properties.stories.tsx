import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NoteProperties } from "./note-properties";

const meta = {
  title: "features/NoteProperties",
  component: NoteProperties,
  args: {
    properties: [
      { name: "나이", value: "서른둘" },
      { name: "소속", value: "폐역 역장" },
    ],
  },
} satisfies Meta<typeof NoteProperties>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
