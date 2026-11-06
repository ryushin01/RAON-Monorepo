import type { WorkNote } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { deleteNote, listNotes, saveNote, searchWork } from "../api/actions";
import { EpisodeMemo } from "./episode-memo";
import { NoteReference } from "./note-reference";
import { NotesManager, parseAliases } from "./notes-manager";

jest.mock("../api/actions", () => ({
  listNotes: jest.fn(),
  saveNote: jest.fn(),
  deleteNote: jest.fn(),
  searchWork: jest.fn(),
}));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const setting: WorkNote = {
  id: "n1",
  workId: "w1",
  episodeId: null,
  kind: "SETTING",
  category: "인물",
  title: "이안",
  aliases: ["등대지기"],
  body: "소금 사막의 등대지기.",
  updatedAt: "2026-11-05T00:00:00.000Z",
};
const memo: WorkNote = { ...setting, id: "n2", kind: "MEMO", category: "", title: "떡밥", aliases: [], body: "복선" };
const episodeMemo: WorkNote = { ...memo, id: "n3", title: "회차 메모", episodeId: "e1", body: "옛 메모" };

const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {node}
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.resetAllMocks();
  (listNotes as jest.Mock).mockResolvedValue(ok([setting, memo, episodeMemo]));
});
afterEach(() => jest.restoreAllMocks());

it("다른 이름을 쉼표로 나누고 빈 값을 뺀다", () => {
  expect(parseAliases(" 가, ,나 ,")).toEqual(["가", "나"]);
});

