import { render, screen } from "@testing-library/react";
import { NoteProperties } from "./note-properties";

it("이름과 값을 정의 목록으로 보여 준다", () => {
  render(<NoteProperties properties={[{ name: "나이", value: "서른둘" }]} />);
  expect(screen.getByRole("term")).toHaveTextContent("나이");
  expect(screen.getByRole("definition")).toHaveTextContent("서른둘");
});

it("속성이 없으면 그리지 않는다", () => {
  const { container } = render(<NoteProperties properties={[]} />);
  expect(container).toBeEmptyDOMElement();
});
