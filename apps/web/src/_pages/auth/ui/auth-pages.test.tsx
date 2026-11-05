import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { SignupPage } from "./auth-pages";

jest.mock("@/features/auth", () => {
  const actual = jest.requireActual("@/features/auth/ui/signup-form");
  return { SignupForm: actual.SignupForm, LoginForm: () => null };
});
jest.mock("@/features/auth/api/actions", () => ({ signup: jest.fn(), login: jest.fn() }));

it("회원가입 화면에 제목, 본문 영역, 로그인 링크가 있다", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SignupPage />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "회원가입" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
});
