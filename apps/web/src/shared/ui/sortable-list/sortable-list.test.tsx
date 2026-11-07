import { render, screen } from "@testing-library/react";
import { SortableList } from "./sortable-list";

const items = [
  { id: "a", label: "1화", content: <span>첫 회차</span> },
  { id: "b", label: "2화", content: <span>둘째 회차</span> },
];

it("항목마다 이름이 있는 손잡이를 두고, 조작 방법을 스크린 리더에 알린다", () => {
  render(<SortableList items={items} onReorder={jest.fn()} name="회차" />);
  expect(screen.getByRole("list", { name: "회차" })).toBeInTheDocument();
  const handle = screen.getByRole("button", { name: "끌어서 옮기기: 1화" });
  expect(handle).toHaveAttribute("aria-roledescription", "옮길 수 있는 항목");
  expect(handle).toHaveAccessibleDescription(expect.stringContaining("위아래 화살표"));
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["⠿첫 회차", "⠿둘째 회차"]);
});

it("새 목록을 받으면 그 순서를 따른다", () => {
  const { rerender } = render(<SortableList items={items} onReorder={jest.fn()} name="회차" />);
  rerender(<SortableList items={[...items].reverse()} onReorder={jest.fn()} name="회차" />);
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["⠿둘째 회차", "⠿첫 회차"]);
});
