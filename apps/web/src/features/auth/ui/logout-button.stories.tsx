import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogoutButton } from "./logout-button";

const meta = { title: "features/LogoutButton", component: LogoutButton } satisfies Meta<typeof LogoutButton>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
