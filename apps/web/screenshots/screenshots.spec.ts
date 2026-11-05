import { type Page, test } from "@playwright/test";
import { AUTHOR, login, READER } from "../e2e/helpers";

// README의 스크린샷을 다시 찍는다: yarn screenshots
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `../../docs/images/${name}.jpg`, type: "jpeg", quality: 82 });

test.use({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });

test("README 스크린샷", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await shot(page, "home");
  await page.goto("/works");
  await page.waitForLoadState("networkidle");
  await shot(page, "works");

  await login(page, READER, "일반 회원");
  await page.goto("/works?q=등대지기");
  await page.getByRole("link", { name: "등대지기의 마지막 항로" }).click();
  await page.getByRole("checkbox", { name: /3화/ }).check();
  await page.getByRole("checkbox", { name: /4화/ }).check();
  // 표지와 별점까지 한 화면에 담는다.
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "work-detail");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "장바구니 담기" }).click();
  await page.getByRole("status").filter({ hasText: "담았습니다" }).waitFor();
  const work = page.url();

  await page.goto("/cart");
  await page.waitForLoadState("networkidle");
  await shot(page, "cart");
  await page.goto(`${work}/episodes/1`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForLoadState("networkidle");
  await shot(page, "viewer");
  await page.getByRole("button", { name: "보기 설정" }).click();
  await page.getByRole("radio", { name: "검정" }).check();
  await shot(page, "viewer-settings");
  await page.getByRole("radio", { name: "자동" }).check();

  await page.goto(`${work}/episodes/1`);
  await page.getByRole("region", { name: "댓글" }).scrollIntoViewIfNeeded();
  await page.getByRole("heading", { level: 2, name: /^댓글/ }).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot(page, "viewer-comments");
  await page.goto("/my");
  await page.waitForLoadState("networkidle");
  await shot(page, "my");

  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await shot(page, "home-mobile");
  await page.goto(`${work}/episodes/5`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForLoadState("networkidle");
  await shot(page, "viewer-locked");
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.context().clearCookies();
  await login(page, AUTHOR, "작가");
  await page.waitForLoadState("networkidle");
  await shot(page, "studio");
  await page.getByRole("link", { name: "등대지기의 마지막 항로" }).click();
  await page.getByRole("button", { name: "새 회차 쓰기" }).waitFor();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await shot(page, "studio-work");
  await page.getByRole("region", { name: "작품 정보" }).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot(page, "studio-work-form");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("link", { name: /^1화/ }).click();
  await page.getByRole("textbox", { name: "본문" }).waitFor();
  await page.waitForLoadState("networkidle");
  await shot(page, "editor");
});
