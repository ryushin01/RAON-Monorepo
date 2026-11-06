import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharGoal } from "./char-goal";

beforeEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: 테스트 사이에 쿠키를 지운다.
  document.cookie = "raon_episode_goal=; max-age=0; path=/";
});

const goalInput = () => screen.getByRole("textbox", { name: /회차 목표/ });

it("공백 포함과 제외 글자 수, 기본 목표까지 남은 분량을 보여 준다", () => {
  render(<CharGoal withSpaces={1200} withoutSpaces={1000} />);
  expect(screen.getByText("공백 포함 1,200자 · 공백 제외 1,000자")).toBeInTheDocument();
  expect(screen.getByText("목표 5,000자까지 3,800자 남음")).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "회차 목표 달성률" })).toHaveAttribute("value", "1200");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("간단히 보기에서는 입력 칸을 숨기고 분량과 진행은 남긴다", () => {
  render(<CharGoal withSpaces={1200} withoutSpaces={1000} compact />);
  expect(screen.queryByRole("textbox", { name: /회차 목표/ })).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});

it("목표를 넘으면 상태 영역에 알리고 진행 막대는 목표에서 멈춘다", () => {
  render(<CharGoal withSpaces={6000} withoutSpaces={5000} />);
  expect(screen.getByRole("status")).toHaveTextContent("목표 5,000자를 달성했습니다.");
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "5000");
  expect(screen.queryByText(/남음/)).not.toBeInTheDocument();
});

it("목표를 바꾸면 저장하고 바로 반영한다", async () => {
  render(<CharGoal withSpaces={100} withoutSpaces={80} />);
  await userEvent.clear(goalInput());
  await userEvent.type(goalInput(), "300");
  expect(screen.getByText("목표 300자까지 200자 남음")).toBeInTheDocument();
  expect(document.cookie).toContain("raon_episode_goal=300");
});

it("비우면 목표를 쓰지 않고, 다음에 열어도 유지한다", async () => {
  const { unmount } = render(<CharGoal withSpaces={100} withoutSpaces={80} />);
  await userEvent.clear(goalInput());
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  unmount();
  render(<CharGoal withSpaces={100} withoutSpaces={80} />);
  expect(goalInput()).toHaveValue("");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

it("잘못된 값은 이유를 칸에 연결해 알리고 저장하지 않는다", async () => {
  render(<CharGoal withSpaces={100} withoutSpaces={80} />);
  await userEvent.clear(goalInput());
  await userEvent.type(goalInput(), "많이");
  expect(goalInput()).toHaveAttribute("aria-invalid", "true");
  expect(goalInput()).toHaveAccessibleDescription(/사이의 숫자로 입력해 주세요/);
  expect(document.cookie).not.toContain("많이");
});
