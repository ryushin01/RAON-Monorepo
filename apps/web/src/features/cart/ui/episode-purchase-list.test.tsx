import type { WorkDetail } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { addToCart } from "../api/actions";
import { EpisodePurchaseList } from "./episode-purchase-list";

jest.mock("../api/actions", () => ({ addToCart: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const episode = (number: number, isFree: boolean) => ({
  id: `e${number}`,
  number,
  title: `제목${number}`,
  isFree,
  charCount: 1000,
  episodeType: "REGULAR" as const,
  publishedAt: "2026-11-01T00:00:00.000Z",
});

const work: WorkDetail = {
  id: "w1",
  title: "작품",
  format: "NOVEL",
  authorName: "작가",
  genre: "SF",
  status: "COMPLETED",
  synopsis: "소개",
  viewCount: 1,
  episodeCount: 3,
  firstEpisodeNumber: 1,
  latestEpisodeAt: null,
  tags: [],
  ratingAverage: null,
  ratingCount: 0,
  coverUpdatedAt: null,
  badges: [],
  episodePrice: 100,
  wholePrice: 150,
  episodes: [episode(1, true), episode(2, false), episode(3, false)],
};

const noAccess = {
  ownsWork: false,
  ownedEpisodeIds: [],
  cartEpisodeIds: [],
  workInCart: false,
  isFavorite: false,
  myRating: null,
  lastReadNumber: null,
  wholePriceForUser: 150,
};

function setup(props: Partial<ComponentProps<typeof EpisodePurchaseList>>) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <EpisodePurchaseList work={work} access={noAccess} role="READER" {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  (addToCart as jest.Mock).mockReset().mockResolvedValue({ ok: true, data: {} });
});

describe("EpisodePurchaseList", () => {
  it("유료 회차만 고를 수 있고 합계를 보여 준다", async () => {
    setup({});
    expect(screen.queryByRole("checkbox", { name: /1화/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /2화/ }));
    expect(screen.getByText("1화 선택 · 100코인")).toBeInTheDocument();
  });

  it("고른 회차를 mutate로 직접 넘긴다", async () => {
    setup({});
    await userEvent.click(screen.getByRole("button", { name: "유료 회차 모두 선택" }));
    await userEvent.click(screen.getByRole("button", { name: "장바구니 담기" }));
    await waitFor(() =>
      expect(addToCart).toHaveBeenCalledWith({ kind: "EPISODES", workId: "w1", episodeIds: ["e2", "e3"] }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("장바구니에 담았습니다.");
  });

  it("처리 중에는 다시 누를 수 없다", async () => {
    (addToCart as jest.Mock).mockReturnValue(new Promise(() => {}));
    setup({});
    await userEvent.click(screen.getByRole("checkbox", { name: /2화/ }));
    await userEvent.click(screen.getByRole("button", { name: "장바구니 담기" }));
    expect(await screen.findByRole("button", { name: "담는 중…" })).toBeDisabled();
  });

  it("실패 이유를 알려 준다", async () => {
    (addToCart as jest.Mock).mockResolvedValue({ ok: false, message: "이미 구매한 작품입니다." });
    setup({});
    await userEvent.click(screen.getByRole("button", { name: "작품 전체 담기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이미 구매한 작품입니다.");
  });

  it("구매한 회차는 글자로 표시하고 고를 수 없다", () => {
    setup({ access: { ...noAccess, ownedEpisodeIds: ["e2"] } });
    expect(screen.getByText("구매함")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /2화/ })).not.toBeInTheDocument();
  });

  it("이미 산 회차가 있으면 차감한 작품 가격을 보여 준다", () => {
    setup({ access: { ...noAccess, ownedEpisodeIds: ["e2"], wholePriceForUser: 50 } });
    expect(screen.getByText(/작품 전체 50코인/)).toBeInTheDocument();
    expect(screen.getByText("이미 산 회차 금액을 뺀 가격입니다.")).toBeInTheDocument();
  });

  it("비회원과 작가에게는 고르는 칸이 없다", () => {
    const { unmount } = setup({ role: null, access: null });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하고 구매하기" })).toBeInTheDocument();
    unmount();
    setup({ role: "AUTHOR", access: null });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/작품 전체/)).not.toBeInTheDocument();
  });
});
