import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModeNav } from "./mode-nav";

let pathname = "/";
let search = "";
jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  pathname = "/";
  search = "";
  // biome-ignore lint/suspicious/noDocumentCookie: 테스트 사이에 쿠키를 지운다.
  document.cookie = "raon_mode=; max-age=0; path=/";
});

const nav = () => within(screen.getByRole("navigation", { name: "주요 메뉴" }));

it("저장한 값이 없으면 웹소설 모드이고, 메뉴가 그 모드로 이어진다", () => {
  render(<ModeNav />);
  expect(nav().getByRole("link", { name: "웹소설" })).toHaveAttribute("aria-current", "true");
  expect(nav().getByRole("link", { name: "웹툰" })).not.toHaveAttribute("aria-current");
  expect(nav().getByRole("link", { name: "전체 작품" })).toHaveAttribute("href", "/works?format=NOVEL");
  expect(nav().getByRole("link", { name: "무협" })).toHaveAttribute("href", "/works?format=NOVEL&genre=MARTIAL");
});

it("주소에 드러난 모드를 따른다", () => {
  pathname = "/works";
  search = "format=COMIC";
  render(<ModeNav />);
  expect(nav().getByRole("link", { name: "웹툰" })).toHaveAttribute("aria-current", "true");
  expect(nav().getByRole("link", { name: "완결" })).toHaveAttribute("href", "/works?format=COMIC&status=COMPLETED");
});

it("탭을 누르면 고른 모드를 기억해 다른 화면의 메뉴에도 쓴다", async () => {
  pathname = "/my";
  render(<ModeNav />);
  const tab = nav().getByRole("link", { name: "웹툰" });
  expect(tab).toHaveAttribute("href", "/webtoon");
  // jsdom은 페이지를 옮기지 않으므로 경고 없이 기록만 확인한다.
  tab.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(tab);
  expect(document.cookie).toContain("raon_mode=COMIC");
  expect(nav().getByRole("link", { name: "전체 작품" })).toHaveAttribute("href", "/works?format=COMIC");
});

it("고른 탭에만 장식용 바탕 표시를 두고 읽지 않게 한다", () => {
  render(<ModeNav />);
  const current = nav().getByRole("link", { name: "웹소설" });
  expect(current.querySelector("[data-indicator]")).toHaveAttribute("aria-hidden", "true");
  expect(nav().getByRole("link", { name: "웹툰" }).querySelector("[data-indicator]")).toBeNull();
});
