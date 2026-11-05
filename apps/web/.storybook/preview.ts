import "../src/_app/styles/global.scss";

import type { Preview } from "@storybook/nextjs-vite";

const preview: Preview = {
  parameters: { nextjs: { appDirectory: true } },
};

export default preview;
