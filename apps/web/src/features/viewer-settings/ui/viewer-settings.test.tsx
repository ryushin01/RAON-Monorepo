import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Cookies from "js-cookie";
import { ViewerSettingsToggle } from "./viewer-settings-toggle";

it("보기 설정을 키보드로 열 수 있다", async () => {
  render(<ViewerSettingsToggle />);
  const toggle = screen.getByRole("button", { name: "보기 설정" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("group", { name: "배경" })).not.toBeInTheDocument();

  toggle.focus();
  await userEvent.keyboard("{Enter}");

  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("group", { name: "배경" })).toBeInTheDocument();
});

it("고른 값을 html과 저장소에 반영한다", async () => {
  render(<ViewerSettingsToggle />);
  await userEvent.click(screen.getByRole("button", { name: "보기 설정" }));
  await userEvent.click(screen.getByRole("radio", { name: "검정" }));
  await userEvent.click(screen.getByRole("button", { name: "글자 크기 늘리기" }));

  expect(document.documentElement.dataset.viewerTheme).toBe("black");
  expect(document.documentElement.style.getPropertyValue("--viewer-size")).toBe("19px");
  expect(document.cookie).toContain("raon_viewer=");
  expect(JSON.parse(Cookies.get("raon_viewer") ?? "{}")).toMatchObject({ theme: "black", size: 19 });
});
