import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { SignupForm } from "./signup-form";

jest.mock("../api/actions", () => ({ signup: jest.fn() }));

it("필수 입력과 안내, 자동 완성을 제공한다", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SignupForm />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("radio", { name: "작가" })).toBeInTheDocument();
  expect(screen.getByLabelText(/비밀번호/)).toHaveAccessibleDescription("8자 이상으로 입력해 주세요.");
  expect(screen.getByLabelText(/닉네임/)).toHaveAttribute("autocomplete", "nickname");
  expect(screen.getByLabelText(/이메일/)).toBeRequired();
});
