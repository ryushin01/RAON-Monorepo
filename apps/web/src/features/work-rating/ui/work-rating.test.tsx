import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setRating } from "../api/actions";
import { WorkRating } from "./work-rating";

jest.mock("../api/actions", () => ({ setRating: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const setup = (myRating: number | null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkRating workId="w1" myRating={myRating} />
    </QueryClientProvider>,
  );

beforeEach(() => (setRating as jest.Mock).mockReset().mockResolvedValue({ ok: true, data: null }));

it("고른 점수를 보내고 현재 점수를 aria-pressed로 알려 준다", async () => {
  setup(3);
  expect(screen.getByRole("group", { name: "내 별점" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "3점" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "5점" }));
  await waitFor(() => expect(setRating).toHaveBeenCalledWith("w1", 5));
});

it("같은 점수를 다시 누르면 지운다", async () => {
  setup(3);
  await userEvent.click(screen.getByRole("button", { name: "3점" }));
  await waitFor(() => expect(setRating).toHaveBeenCalledWith("w1", null));
});

it("저장 중에도 키보드 초점을 잃지 않고, 다시 눌러도 한 번만 보낸다", async () => {
  (setRating as jest.Mock).mockReturnValue(new Promise(() => {}));
  setup(null);
  const button = screen.getByRole("button", { name: "3점" });
  button.focus();
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
  expect(button).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  expect(setRating).toHaveBeenCalledTimes(1);
});
