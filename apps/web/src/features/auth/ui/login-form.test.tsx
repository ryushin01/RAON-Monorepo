import { render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

jest.mock("../api/actions", () => ({ login: jest.fn() }));

describe("LoginForm", () => {
  it("일반 회원과 작가를 고를 수 있고 일반 회원이 기본이다", () => {
    render(<LoginForm />);
    expect(screen.getByRole("group", { name: "회원 유형" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "일반 회원" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "작가" })).not.toBeChecked();
  });

  it("입력 칸에 레이블과 자동 완성이 있다", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("이메일")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("autocomplete", "current-password");
  });
});
