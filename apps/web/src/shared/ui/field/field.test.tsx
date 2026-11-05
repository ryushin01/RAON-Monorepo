import { render, screen } from "@testing-library/react";
import { TextField } from "./field";

describe("TextField", () => {
  it("레이블로 찾을 수 있다", () => {
    render(<TextField label="이메일" name="email" />);
    expect(screen.getByLabelText("이메일")).toHaveAttribute("name", "email");
  });

  it("오류를 입력 칸과 연결한다", () => {
    render(<TextField label="이메일" error="형식을 확인해 주세요." hint="예: a@b.c" />);
    const input = screen.getByLabelText("이메일");
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("형식을 확인해 주세요. 예: a@b.c");
  });
});
