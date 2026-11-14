import { render, screen } from "@testing-library/react";
import { SelectField, TextField } from "./field";

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

it("필수 입력을 글자로 알려 준다", () => {
  render(<TextField label="닉네임" required />);
  expect(screen.getByRole("textbox", { name: "닉네임 (필수)" })).toBeRequired();
});

describe("SelectField", () => {
  it("레이블로 찾을 수 있고, 화살표는 보조기기에서 숨긴다", () => {
    const { container } = render(
      <SelectField label="형식" name="format" defaultValue="md">
        <option value="html">HTML</option>
        <option value="md">마크다운</option>
      </SelectField>,
    );
    expect(screen.getByRole("combobox", { name: "형식" })).toHaveDisplayValue("마크다운");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("오류를 셀렉트와 연결한다", () => {
    render(
      <SelectField label="형식" error="형식을 골라 주세요.">
        <option value="">고르세요</option>
      </SelectField>,
    );
    const select = screen.getByRole("combobox", { name: "형식" });
    expect(select).toBeInvalid();
    expect(select).toHaveAccessibleDescription("형식을 골라 주세요.");
  });
});
