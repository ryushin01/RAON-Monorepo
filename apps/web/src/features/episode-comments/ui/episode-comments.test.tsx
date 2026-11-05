import type { EpisodeComment } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addComment, deleteComment } from "../api/actions";
import { EpisodeComments } from "./episode-comments";

jest.mock("../api/actions", () => ({ addComment: jest.fn(), deleteComment: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const comment: EpisodeComment = {
  id: "c1",
  authorName: "책벌레",
  body: "<b>재미있어요</b>",
  createdAt: "2026-11-05T00:00:00.000Z",
  canDelete: true,
};

const setup = (comments: EpisodeComment[], loggedIn = true) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EpisodeComments episodeId="e1" path="/works/w/episodes/1" comments={comments} loggedIn={loggedIn} />
    </QueryClientProvider>,
  );

beforeEach(() => jest.clearAllMocks());

it("쓴 내용을 mutate로 넘기고 입력 칸을 비운다", async () => {
  (addComment as jest.Mock).mockResolvedValue({ ok: true, data: null });
  setup([]);
  const box = screen.getByRole("textbox", { name: /댓글 쓰기/ });
  await userEvent.type(box, "좋아요");
  await userEvent.click(screen.getByRole("button", { name: "등록" }));
  await waitFor(() => expect(addComment).toHaveBeenCalledWith("e1", "좋아요", "/works/w/episodes/1"));
  await waitFor(() => expect(box).toHaveValue(""));
});

it("오류를 입력 칸과 연결한다", async () => {
  (addComment as jest.Mock).mockResolvedValue({ ok: false, message: "댓글 내용을 입력해 주세요." });
  setup([]);
  await userEvent.click(screen.getByRole("button", { name: "등록" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: /댓글 쓰기/ })).toBeInvalid());
});

it("댓글 내용을 HTML로 실행하지 않고, 삭제 버튼 이름이 구분된다", async () => {
  (deleteComment as jest.Mock).mockResolvedValue({ ok: true, data: null });
  setup([comment]);
  expect(screen.getByText("<b>재미있어요</b>")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "삭제: 책벌레의 댓글" }));
  await waitFor(() => expect(deleteComment).toHaveBeenCalledWith("c1", "/works/w/episodes/1"));
  await waitFor(() => expect(screen.getByRole("list")).toHaveFocus());
});

it("비회원에게는 로그인 링크를 보여 준다", () => {
  setup([], false);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute(
    "href",
    "/login?next=%2Fworks%2Fw%2Fepisodes%2F1",
  );
});
