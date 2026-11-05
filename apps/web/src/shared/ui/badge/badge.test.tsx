import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

it("글자로 상태를 보여 준다", () => {
  render(<Badge solid>완결</Badge>);
  expect(screen.getByText("완결")).toBeInTheDocument();
});
