import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createDraft, moveEpisode, purgeEpisode, restoreFromTrash, trashDraft } from "../api/actions";
import {
  MoveEpisodeButtons,
  NewEpisodeButton,
  PurgeTrashedButton,
  RestoreTrashedButton,
  TrashDraftButton,
} from "./episode-buttons";

const push = jest.fn();
jest.mock("../api/actions", () => ({
  createDraft: jest.fn(),
  moveEpisode: jest.fn(),
  purgeEpisode: jest.fn(),
  restoreFromTrash: jest.fn(),
  trashDraft: jest.fn(),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: jest.fn() }) }));

const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

it("새 회차는 매번 새 초안을 만들어 그 편집 화면으로 간다", async () => {
  (createDraft as jest.Mock).mockResolvedValue({ ok: true, data: { id: "e7" } });
  wrap(<NewEpisodeButton workId="w1" />);
  await userEvent.click(screen.getByRole("button", { name: "새 회차 쓰기" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/studio/works/w1/episodes/e7"));
});

it("초안은 묻지 않고 휴지통으로 옮기고, 처리 중에는 다시 보내지 않으며 초점을 잃지 않는다", async () => {
  let finish = (_: unknown) => {};
  (trashDraft as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const confirm = jest.spyOn(window, "confirm");
  wrap(<TrashDraftButton workId="w1" episodeId="e1" label="3화" />);
  const button = screen.getByRole("button", { name: "휴지통으로: 3화" });

  await userEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
  await userEvent.click(button);
  expect(trashDraft).toHaveBeenCalledTimes(1);
  expect(trashDraft).toHaveBeenCalledWith("w1", "e1");
  expect(button).toHaveFocus();
  expect(confirm).not.toHaveBeenCalled();
  finish({ ok: true, data: null });
});

it("휴지통에서 복원하고, 실패하면 이유를 알린다", async () => {
  (restoreFromTrash as jest.Mock).mockResolvedValue({ ok: false, message: "복원하지 못했습니다." });
  wrap(<RestoreTrashedButton workId="w1" episodeId="e1" label="3화" />);
  await userEvent.click(screen.getByRole("button", { name: "복원: 3화" }));
  expect(await screen.findByText("복원하지 못했습니다.")).toBeInTheDocument();
  expect(restoreFromTrash).toHaveBeenCalledWith("w1", "e1");
});

it("완전히 지우기는 확인을 받은 뒤에만 한다", async () => {
  (purgeEpisode as jest.Mock).mockResolvedValue({ ok: true, data: null });
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  wrap(<PurgeTrashedButton workId="w1" episodeId="e1" label="3화" />);
  const button = screen.getByRole("button", { name: "완전히 지우기: 3화" });

  await userEvent.click(button);
  expect(purgeEpisode).not.toHaveBeenCalled();

  confirm.mockReturnValue(true);
  await userEvent.click(button);
  await waitFor(() => expect(purgeEpisode).toHaveBeenCalledWith("w1", "e1"));
});

it("회차를 버튼으로 옮기고, 끝에서는 그쪽 버튼을 막는다", async () => {
  (moveEpisode as jest.Mock).mockResolvedValue({ ok: true, data: null });
  wrap(<MoveEpisodeButtons workId="w1" episodeId="e1" label="1화" canMoveUp={false} canMoveDown />);
  // disabled면 키보드 초점을 잃으므로 aria-disabled로 표시하고 눌러도 보내지 않는다.
  const up = screen.getByRole("button", { name: "위로: 1화" });
  expect(up).toHaveAttribute("aria-disabled", "true");
  await userEvent.click(up);
  expect(moveEpisode).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "아래로: 1화" }));
  await waitFor(() => expect(moveEpisode).toHaveBeenCalledWith("w1", "e1", "down"));
});
