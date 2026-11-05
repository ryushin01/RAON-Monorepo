import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

it("푸터 랜드마크에 가상 데이터임을 알린다", () => {
  render(<SiteFooter />);
  expect(screen.getByRole("contentinfo")).toHaveTextContent("이 사이트의 작품과 결제는 모두 가상입니다.");
});
