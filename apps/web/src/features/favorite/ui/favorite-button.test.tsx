import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setFavorite } from "../api/actions";
import { FavoriteButton } from "./favorite-button";

jest.mock("../api/actions", () => ({ setFavorite: jest.fn() }));

const setup = (isFavorite: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FavoriteButton workId="w1" isFavorite={isFavorite} />
    </QueryClientProvider>,
  );

it("상태를 글자와 aria-pressed로 알려 주고 반대 값을 보낸다", async () => {
  (setFavorite as jest.Mock).mockResolvedValue({ ok: true, data: null });
  setup(false);
  const button = screen.getByRole("button", { name: "선호작 추가" });
  expect(button).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(button);
  await waitFor(() => expect(setFavorite).toHaveBeenCalledWith("w1", true));
});

it("실패하면 이유를 알려 준다", async () => {
  (setFavorite as jest.Mock).mockResolvedValue({ ok: false, message: "로그인이 필요합니다." });
  setup(true);
  await userEvent.click(screen.getByRole("button", { name: "✓ 선호작" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("로그인이 필요합니다.");
});
