import { render, screen } from "@testing-library/react";
import { Activity } from "react";
import { Main } from "./main";

it("보일 때는 본문 바로가기의 대상이 된다", () => {
  render(<Main>본문</Main>);
  const main = screen.getByRole("main");
  expect(main).toHaveAttribute("id", "main");
  expect(main).toHaveAttribute("tabindex", "-1");
});

it("Activity로 숨겨지면 hidden을 붙이고 id를 떼며, 다시 보이면 되돌린다", () => {
  const view = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <Main data-testid="main">본문</Main>
    </Activity>
  );
  const { rerender } = render(view("visible"));
  const main = screen.getByTestId("main");

  rerender(view("hidden"));
  expect(main).toHaveAttribute("hidden");
  expect(main).not.toHaveAttribute("id");

  rerender(view("visible"));
  expect(main).not.toHaveAttribute("hidden");
  expect(main).toHaveAttribute("id", "main");
});
