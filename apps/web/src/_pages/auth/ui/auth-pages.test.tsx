import { render, screen } from "@testing-library/react";
import { SignupPage } from "./auth-pages";

// 폼 자체는 인증 슬라이스의 테스트가 검사한다.
jest.mock("@/features/auth", () => ({ SignupForm: () => <form aria-label="회원가입 폼" />, LoginForm: () => null }));

it("회원가입 화면에 제목, 본문 영역, 로그인 링크가 있다", () => {
  render(<SignupPage />);
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "회원가입" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
});
