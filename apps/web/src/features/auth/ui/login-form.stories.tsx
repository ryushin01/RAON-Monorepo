import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RoleField } from "./role-field";

const meta = { title: "features/RoleField", component: RoleField, args: { legend: "회원 유형" } } satisfies Meta<
  typeof RoleField
>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
