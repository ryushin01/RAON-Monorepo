import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitch } from "./theme-switch";

beforeEach(() => {
  document.documentElement.dataset.theme = "light";
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
});

it("누르면 어두운 화면으로 바뀌고 저장한다", async () => {
  render(<ThemeSwitch />);
  const button = screen.getByRole("button", { name: "어두운 화면" });
  expect(button).toHaveAttribute("aria-pressed", "false");

  await userEvent.click(button);

  expect(button).toHaveAttribute("aria-pressed", "true");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("raon:theme")).toBe("dark");
});
