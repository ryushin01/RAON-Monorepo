import { render, screen } from "@testing-library/react";
import { Button, ButtonLink } from "./button";

describe("Button", () => {
  it("폼을 실수로 제출하지 않도록 기본 type이 button이다", () => {
    render(<Button>담기</Button>);
    expect(screen.getByRole("button", { name: "담기" })).toHaveAttribute("type", "button");
  });

  it("링크는 링크 역할을 유지한다", () => {
    render(<ButtonLink href="/cart">장바구니</ButtonLink>);
    expect(screen.getByRole("link", { name: "장바구니" })).toHaveAttribute("href", "/cart");
  });
});
