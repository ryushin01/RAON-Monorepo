import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComicAutoScroll } from "./comic-auto-scroll";

let scrollBy: jest.Mock;
beforeEach(() => {
  scrollBy = jest.fn();
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 100_000 });
});

const toggle = () => screen.getByRole("button", { name: /자동 스크롤/ });

it("켜기 전에는 움직이지 않고, 켜면 스크롤하며, 다시 누르면 멈춘다", async () => {
  render(<ComicAutoScroll />);
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(scrollBy).not.toHaveBeenCalled();
  expect(toggle()).toHaveAttribute("aria-pressed", "false");

  await userEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(toggle()).toHaveTextContent("자동 스크롤 멈춤");
  await new Promise((resolve) => setTimeout(resolve, 120));
  expect(scrollBy).toHaveBeenCalled();

  await userEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  scrollBy.mockClear();
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(scrollBy).not.toHaveBeenCalled();
});

it.each([
  ["휠", () => fireEvent.wheel(window)],
  ["터치", () => fireEvent.touchStart(window)],
  ["스크롤 키", () => fireEvent.keyDown(window, { key: "PageDown" })],
])("%s로 직접 움직이면 멈춘다", async (_, act) => {
  render(<ComicAutoScroll />);
  await userEvent.click(toggle());
  act();
  expect(await screen.findByRole("button", { name: "자동 스크롤" })).toHaveAttribute("aria-pressed", "false");
});

it("조작 칸 안의 터치와 키 입력으로는 멈추지 않고, 버튼을 터치해 누르면 한 번에 꺼진다", async () => {
  render(<ComicAutoScroll />);
  await userEvent.click(toggle());
  const speed = screen.getByRole("combobox", { name: "자동 스크롤 속도" });

  fireEvent.keyDown(speed, { key: "ArrowDown" });
  fireEvent.touchStart(speed);
  fireEvent.keyDown(toggle(), { key: " " });
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(toggle()).toHaveAttribute("aria-pressed", "true");

  // 터치 기기에서는 touchstart 뒤에 click이 이어진다.
  fireEvent.touchStart(toggle());
  fireEvent.click(toggle());
  expect(await screen.findByRole("button", { name: "자동 스크롤" })).toHaveAttribute("aria-pressed", "false");
});

it("포인터가 버튼 위에 있어도 휠을 굴리면 멈춘다", async () => {
  render(<ComicAutoScroll />);
  await userEvent.click(toggle());
  fireEvent.wheel(toggle());
  expect(await screen.findByRole("button", { name: "자동 스크롤" })).toHaveAttribute("aria-pressed", "false");
});

it("페이지 끝에 닿으면 멈춘다", async () => {
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 0 });
  render(<ComicAutoScroll />);
  await userEvent.click(toggle());
  expect(await screen.findByRole("button", { name: "자동 스크롤" })).toHaveAttribute("aria-pressed", "false");
});

it("속도를 고를 수 있다", async () => {
  render(<ComicAutoScroll />);
  const speed = screen.getByRole("combobox", { name: "자동 스크롤 속도" });
  expect(speed).toHaveDisplayValue("보통");
  await userEvent.selectOptions(speed, "빠르게");
  expect(speed).toHaveDisplayValue("빠르게");
});
