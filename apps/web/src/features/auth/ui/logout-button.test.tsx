import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { logout } from "../api/actions";
import { LogoutButton } from "./logout-button";

jest.mock("../api/actions", () => ({ logout: jest.fn() }));

it("로그아웃을 요청한다", async () => {
  (logout as jest.Mock).mockResolvedValue(undefined);
  render(<LogoutButton />);
  await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() => expect(logout).toHaveBeenCalled());
});
