import { docFromText } from "@raon/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/core";
import { AiPolish } from "./ai-polish";
import { editorExtensions } from "./extensions";

const hook = {
  completion: "",
  complete: jest.fn(),
  isLoading: false,
  stop: jest.fn(),
  error: undefined as Error | undefined,
  setCompletion: jest.fn(),
};
jest.mock("@ai-sdk/react", () => ({ useCompletion: () => hook }));

const make = (text: string) => new Editor({ extensions: editorExtensions, content: docFromText(text) });

beforeEach(() => {
  Object.assign(hook, { completion: "", isLoading: false, error: undefined });
  jest.clearAllMocks();
});

it("커서가 있는 단락을 보내고, 외부로 보낸다는 사실을 알린다", async () => {
  const editor = make("첫 단락.\n\n둘째 단락.");
  editor.commands.setTextSelection(3);
  render(<AiPolish editor={editor} />);
  expect(screen.getByText(/Anthropic의 AI로 보내/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "다듬기" }));
  expect(hook.complete).toHaveBeenCalledWith("첫 단락.");
  expect(screen.getByRole("status")).toHaveTextContent("다듬는 중입니다.");
});

it("단락을 넘는 선택과 빈 단락은 보내지 않는다", async () => {
  const editor = make("첫 단락.\n\n둘째 단락.");
  editor.commands.setTextSelection({ from: 2, to: 12 });
  render(<AiPolish editor={editor} />);
  await userEvent.click(screen.getByRole("button", { name: "다듬기" }));
  expect(screen.getByText("한 단락 안에서 골라 주세요.")).toBeInTheDocument();
  expect(hook.complete).not.toHaveBeenCalled();
});

it("결과를 확인한 뒤 적용하고, 실행 취소로 되돌린다", async () => {
  const editor = make("등대가 빛났다.");
  editor.commands.setTextSelection(2);
  const { rerender } = render(<AiPolish editor={editor} />);
  await userEvent.click(screen.getByRole("button", { name: "다듬기" }));
  hook.completion = "등대가\n환하게 빛났다.";
  rerender(<AiPolish editor={editor} />);
  expect(screen.getByRole("region", { name: "다듬은 글" })).toHaveTextContent("환하게");
  await userEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(editor.getText()).toBe("등대가 환하게 빛났다.");
  editor.commands.undo();
  expect(editor.getText()).toBe("등대가 빛났다.");
});

it("방금 입력한 글과 적용을 따로 되돌린다", async () => {
  const editor = make("등대");
  editor.commands.setTextSelection(3);
  editor.commands.insertContent("가 빛났다.");
  const { rerender } = render(<AiPolish editor={editor} />);
  await userEvent.click(screen.getByRole("button", { name: "다듬기" }));
  hook.completion = "등대가 환하게 빛났다.";
  rerender(<AiPolish editor={editor} />);
  await userEvent.click(screen.getByRole("button", { name: "적용" }));
  editor.commands.undo();
  expect(editor.getText()).toBe("등대가 빛났다.");
});

it("다듬는 사이 본문이 바뀌면 적용하지 않는다", async () => {
  const editor = make("등대가 빛났다.");
  editor.commands.setTextSelection(2);
  const { rerender } = render(<AiPolish editor={editor} />);
  await userEvent.click(screen.getByRole("button", { name: "다듬기" }));
  editor.commands.insertContentAt(1, "새 ");
  hook.completion = "다른 글";
  rerender(<AiPolish editor={editor} />);
  await userEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(screen.getByText(/그사이 본문이 바뀌어/)).toBeInTheDocument();
  expect(editor.getText()).toBe("새 등대가 빛났다.");
});

it("만드는 동안 멈출 수 있고, 실패 이유를 알린다", () => {
  hook.isLoading = true;
  hook.error = new Error("AI 키가 설정되지 않아 문단 다듬기를 쓸 수 없습니다.");
  render(<AiPolish editor={make("글")} />);
  expect(screen.getByRole("button", { name: "다듬기" })).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("button", { name: "멈추기" })).toBeInTheDocument();
  expect(screen.getByText(/AI 키가 설정되지 않아/)).toBeInTheDocument();
});
