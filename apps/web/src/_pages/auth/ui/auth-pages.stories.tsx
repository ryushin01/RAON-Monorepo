import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignupPage } from "./auth-pages";

const meta = {
  title: "pages/Signup",
  component: SignupPage,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof SignupPage>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
