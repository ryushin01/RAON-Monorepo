import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { login } from "../api/actions";
import { LoginForm } from "./login-form";

jest.mock("../api/actions", () => ({ login: jest.fn() }));

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginForm next="/cart" />
    </QueryClientProvider>,
  );

async function submit(email = "a@raon.test") {
  await userEvent.type(screen.getByLabelText(/이메일/), email);
  await userEvent.type(screen.getByLabelText(/비밀번호/), "password1");
  await userEvent.click(screen.getByRole("button", { name: "로그인" }));
}

describe("LoginForm", () => {
  it("일반 회원과 작가를 고를 수 있고 일반 회원이 기본이다", () => {
    setup();
    expect(screen.getByRole("group", { name: "회원 유형" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "일반 회원" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "작가" })).not.toBeChecked();
  });

  it("입력 칸에 레이블과 자동 완성이 있다", () => {
    setup();
    expect(screen.getByLabelText(/이메일/)).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText(/비밀번호/)).toHaveAttribute("autocomplete", "current-password");
  });

  it("JS가 붙기 전에 제출해도 비밀번호가 주소에 남지 않게 POST다. 빈 action도 없다", () => {
    const { container } = setup();
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
    expect(container.querySelector("form")).not.toHaveAttribute("action");
  });

  it("고른 유형과 돌아갈 주소를 함께 보내고, 처리 중에는 다시 누를 수 없다", async () => {
    (login as jest.Mock).mockReturnValue(new Promise(() => {}));
    setup();
    await userEvent.click(screen.getByRole("radio", { name: "작가" }));
    await submit();
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "a@raon.test",
        password: "password1",
        role: "AUTHOR",
        next: "/cart",
      }),
    );
    expect(screen.getByRole("button", { name: "로그인 중…" })).toBeDisabled();
  });

  it("실패 이유를 알려 주고, 필드 오류면 그 칸으로 초점을 옮긴다", async () => {
    (login as jest.Mock).mockReset().mockResolvedValue({ ok: false, message: "확인해 주세요." });
    const view = setup();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("확인해 주세요.");
    view.unmount();

    (login as jest.Mock).mockResolvedValue({
      ok: false,
      message: "형식 오류",
      fieldErrors: { email: "이메일 형식을 확인해 주세요." },
    });
    setup();
    await submit();
    await waitFor(() => expect(screen.getByLabelText(/이메일/)).toHaveFocus());
    expect(screen.getByLabelText(/이메일/)).toHaveAccessibleDescription("이메일 형식을 확인해 주세요.");
  });
});
