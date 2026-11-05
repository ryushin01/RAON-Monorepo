import { render, screen } from "@testing-library/react";
import { Pagination, visiblePages } from "./pagination";

const hrefFor = (page: number) => `/works?page=${page}`;

describe("Pagination", () => {
  it("현재 쪽을 표시한다", () => {
    render(<Pagination page={2} pageSize={10} total={25} hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "2쪽" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "3쪽" })).toHaveAttribute("href", "/works?page=3");
  });

  it("한 쪽뿐이면 그리지 않는다", () => {
    const { container } = render(<Pagination page={1} pageSize={10} total={5} hrefFor={hrefFor} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("visiblePages", () => {
  it("쪽이 많으면 줄임표로 묶는다", () => {
    expect(visiblePages(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(visiblePages(1, 20)).toEqual([1, 2, "gap", 20]);
    expect(visiblePages(2, 3)).toEqual([1, 2, 3]);
  });
});
