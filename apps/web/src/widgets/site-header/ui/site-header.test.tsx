import { render, screen, within } from "@testing-library/react";
import { SiteHeader } from "./site-header";

// 로그인 상태는 서버에서 읽으므로 E2E로 검사한다.
jest.mock("./user-menu", () => ({ UserMenu: () => <span>사용자 메뉴</span> }));
jest.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
});

it("로고 이름에 보이는 글자가 들어 있다", () => {
  render(<SiteHeader />);
  expect(screen.getByRole("link", { name: "RAON 첫 화면" })).toHaveAttribute("href", "/");
});

it("검색 칸과 주요 메뉴를 제공한다", () => {
  render(<SiteHeader />);
  // jsdom이 <search>의 역할을 몰라 입력 칸으로 확인한다. 실제 브라우저의 역할은 E2E의 axe가 본다.
  expect(screen.getByRole("searchbox", { name: /검색/ })).toHaveAttribute("name", "q");
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(within(nav).getByRole("link", { name: "완결" })).toHaveAttribute(
    "href",
    "/works?format=NOVEL&status=COMPLETED",
  );
  expect(within(nav).getByRole("link", { name: "무협" })).toHaveAttribute("href", "/works?format=NOVEL&genre=MARTIAL");
});
