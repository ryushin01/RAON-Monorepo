import { docFromText } from "@raon/contracts";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEditor } from "@tiptap/react";
import { editorExtensions } from "./extensions";
import { FindReplace } from "./find-replace";
import { WritingTools } from "./writing-tools";

const content = docFromText("“등대를 켜라.”\n\n그는 등대를 보았다. 그는 바다를 보았다. 그는 등대를 보았다.");

function Tools() {
  const editor = useEditor({ extensions: editorExtensions, content, immediatelyRender: false });
  return editor ? <WritingTools editor={editor} chars={120} onFind={() => {}} /> : null;
}

function Find() {
  const editor = useEditor({ extensions: editorExtensions, content, immediatelyRender: false });
  return editor ? <FindReplace editor={editor} initialQuery="등대" onClose={() => {}} /> : null;
}

const meta = { title: "features/WritingTools", component: Tools } satisfies Meta<typeof Tools>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
export const FindAndReplace: StoryObj<typeof meta> = { render: () => <Find /> };