describe("NotesManager", () => {
  it("분류별로 묶고 회차 메모에는 몇 화인지 보여 주며, 종류로 거른다", async () => {
    wrap(<NotesManager workId="w1" episodeNumbers={{ e1: 3 }} />);
    const people = await screen.findByRole("region", { name: "인물" });
    expect(within(people).getByRole("heading", { name: "이안" })).toBeInTheDocument();
    expect(within(people).getByText("다른 이름: 등대지기")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3화 메모" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "메모" }));
    expect(screen.getByRole("button", { name: "✓ 메모" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { name: "이안" })).not.toBeInTheDocument();
  });

  it("만들면 값을 보내고 목록 제목으로 초점을 옮기며 알린다", async () => {
    (saveNote as jest.Mock).mockResolvedValue(ok({ ...setting, title: "새 인물" }));
    wrap(<NotesManager workId="w1" />);
    await screen.findByRole("heading", { name: "이안" });
    await userEvent.click(screen.getByRole("button", { name: "새 문서" }));
    const title = screen.getByRole("textbox", { name: /제목/ });
    expect(title).toHaveFocus();
    await userEvent.type(title, "새 인물");
    await userEvent.type(screen.getByRole("textbox", { name: /다른 이름/ }), "가, 나");
    await userEvent.click(screen.getByRole("button", { name: "문서 저장" }));
    await waitFor(() =>
      expect(saveNote).toHaveBeenCalledWith(
        "w1",
        null,
        expect.objectContaining({ title: "새 인물", aliases: ["가", "나"] }),
      ),
    );
    expect(await screen.findByText("‘새 인물’ 문서를 저장했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "문서 목록" })).toHaveFocus();
  });

  it("입력 오류는 칸에 연결해 알리고 그 칸으로 초점을 옮기며, 입력을 유지한다", async () => {
    (saveNote as jest.Mock).mockResolvedValue({
      ok: false,
      message: "오류",
      fieldErrors: { title: "제목을 입력해 주세요." },
    });
    wrap(<NotesManager workId="w1" />);
    await screen.findByRole("heading", { name: "이안" });
    await userEvent.click(screen.getByRole("button", { name: "새 문서" }));
    await userEvent.type(screen.getByRole("textbox", { name: "내용" }), "남길 내용");
    await userEvent.click(screen.getByRole("button", { name: "문서 저장" }));
    const title = await screen.findByRole("textbox", { name: /제목/ });
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveAccessibleDescription("제목을 입력해 주세요.");
    expect(screen.getByRole("textbox", { name: "내용" })).toHaveValue("남길 내용");
  });

  it("회차 메모를 고쳐도 회차 연결을 유지한다", async () => {
    (saveNote as jest.Mock).mockResolvedValue(ok(episodeMemo));
    wrap(<NotesManager workId="w1" />);
    await userEvent.click(await screen.findByRole("button", { name: "고치기: 회차 메모" }));
    expect(screen.queryByRole("combobox", { name: "종류" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "문서 저장" }));
    await waitFor(() =>
      expect(saveNote).toHaveBeenCalledWith("w1", "n3", expect.objectContaining({ kind: "MEMO", episodeId: "e1" })),
    );
  });

  it("지우기는 확인을 받고 초점을 옮기며, 취소하면 지우지 않는다", async () => {
    (deleteNote as jest.Mock).mockResolvedValue(ok(null));
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    wrap(<NotesManager workId="w1" />);
    await userEvent.click(await screen.findByRole("button", { name: "삭제: 이안" }));
    expect(deleteNote).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "삭제: 이안" }));
    expect(await screen.findByText("‘이안’ 문서를 지웠습니다.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "문서 목록" })).toHaveFocus();
  });

  it("검색 결과에서 회차로 가고 문서를 열며, 빈 검색어는 칸에 알린다", async () => {
    (searchWork as jest.Mock).mockResolvedValue(
      ok({
        episodes: [{ id: "e1", number: 2, title: "소금", matches: 2, snippet: "…등대…" }],
        notes: [{ id: "n1", kind: "SETTING", title: "이안", matches: 1, snippet: "등대지기" }],
      }),
    );
    wrap(<NotesManager workId="w1" />);
    await screen.findByRole("heading", { name: "이안" });
    const input = screen.getByRole("searchbox", { name: /작품 전체 검색/ });
    await userEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(input).toHaveAccessibleDescription("검색어를 입력해 주세요.");
    expect(searchWork).not.toHaveBeenCalled();

    await userEvent.type(input, "등대");
    await userEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(await screen.findByText("2건 찾았습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2화. 소금" })).toHaveAttribute("href", "/studio/works/w1/episodes/e1");
    await userEvent.click(screen.getByRole("button", { name: "검색 결과 열기: 이안" }));
    expect(screen.getByRole("textbox", { name: /제목/ })).toHaveValue("이안");
  });

  it("목록을 읽지 못하면 이유를 보여 준다", async () => {
    (listNotes as jest.Mock).mockResolvedValue({ ok: false, message: "권한이 없습니다." });
    wrap(<NotesManager workId="w1" />);
    expect(await screen.findByText("권한이 없습니다.")).toBeInTheDocument();
  });
});

describe("NoteReference", () => {
  it("설정만 보여 주고 다른 이름과 본문으로도 찾는다", async () => {
    wrap(<NoteReference workId="w1" />);
    expect(await screen.findByRole("heading", { name: /이안/ })).toBeInTheDocument();
    expect(screen.queryByText("복선")).not.toBeInTheDocument();
    const input = screen.getByRole("searchbox", { name: "설정 찾기" });
    await userEvent.type(input, "등대지기");
    expect(screen.getByRole("heading", { name: /이안/ })).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "없는 이름");
    expect(screen.getByText("찾은 설정이 없습니다.")).toBeInTheDocument();
  });

  it("문서가 없으면 알린다", async () => {
    (listNotes as jest.Mock).mockResolvedValue(ok([]));
    wrap(<NoteReference workId="w1" />);
    expect(await screen.findByText("아직 설정 문서가 없습니다.")).toBeInTheDocument();
  });
});

describe("EpisodeMemo", () => {
  it("이 회차의 메모를 보여 주고 고쳐 저장한다", async () => {
    (saveNote as jest.Mock).mockResolvedValue(ok(episodeMemo));
    wrap(<EpisodeMemo workId="w1" episodeId="e1" />);
    const input = await screen.findByDisplayValue("옛 메모");
    await userEvent.clear(input);
    await userEvent.type(input, "새 메모");
    await userEvent.click(screen.getByRole("button", { name: "메모 저장" }));
    await waitFor(() =>
      expect(saveNote).toHaveBeenCalledWith("w1", "n3", expect.objectContaining({ body: "새 메모", episodeId: "e1" })),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("메모를 저장했습니다.");
  });

  it("메모가 없으면 새로 만든다", async () => {
    (saveNote as jest.Mock).mockResolvedValue(ok(episodeMemo));
    wrap(<EpisodeMemo workId="w1" episodeId="e2" />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "이 회차의 메모" })).toBeEnabled());
    await userEvent.type(screen.getByRole("textbox", { name: "이 회차의 메모" }), "첫 메모");
    await userEvent.click(screen.getByRole("button", { name: "메모 저장" }));
    await waitFor(() =>
      expect(saveNote).toHaveBeenCalledWith("w1", null, expect.objectContaining({ kind: "MEMO", episodeId: "e2" })),
    );
  });

  it("목록을 읽지 못하면 쓰거나 저장할 수 없다", async () => {
    (listNotes as jest.Mock).mockResolvedValue({ ok: false, message: "읽지 못했습니다." });
    wrap(<EpisodeMemo workId="w1" episodeId="e1" />);
    expect(await screen.findByText("읽지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "이 회차의 메모" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "메모 저장" }));
    expect(saveNote).not.toHaveBeenCalled();
  });

  it("저장하지 못하면 입력을 남기고 이유를 보여 준다", async () => {
    (saveNote as jest.Mock).mockResolvedValue({ ok: false, message: "저장하지 못했습니다." });
    wrap(<EpisodeMemo workId="w1" episodeId="e1" />);
    const input = await screen.findByDisplayValue("옛 메모");
    await userEvent.type(input, " 더");
    await userEvent.click(screen.getByRole("button", { name: "메모 저장" }));
    expect(await screen.findByText("저장하지 못했습니다.")).toBeInTheDocument();
    expect(input).toHaveValue("옛 메모 더");
  });
});
