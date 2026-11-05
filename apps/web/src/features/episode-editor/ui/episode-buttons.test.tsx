import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createDraft, deleteDraft } from "../api/actions";
import { DeleteDraftButton, NewEpisodeButton } from "./episode-buttons";

const push = jest.fn();
jest.mock("../api/actions", () => ({ createDraft: jest.fn(), deleteDraft: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: jest.fn() }) }));

const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

it("새 회차는 매번 새 초안을 만들어 그 편집 화면으로 간다", async () => {
  (createDraft as jest.Mock).mockResolvedValue({ ok: true, data: { id: "e7" } });
  wrap(<NewEpisodeButton workId="w1" />);
  await userEvent.click(screen.getByRole("button", { name: "새 회차 쓰기" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/studio/works/w1/episodes/e7"));
});

it("초안 삭제는 확인을 받은 뒤에만 한다", async () => {
  (deleteDraft as jest.Mock).mockResolvedValue({ ok: true, data: null });
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  wrap(<DeleteDraftButton workId="w1" episodeId="e1" label="3화" />);
  const button = screen.getByRole("button", { name: "삭제: 3화" });

  await userEvent.click(button);
  expect(deleteDraft).not.toHaveBeenCalled();

  confirm.mockReturnValue(true);
  await userEvent.click(button);
  await waitFor(() => expect(deleteDraft).toHaveBeenCalledWith("w1", "e1"));
});
