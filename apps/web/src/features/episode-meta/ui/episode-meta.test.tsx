import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { saveEpisodeMeta } from "../api/actions";
import { EpisodeMeta } from "./episode-meta";

jest.mock("../api/actions", () => ({ saveEpisodeMeta: jest.fn() }));

const episode = { id: "e1", episodeType: "REGULAR" as const, pointOfView: "" };
const wrap = (node: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

beforeEach(() => jest.resetAllMocks());

it("고른 유형과 시점을 저장하고 알린다", async () => {
  (saveEpisodeMeta as jest.Mock).mockResolvedValue({ ok: true, data: {} });
  wrap(<EpisodeMeta episode={episode} />);
  await userEvent.selectOptions(screen.getByLabelText("회차 유형"), "SIDE");
  await userEvent.type(screen.getByRole("textbox", { name: "시점" }), "이안");
  await userEvent.click(screen.getByRole("button", { name: "회차 정보 저장" }));
  await waitFor(() => expect(saveEpisodeMeta).toHaveBeenCalledWith("e1", { episodeType: "SIDE", pointOfView: "이안" }));
  expect(await screen.findByText("회차 정보를 저장했습니다.")).toBeInTheDocument();
});

it("시점 오류를 칸에 연결한다", async () => {
  (saveEpisodeMeta as jest.Mock).mockResolvedValue({
    ok: false,
    message: "입력을 확인해 주세요.",
    fieldErrors: { pointOfView: "시점은 30자 이하로 입력해 주세요." },
  });
  wrap(<EpisodeMeta episode={episode} />);
  await userEvent.click(screen.getByRole("button", { name: "회차 정보 저장" }));
  const field = screen.getByRole("textbox", { name: "시점" });
  await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
  expect(field).toHaveAccessibleDescription(expect.stringContaining("30자"));
});

it("웹툰에서는 시점 칸을 두지 않고, 실패를 알린다", async () => {
  (saveEpisodeMeta as jest.Mock).mockResolvedValue({ ok: false, message: "저장하지 못했습니다." });
  wrap(<EpisodeMeta episode={episode} showPointOfView={false} />);
  expect(screen.queryByRole("textbox", { name: "시점" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "회차 정보 저장" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("저장하지 못했습니다.");
});
