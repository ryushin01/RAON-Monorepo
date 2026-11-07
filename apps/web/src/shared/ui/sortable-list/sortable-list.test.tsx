import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

it("순서 바꾸기가 실패해도 요청하는 사이 받은 새 목록은 지킨다", async () => {
  // jsdom은 배치를 계산하지 않으므로 항목마다 세로로 쌓인 위치를 준다.
  const rect = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const item = this.closest("li");
    const index = item ? Array.from(item.parentElement?.children ?? []).indexOf(item) : 0;
    return {
      x: 0,
      y: index * 50,
      top: index * 50,
      left: 0,
      bottom: index * 50 + 40,
      right: 300,
      width: 300,
      height: 40,
      toJSON: () => ({}),
    };
  });
  let fail: (reason: Error) => void = () => {};
  const onReorder = jest.fn(() => new Promise<void>((_, reject) => (fail = reject)));
  const { rerender } = render(<SortableList items={items} onReorder={onReorder} name="회차" />);

  const handle = screen.getByRole("button", { name: "끌어서 옮기기: 1화" });
  handle.focus();
  fireEvent.keyDown(handle, { code: "Space" });
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  fireEvent.keyDown(document.activeElement ?? handle, { code: "ArrowDown" });
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  fireEvent.keyDown(document.activeElement ?? handle, { code: "Space" });
  await waitFor(() => expect(onReorder).toHaveBeenCalledWith(["b", "a"]));

  // 요청하는 사이 새 이미지가 들어온 목록을 받는다.
  const added = [...items, { id: "c", label: "3화", content: <span>새 회차</span> }];
  rerender(<SortableList items={added} onReorder={onReorder} name="회차" />);
  await act(async () => fail(new Error("순서를 바꾸지 못했습니다.")));

  expect(await screen.findByText("순서를 바꾸지 못했습니다.")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "⠿첫 회차",
    "⠿둘째 회차",
    "⠿새 회차",
  ]);
  rect.mockRestore();
});
