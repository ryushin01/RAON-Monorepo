import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chargeCoins } from "../api/actions";
import { ChargeCoins } from "./charge-coins";

jest.mock("../api/actions", () => ({ chargeCoins: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: { randomUUID: () => "key" } });
});

it("가상 충전임을 알리고 고른 묶음을 넘긴다", async () => {
  (chargeCoins as jest.Mock).mockResolvedValue({ ok: true, data: {} });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChargeCoins />
    </QueryClientProvider>,
  );
  expect(screen.getByText(/가상 충전/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "3,000코인 충전" }));
  await waitFor(() => expect(chargeCoins).toHaveBeenCalledWith({ amount: 3000, idempotencyKey: "key" }));
  expect(await screen.findByRole("status")).toHaveTextContent("3,000코인을 충전했습니다.");
});

it("빠르게 두 번 눌러도 한 번만 충전한다(누를 때마다 새 멱등 키가 생기므로 서버가 막을 수 없음)", async () => {
  (chargeCoins as jest.Mock).mockClear().mockReturnValue(new Promise(() => {}));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChargeCoins />
    </QueryClientProvider>,
  );
  const button = screen.getByRole("button", { name: "3,000코인 충전" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(chargeCoins).toHaveBeenCalledTimes(1));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(chargeCoins).toHaveBeenCalledTimes(1);
});
