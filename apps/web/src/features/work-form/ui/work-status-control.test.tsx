import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { deleteWork, setWorkStatus } from "../api/actions";
import { DeleteWorkButton } from "./delete-work-button";
import { WorkStatusControl } from "./work-status-control";

jest.mock("../api/actions", () => ({ deleteWork: jest.fn(), setWorkStatus: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

it("연재 중인 작품을 완결로 바꾼다", async () => {
  (setWorkStatus as jest.Mock).mockResolvedValue({ ok: true, data: {} });
  wrap(<WorkStatusControl workId="w1" status="ONGOING" />);
  await userEvent.click(screen.getByRole("button", { name: "완결로 바꾸기" }));
  await waitFor(() => expect(setWorkStatus).toHaveBeenCalledWith("w1", "COMPLETED"));
});

it("공개 전 작품은 안내만 보여 준다", () => {
  wrap(<WorkStatusControl workId="w1" status="DRAFT" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("판매 기록이 있어 지우지 못하면 이유를 알려 준다", async () => {
  (deleteWork as jest.Mock).mockResolvedValue({ ok: false, message: "판매 기록이 있는 작품은 지울 수 없습니다." });
  jest.spyOn(window, "confirm").mockReturnValue(true);
  wrap(<DeleteWorkButton workId="w1" title="작품" />);
  await userEvent.click(screen.getByRole("button", { name: "작품 삭제" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("판매 기록");
});
