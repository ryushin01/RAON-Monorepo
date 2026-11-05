import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { logout } from "../api/actions";
import { LogoutButton } from "./logout-button";

jest.mock("../api/actions", () => ({ logout: jest.fn() }));

it("로그아웃을 요청한다", async () => {
  (logout as jest.Mock).mockResolvedValue(undefined);
  localStorage.setItem("raon:episode-backup:e1", "{}");
  localStorage.setItem("raon:theme", "dark");
  render(<LogoutButton />);
  await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() => expect(logout).toHaveBeenCalled());
  // 공개 전 원고 백업은 지우고, 화면 설정은 남긴다.
  await waitFor(() => expect(localStorage.getItem("raon:episode-backup:e1")).toBeNull());
  expect(localStorage.getItem("raon:theme")).toBe("dark");
});
