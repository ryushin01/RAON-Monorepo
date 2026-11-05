import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ErrorPage } from "./error-page";
import { NotFoundPage } from "./not-found-page";

const meta = { title: "pages/Errors", component: NotFoundPage } satisfies Meta<typeof NotFoundPage>;
export default meta;

type Story = StoryObj<typeof meta>;
export const NotFound: Story = {};
export const Failed: Story = { render: () => <ErrorPage reset={() => {}} /> };
