import type { Page } from "@playwright/test";

export const PASSWORD = "raon1234";
export const READER = "reader@raon.test";
export const AUTHOR = "author@raon.test";

export async function login(page: Page, email: string, role: "일반 회원" | "작가") {
  await page.goto("/login");
  await page.getByRole("radio", { name: role }).check();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}
