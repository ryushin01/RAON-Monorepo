import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorPage } from "./error-page";
import { NotFoundPage } from "./not-found-page";

it("없는 페이지는 제목과 이동할 곳을 알려 준다", () => {
  render(<NotFoundPage />);
  expect(screen.getByRole("heading", { level: 1, name: "페이지를 찾을 수 없습니다" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "작품 둘러보기" })).toHaveAttribute("href", "/works");
});

it("오류 화면은 알리고 다시 시도할 수 있다", async () => {
  const reset = jest.fn();
  render(<ErrorPage reset={reset} />);
  expect(screen.getByRole("alert")).toHaveTextContent("내용을 불러오지 못했습니다");
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(reset).toHaveBeenCalledTimes(1);
});
