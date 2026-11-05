import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkForm } from "./work-form";

const meta = {
  title: "features/WorkForm",
  component: WorkForm,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof WorkForm>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
