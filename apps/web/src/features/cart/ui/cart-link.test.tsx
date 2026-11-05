import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { CART_QUERY_KEY } from "@/entities/cart";
import { CartLink } from "./cart-link";

it("담긴 수를 링크 이름으로 알려 준다", () => {
  const client = new QueryClient();
  client.setQueryData(CART_QUERY_KEY, { count: 3 });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 3 }) });
  render(
    <QueryClientProvider client={client}>
      <CartLink />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("link", { name: "장바구니 3개" })).toHaveAttribute("href", "/cart");
});
