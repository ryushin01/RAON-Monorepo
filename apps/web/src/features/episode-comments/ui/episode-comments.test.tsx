import type { EpisodeComment } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addComment, deleteComment, setCommentLike } from "../api/actions";
import { EpisodeComments } from "./episode-comments";

jest.mock("../api/actions", () => ({ addComment: jest.fn(), deleteComment: jest.fn(), setCommentLike: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const comment: EpisodeComment = {
  id: "c1",
  authorName: "책벌레",
  body: "<b>재미있어요</b>",
  createdAt: "2026-11-05T00:00:00.000Z",
  canDelete: true,
  isAuthor: false,
  likeCount: 2,
  likedByMe: false,
  deleted: false,
  replies: [],
};
const reply = {
  id: "r1",
  authorName: "윤슬",
  body: "고맙습니다",
  createdAt: "2026-11-05T01:00:00.000Z",
  canDelete: false,
  isAuthor: true,
  likeCount: 0,
  likedByMe: true,
};

const setup = (comments: EpisodeComment[], loggedIn = true, total?: number) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EpisodeComments
        episodeId="e1"
        path="/works/w/episodes/1"
        comments={comments}
        total={total ?? comments.length}
        loggedIn={loggedIn}
      />
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
  await waitFor(() => expect(screen.getByRole("heading", { name: /^댓글/ })).toHaveFocus());
});

it("비회원에게는 로그인 링크를 보여 준다", () => {
  setup([], false);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute(
    "href",
    "/login?next=%2Fworks%2Fw%2Fepisodes%2F1",
  );
});

it("100개까지 보여 줄 때 알려 준다", () => {
  const many = Array.from({ length: 100 }, (_, index) => ({ ...comment, id: `c${index}` }));
  setup(many, true, 250);
  expect(screen.getByRole("heading", { name: "댓글 250개" })).toBeInTheDocument();
  expect(screen.getByText("최신순으로 100개까지 보여 줍니다.")).toBeInTheDocument();
});

it("답글을 묶어 보여 주고, 작가 글을 글자로 표시한다", () => {
  setup([{ ...comment, replies: [reply] }]);
  const replies = screen.getByRole("list", { name: "답글 1개" });
  expect(replies).toHaveTextContent("고맙습니다");
  expect(replies).toHaveTextContent("작가");
});

it("답글 버튼으로 칸을 열어 바로 쓰고, 등록하면 닫고 버튼으로 초점을 돌린다", async () => {
  (addComment as jest.Mock).mockResolvedValue({ ok: true, data: null });
  setup([comment]);
  const opener = screen.getByRole("button", { name: "답글: 책벌레의 글" });
  expect(opener).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(opener);
  expect(opener).toHaveAttribute("aria-expanded", "true");
  const box = screen.getByRole("textbox", { name: /답글 쓰기/ });
  expect(box).toHaveFocus();
  await userEvent.type(box, "저도요");
  await userEvent.click(screen.getByRole("button", { name: "답글 등록" }));
  await waitFor(() => expect(addComment).toHaveBeenCalledWith("e1", "저도요", "/works/w/episodes/1", "c1"));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: /답글 쓰기/ })).not.toBeInTheDocument());
  await waitFor(() => expect(opener).toHaveFocus());
});

it("답글의 답글은 그 답글을 대상으로 보내고, 취소하면 보내지 않는다", async () => {
  (addComment as jest.Mock).mockResolvedValue({ ok: true, data: null });
  setup([{ ...comment, replies: [reply] }]);
  await userEvent.click(screen.getByRole("button", { name: "답글: 윤슬의 글" }));
  await userEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(addComment).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "답글: 윤슬의 글" }));
  await userEvent.type(screen.getByRole("textbox", { name: /답글 쓰기/ }), "네");
  await userEvent.click(screen.getByRole("button", { name: "답글 등록" }));
  await waitFor(() => expect(addComment).toHaveBeenCalledWith("e1", "네", "/works/w/episodes/1", "r1"));
});

it("공감을 켜고 끄며, 상태를 aria-pressed와 글자로 알린다", async () => {
  (setCommentLike as jest.Mock).mockResolvedValue({ ok: true, data: null });
  setup([{ ...comment, replies: [reply] }]);
  const off = screen.getByRole("button", { name: "공감 2: 책벌레의 글" });
  expect(off).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(off);
  await waitFor(() => expect(setCommentLike).toHaveBeenCalledWith("c1", true, "/works/w/episodes/1"));
  const on = screen.getByRole("button", { name: "공감 0: 윤슬의 글" });
  expect(on).toHaveAttribute("aria-pressed", "true");
  expect(on).toHaveTextContent("✓");
  await userEvent.click(on);
  await waitFor(() => expect(setCommentLike).toHaveBeenCalledWith("r1", false, "/works/w/episodes/1"));
});

it("비회원에게는 공감 수만 보여 주고 답글 버튼을 두지 않는다", () => {
  setup([comment], false);
  expect(screen.getByText("공감 2")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /공감|답글/ })).not.toBeInTheDocument();
});

it("지운 댓글은 안내만 남기고 답글은 그대로 보여 준다", () => {
  setup([{ ...comment, deleted: true, authorName: "", body: "", replies: [reply] }]);
  expect(screen.getByText("삭제된 댓글입니다.")).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "답글 1개" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /삭제: / })).not.toBeInTheDocument();
});

it("정렬 링크가 현재 값을 표시하고 위치를 지킨다", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EpisodeComments episodeId="e1" path="/p" comments={[]} total={0} loggedIn sort="likes" />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("link", { name: "✓ 공감순" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("link", { name: "최신순" })).toHaveAttribute("href", "/p");
});
