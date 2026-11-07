import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

it("푸터 랜드마크에 가상 데이터임을 알린다", () => {
  render(<SiteFooter />);
  expect(screen.getByRole("contentinfo")).toHaveTextContent("이 사이트의 작품과 결제는 모두 가상입니다.");
});

it("작가 스튜디오로 가는 연재 안내를 둔다", () => {
  render(<SiteFooter />);
  expect(screen.getByRole("region", { name: "당신의 이야기를 연재해 보세요." })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "연재 시작하기" })).toHaveAttribute("href", "/studio");
});
