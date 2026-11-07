import { render, screen } from "@testing-library/react";
import { NoteLinkCard } from "./note-link-card";

it("분류와 다른 이름, 내용을 보여 준다", () => {
  render(<NoteLinkCard note={{ title: "이안", category: "인물", aliases: ["등대지기"], body: "마지막 등대지기" }} />);
  expect(screen.getByRole("complementary", { name: "커서가 놓인 설정" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "인물 이안" })).toBeInTheDocument();
  expect(screen.getByText("다른 이름: 등대지기")).toBeInTheDocument();
  expect(screen.getByText("마지막 등대지기")).toBeInTheDocument();
});

it("없는 값은 그리지 않는다", () => {
  render(<NoteLinkCard note={{ title: "이안", category: "", aliases: [], body: "" }} />);
  expect(screen.getByRole("heading", { name: "이안" })).toBeInTheDocument();
  expect(screen.queryByText(/다른 이름/)).not.toBeInTheDocument();
});
