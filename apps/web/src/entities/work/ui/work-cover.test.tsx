import { render, screen } from "@testing-library/react";
import { WorkCover } from "./work-cover";

const pattern = (title: string) => {
  const { container, unmount } = render(<WorkCover title={title} authorName="작가" />);
  const value = (container.firstChild as HTMLElement).dataset.pattern;
  unmount();
  return value;
};

it("같은 제목은 항상 같은 표지가 된다", () => {
  expect(pattern("등대지기")).toBe(pattern("등대지기"));
});

it("보조기술에는 숨긴다", () => {
  const { container } = render(<WorkCover title="제목" authorName="작가" />);
  expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
});

it("bare면 표지의 글자를 뺀다", () => {
  render(<WorkCover title="제목" authorName="작가" bare />);
  expect(screen.queryByText("제목")).not.toBeInTheDocument();
});
