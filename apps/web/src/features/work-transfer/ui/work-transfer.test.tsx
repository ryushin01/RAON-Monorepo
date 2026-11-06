import { TextDecoder as NodeDecoder, TextEncoder as NodeEncoder } from "node:util";
import { docFromText } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { downloadText } from "@/shared/lib";
import { fetchWorkExport, importEpisode } from "../api/actions";
import { WorkTransfer } from "./work-transfer";

globalThis.TextDecoder = NodeDecoder as typeof TextDecoder;

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("../api/actions", () => ({ fetchWorkExport: jest.fn(), importEpisode: jest.fn() }));
jest.mock("@/shared/lib", () => ({ ...jest.requireActual("@/shared/lib"), downloadText: jest.fn() }));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const episode = (number: number, status: string) => ({
  number,
  title: `제목${number}`,
  status,
  content: docFromText(`본문${number}`),
  authorNote: null,
});
const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkTransfer workId="w1" />
    </QueryClientProvider>,
  );
const file = (name: string, text: string) => {
  const result = new File([text], name);
  // jsdom의 File에는 arrayBuffer가 없다.
  result.arrayBuffer = async () => new NodeEncoder().encode(text).buffer as ArrayBuffer;
  return result;
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchWorkExport as jest.Mock).mockResolvedValue(
    ok({ title: "작품", episodes: [episode(1, "PUBLISHED"), episode(2, "DRAFT")] }),
  );
});

it("고른 형식으로 초안까지 내보내고 수를 알린다", async () => {
  setup();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "형식" }), "md");
  await userEvent.click(screen.getByRole("button", { name: "작품 내보내기" }));
  expect(await screen.findByRole("status")).toHaveTextContent("2개 회차를 내보냈습니다.");
  expect(downloadText).toHaveBeenCalledWith("작품.md", expect.stringContaining("제목2"), "text/markdown");
});

it("초안을 빼면 공개 회차만 내보내고, 없으면 알린다", async () => {
  setup();
  await userEvent.click(screen.getByRole("checkbox", { name: "초안 포함" }));
  await userEvent.click(screen.getByRole("button", { name: "작품 내보내기" }));
  await waitFor(() => expect(downloadText).toHaveBeenCalled());
  expect((downloadText as jest.Mock).mock.calls[0]?.[1]).not.toContain("제목2");

  (downloadText as jest.Mock).mockClear();
  (fetchWorkExport as jest.Mock).mockResolvedValue(ok({ title: "작품", episodes: [episode(1, "DRAFT")] }));
  await userEvent.click(screen.getByRole("button", { name: "작품 내보내기" }));
  expect(await screen.findByText("내보낼 회차가 없습니다.")).toBeInTheDocument();
  expect(downloadText).not.toHaveBeenCalled();
});

it("파일을 고르지 않으면 칸에 알리고 초점을 옮긴다", async () => {
  setup();
  await userEvent.click(screen.getByRole("button", { name: "새 회차로 가져오기" }));
  const input = screen.getByLabelText("가져올 파일");
  expect(input).toHaveFocus();
  expect(input).toHaveAccessibleDescription(/가져올 파일을 골라 주세요/);
  expect(importEpisode).not.toHaveBeenCalled();
});

it("파일을 새 초안으로 만들고 에디터로 간다", async () => {
  (importEpisode as jest.Mock).mockResolvedValue(ok({ id: "e9" }));
  setup();
  await userEvent.upload(screen.getByLabelText("가져올 파일"), file("첫 이야기.txt", "본문"));
  await userEvent.click(screen.getByRole("button", { name: "새 회차로 가져오기" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/studio/works/w1/episodes/e9"));
  expect(importEpisode).toHaveBeenCalledWith(
    "w1",
    expect.objectContaining({ title: "첫 이야기", content: docFromText("본문"), isFree: false }),
  );
});

it("가져오지 못하면 이유를 칸에 알리고 초점을 옮긴다", async () => {
  (importEpisode as jest.Mock).mockResolvedValue({ ok: false, message: "저장하지 못했습니다." });
  setup();
  const input = screen.getByLabelText("가져올 파일");
  await userEvent.upload(input, file("첫 이야기.txt", "본문"));
  await userEvent.click(screen.getByRole("button", { name: "새 회차로 가져오기" }));
  await waitFor(() => expect(input).toHaveAccessibleDescription(/저장하지 못했습니다/));
  expect(input).toHaveFocus();
  expect(push).not.toHaveBeenCalled();
});
