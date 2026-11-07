import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { purgeWork, restoreWork, setWorkStatus, trashWork } from "../api/actions";
import { DeleteWorkButton, PurgeWorkButton, RestoreWorkButton } from "./delete-work-button";
import { WorkStatusControl } from "./work-status-control";

jest.mock("../api/actions", () => ({
  purgeWork: jest.fn(),
  restoreWork: jest.fn(),
  setWorkStatus: jest.fn(),
  trashWork: jest.fn(),
}));
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
  (trashWork as jest.Mock).mockResolvedValue({ ok: false, message: "판매 기록이 있는 작품은 지울 수 없습니다." });
  jest.spyOn(window, "confirm").mockReturnValue(true);
  wrap(<DeleteWorkButton workId="w1" title="작품" />);
  await userEvent.click(screen.getByRole("button", { name: "휴지통으로 옮기기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("판매 기록");
});

it("휴지통으로 옮기기는 확인을 받은 뒤에만 한다", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(false);
  (trashWork as jest.Mock).mockClear();
  wrap(<DeleteWorkButton workId="w1" title="작품" />);
  await userEvent.click(screen.getByRole("button", { name: "휴지통으로 옮기기" }));
  expect(trashWork).not.toHaveBeenCalled();
});

it("휴지통의 작품은 묻지 않고 복원하고, 실패하면 이유를 알린다", async () => {
  (restoreWork as jest.Mock).mockResolvedValue({ ok: false, message: "복원하지 못했습니다." });
  const confirm = jest.spyOn(window, "confirm").mockClear();
  wrap(<RestoreWorkButton workId="w1" title="작품" />);
  await userEvent.click(screen.getByRole("button", { name: "복원: 작품" }));
  expect(await screen.findByText("복원하지 못했습니다.")).toBeInTheDocument();
  expect(restoreWork).toHaveBeenCalledWith("w1");
  expect(confirm).not.toHaveBeenCalled();
});

it("완전히 지우기는 확인을 받은 뒤에만 한다", async () => {
  (purgeWork as jest.Mock).mockResolvedValue({ ok: true, data: null });
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  wrap(<PurgeWorkButton workId="w1" title="작품" />);
  const button = screen.getByRole("button", { name: "완전히 지우기: 작품" });
  await userEvent.click(button);
  expect(purgeWork).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await userEvent.click(button);
  await waitFor(() => expect(purgeWork).toHaveBeenCalledWith("w1"));
});
