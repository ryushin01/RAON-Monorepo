import { render, screen } from "@testing-library/react";
import { HomeHero } from "./home-hero";

it("화면의 제목과 작품으로 가는 링크를 제공한다", () => {
  render(<HomeHero />);
  expect(screen.getByRole("heading", { level: 1, name: /라온에서/ })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /라온에서/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "작품 둘러보기" })).toHaveAttribute("href", "/works");
});

it("제목 id를 고정하지 않아 숨겨진 화면과 겹치지 않는다", () => {
  const { container } = render(
    <>
      <HomeHero />
      <HomeHero />
    </>,
  );
  const ids = [...container.querySelectorAll("h1")].map((heading) => heading.id);
  expect(new Set(ids).size).toBe(2);
});

it("나선은 장식이라 보조 기술에 노출하지 않는다", () => {
  render(<HomeHero />);
  const spiral = screen.getByTestId("type-spiral");
  expect(spiral).toHaveAttribute("aria-hidden", "true");
  const href = spiral.querySelector("textPath")?.getAttribute("href");
  expect(href && spiral.querySelector(`[id="${href.slice(1)}"]`)).toBeTruthy();
});
