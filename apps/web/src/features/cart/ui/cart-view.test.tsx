import type { Cart } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { checkout, removeFromCart } from "../api/actions";
import { CartView } from "./cart-view";

const push = jest.fn();
jest.mock("../api/actions", () => ({ checkout: jest.fn(), removeFromCart: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: jest.fn() }) }));

const cart: Cart = {
  coinBalance: 500,
  total: 100,
  items: [
    {
      id: "i1",
      kind: "EPISODE",
      workId: "w1",
      workTitle: "작품",
      episodeId: "e2",
      episodeNumber: 2,
      episodeTitle: "회차",
      price: 100,
      unavailableReason: null,
    },
  ],
};

const setup = (value: Cart) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CartView cart={value} />
    </QueryClientProvider>,
  );

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: { randomUUID: () => "key-1" } });
});

beforeEach(() => {
  push.mockReset();
  (checkout as jest.Mock).mockReset().mockResolvedValue({ ok: true, data: {} });
  (removeFromCart as jest.Mock).mockReset().mockResolvedValue({ ok: true, data: {} });
});

describe("CartView", () => {
  it("결제하면 멱등 키를 넘기고 내 서재로 이동한다", async () => {
    setup(cart);
    await userEvent.click(screen.getByRole("button", { name: "100코인 결제하기" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/my?purchased=1"));
    expect(checkout).toHaveBeenCalledWith("key-1");
  });

  it("코인이 부족하면 결제를 막고 충전 링크를 보여 준다", () => {
    setup({ ...cart, coinBalance: 30 });
    expect(screen.getByRole("button", { name: "100코인 결제하기" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "코인 충전하기" })).toHaveAttribute("href", "/my#charge");
    expect(screen.getByText(/70코인 부족합니다/)).toBeInTheDocument();
  });

  it("결제할 수 없는 항목이 있으면 이유를 보여 주고 막는다", () => {
    setup({ ...cart, items: [{ ...cart.items[0]!, unavailableReason: "이미 구매한 회차입니다." }] });
    expect(screen.getByText(/이미 구매한 회차입니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /결제하기/ })).toBeDisabled();
  });

  it("항목마다 무엇을 뺄지 이름으로 구분된다", async () => {
    setup(cart);
    await userEvent.click(screen.getByRole("button", { name: "빼기: 작품 2화. 회차" }));
    await waitFor(() => expect(removeFromCart).toHaveBeenCalledWith("i1"));
  });

  it("비어 있으면 안내한다", () => {
    setup({ ...cart, items: [], total: 0 });
    expect(screen.getByText("장바구니가 비어 있습니다.")).toBeInTheDocument();
  });
});
