import { render, screen } from "@testing-library/react";
import { Notice } from "./notice";

it("오류와 안내의 역할이 다르다", () => {
  render(
    <>
      <Notice tone="error">실패</Notice>
      <Notice>완료</Notice>
    </>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("실패");
  expect(screen.getByRole("status")).toHaveTextContent("완료");
});
