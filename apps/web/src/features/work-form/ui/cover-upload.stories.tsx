import type { StudioWork } from "@raon/contracts";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CoverUpload } from "./cover-upload";

const meta = {
  title: "features/CoverUpload",
  component: CoverUpload,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { work: { id: "w1", title: "등대지기의 마지막 항로", coverUpdatedAt: null } as StudioWork },
} satisfies Meta<typeof CoverUpload>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
