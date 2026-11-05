import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignupForm } from "./signup-form";

const meta = {
  title: "features/SignupForm",
  component: SignupForm,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof SignupForm>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
