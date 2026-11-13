import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListActionButton } from "./list-action-button";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <section>
        <h2 tabIndex={-1}>휴지통</h2>
        {node}
      </section>
    </QueryClientProvider>,
  );

it("isPending이 바뀌기 전에 연달아 눌러도 한 번만 보낸다", async () => {
  const action = jest.fn(() => new Promise<{ ok: true }>(() => {}));
  wrap(<ListActionButton action={action} text="복원" target="3화" />);
  const button = screen.getByRole("button", { name: "복원: 3화" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(action).toHaveBeenCalledTimes(1);
});

it("성공하면 영역 제목으로 초점을 옮긴 뒤 목록을 새로 받는다", async () => {
  const action = jest.fn().mockResolvedValue({ ok: true });
  wrap(<ListActionButton action={action} text="복원" target="3화" />);
  await userEvent.click(screen.getByRole("button", { name: "복원: 3화" }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(screen.getByRole("heading", { name: "휴지통" })).toHaveFocus();
});

it("묻는 말에 취소하면 보내지 않고, 실패하면 이유를 알린 뒤 다시 누를 수 있다", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
  const action = jest.fn().mockResolvedValue({ ok: false, message: "지우지 못했습니다." });
  wrap(<ListActionButton action={action} text="완전히 지우기" target="3화" confirmMessage="지울까요?" />);
  const button = screen.getByRole("button", { name: "완전히 지우기: 3화" });

  await userEvent.click(button);
  expect(action).not.toHaveBeenCalled();

  await userEvent.click(button);
  expect(await screen.findByText("지우지 못했습니다.")).toBeInTheDocument();
  await userEvent.click(button);
  await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  confirm.mockRestore();
});
