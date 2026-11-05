import type { StudioWork } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { uploadCover } from "../api/actions";
import { CoverUpload } from "./cover-upload";

jest.mock("../api/actions", () => ({ uploadCover: jest.fn(), deleteCover: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const work = { id: "w1", title: "작품", coverUpdatedAt: null } as StudioWork;
const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CoverUpload work={work} />
    </QueryClientProvider>,
  );
const user = () => userEvent.setup({ applyAccept: false });

beforeEach(() => (uploadCover as jest.Mock).mockReset().mockResolvedValue({ ok: true, data: {} }));

it("파일을 고르는 것만으로는 올리지 않고 버튼을 눌러야 올린다", async () => {
  setup();
  const u = user();
  await u.upload(screen.getByLabelText("표지 이미지"), new File(["x"], "a.png", { type: "image/png" }));
  expect(uploadCover).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "표지 올리기" }));
  await waitFor(() => expect(uploadCover).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole("status")).toHaveTextContent("표지를 올렸습니다.");
});

it.each([
  ["이미지가 아닌 파일", new File(["x"], "a.svg", { type: "image/svg+xml" }), "JPG, PNG, WebP"],
  ["너무 큰 파일", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "a.png", { type: "image/png" }), "2MB 이하"],
])("%s은 보내지 않고 이유를 칸에 연결한다", async (_, file, message) => {
  setup();
  const u = user();
  const input = screen.getByLabelText("표지 이미지");
  await u.upload(input, file);
  await u.click(screen.getByRole("button", { name: "표지 올리기" }));
  await waitFor(() => expect(input).toBeInvalid());
  expect(input).toHaveAccessibleDescription(expect.stringContaining(message));
  expect(input).toHaveFocus();
  expect(uploadCover).not.toHaveBeenCalled();
});
