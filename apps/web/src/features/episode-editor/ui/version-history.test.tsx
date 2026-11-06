import { docFromText, type EpisodeVersionSummary } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createVersion, deleteVersion, getVersion, listVersions, restoreVersion } from "../api/actions";
import { VersionHistory } from "./version-history";

jest.mock("../api/actions", () => ({
  listVersions: jest.fn(),
  getVersion: jest.fn(),
  createVersion: jest.fn(),
  restoreVersion: jest.fn(),
  deleteVersion: jest.fn(),
}));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const manual: EpisodeVersionSummary = {
  id: "v1",
  kind: "MANUAL",
  label: "초고",
  title: "제목",
  charCount: 1200,
  createdAt: "2026-11-05T00:00:00.000Z",
};
const auto: EpisodeVersionSummary = { ...manual, id: "v2", kind: "AUTO", label: null };

const setup = (props: Partial<React.ComponentProps<typeof VersionHistory>> = {}) => {
  const saveFirst = jest.fn().mockResolvedValue(true);
  const onRestored = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <VersionHistory
        episodeId="e1"
        isPublic={false}
        getDoc={() => docFromText("같은 단락\n\n새 단락")}
        saveFirst={saveFirst}
        onRestored={onRestored}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { saveFirst, onRestored };
};

beforeEach(() => {
  jest.resetAllMocks();
  (listVersions as jest.Mock).mockResolvedValue(ok([manual, auto]));
});
afterEach(() => jest.restoreAllMocks());

it("이름과 시각, 글자 수를 보여 주고 이름 없는 자동 버전을 구분한다", async () => {
  setup();
  expect(await screen.findByText("초고")).toBeInTheDocument();
  expect(screen.getByText("자동 저장")).toBeInTheDocument();
  expect(screen.getAllByText(/1,200자/)).toHaveLength(2);
});

it("버전이 없으면 언제 생기는지 알려 준다", async () => {
  (listVersions as jest.Mock).mockResolvedValue(ok([]));
  setup();
  expect(await screen.findByText(/본문을 고쳐 저장하면 자동으로 남습니다/)).toBeInTheDocument();
});

it("저장한 뒤 버전을 남기고, 저장에 실패하면 남기지 않는다", async () => {
  (createVersion as jest.Mock).mockResolvedValue(ok(manual));
  const { saveFirst } = setup();
  await screen.findByText("초고");
  await userEvent.type(screen.getByRole("textbox", { name: "버전 이름" }), " 초고 ");
  await userEvent.click(screen.getByRole("button", { name: "지금 버전 남기기" }));
  await waitFor(() => expect(createVersion).toHaveBeenCalledWith("e1", "초고"));
  expect(saveFirst).toHaveBeenCalled();
  expect(await screen.findByRole("status")).toHaveTextContent("‘초고’ 버전을 남겼습니다.");

  (createVersion as jest.Mock).mockClear();
  saveFirst.mockResolvedValue(false);
  await userEvent.click(screen.getByRole("button", { name: "지금 버전 남기기" }));
  expect(await screen.findByText("저장하지 못해 버전을 남기지 않았습니다.")).toBeInTheDocument();
  expect(createVersion).not.toHaveBeenCalled();
});

it("비교하면 추가와 삭제를 글자로도 구분한다", async () => {
  (getVersion as jest.Mock).mockResolvedValue(ok({ ...manual, content: docFromText("같은 단락\n\n옛 단락") }));
  setup();
  await userEvent.click(await screen.findByRole("button", { name: "비교: 초고" }));
  const region = await screen.findByRole("region", { name: /초고 버전과 지금 본문 비교/ });
  expect(region.querySelector("ins")).toHaveTextContent("추가: 새 단락");
  expect(region.querySelector("del")).toHaveTextContent("삭제: 옛 단락");
});

it("같으면 같다고 알린다", async () => {
  (getVersion as jest.Mock).mockResolvedValue(ok({ ...manual, content: docFromText("같은 단락\n\n새 단락") }));
  setup();
  await userEvent.click(await screen.findByRole("button", { name: "비교: 초고" }));
  expect(await screen.findByText("지금 본문과 같습니다.")).toBeInTheDocument();
});

it("확인하면 저장한 뒤 복원하고, 공개 회차는 독자에게 보인다고 알린다", async () => {
  const restored = { id: "e1" };
  (restoreVersion as jest.Mock).mockResolvedValue(ok(restored));
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  const { saveFirst, onRestored } = setup({ isPublic: true });
  await userEvent.click(await screen.findByRole("button", { name: "복원: 초고" }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("독자에게 바로 보입니다"));
  await waitFor(() => expect(onRestored).toHaveBeenCalledWith(restored));
  expect(saveFirst).toHaveBeenCalled();
  expect(restoreVersion).toHaveBeenCalledWith("e1", "v1");
});

it("취소하면 복원도 삭제도 하지 않는다", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(false);
  const { saveFirst } = setup();
  await userEvent.click(await screen.findByRole("button", { name: "복원: 초고" }));
  await userEvent.click(screen.getByRole("button", { name: "삭제: 초고" }));
  expect(saveFirst).not.toHaveBeenCalled();
  expect(restoreVersion).not.toHaveBeenCalled();
  expect(deleteVersion).not.toHaveBeenCalled();
});

it("복원 전에 저장하지 못하면 되돌리지 않고 오류를 보여 준다", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  const { saveFirst, onRestored } = setup();
  saveFirst.mockResolvedValue(false);
  await userEvent.click(await screen.findByRole("button", { name: "복원: 초고" }));
  expect(await screen.findByText("저장하지 못해 되돌리지 않았습니다.")).toBeInTheDocument();
  expect(restoreVersion).not.toHaveBeenCalled();
  expect(onRestored).not.toHaveBeenCalled();
});

it("지우면 알리고, 불러오지 못하면 이유를 보여 준다", async () => {
  (deleteVersion as jest.Mock).mockResolvedValue(ok(null));
  jest.spyOn(window, "confirm").mockReturnValue(true);
  setup();
  await userEvent.click(await screen.findByRole("button", { name: "삭제: 초고" }));
  await waitFor(() => expect(deleteVersion).toHaveBeenCalledWith("e1", "v1"));
  expect(await screen.findByRole("status")).toHaveTextContent("‘초고’ 버전을 지웠습니다.");
});

it("목록을 읽지 못하면 이유를 보여 준다", async () => {
  (listVersions as jest.Mock).mockResolvedValue({ ok: false, message: "권한이 없습니다." });
  setup();
  expect(await screen.findByText("권한이 없습니다.")).toBeInTheDocument();
});
