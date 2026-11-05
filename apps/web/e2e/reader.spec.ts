import { expect, test } from "@playwright/test";
import { login, READER } from "./helpers";

const WORK = "등대지기의 마지막 항로";
const PAID_TEXT = "새벽이 되자 줄은 한 칸 더 늘어나 있었다";

test("비회원은 무료 회차를 읽고, 유료 회차 본문은 HTML에도 없다", async ({ page, request }) => {
  await page.goto("/works?q=등대지기");
  await page.getByRole("link", { name: WORK }).click();
  await expect(page.getByRole("heading", { level: 1, name: WORK })).toBeVisible();

  await page.getByRole("link", { name: "첫 화 보기" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /1화/ })).toBeVisible();
  await expect(page).toHaveTitle(/1화\. 불을 끄지 말 것/);
  await expect(page.getByText("일흔두 칸")).toBeVisible();

  const base = new URL(page.url()).pathname.replace(/\/\d+$/, "");
  await page.goto(`${base}/3`);
  await expect(page.getByText(/유료 회차입니다/)).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인하기" })).toBeVisible();

  const html = await (await request.get(`${base}/3`)).text();
  expect(html).not.toContain(PAID_TEXT);
});

test("일반 회원은 회차를 담아 코인으로 결제하고 읽는다", async ({ page }) => {
  await login(page, READER, "일반 회원");

  await page.goto("/works?q=등대지기");
  await page.getByRole("link", { name: WORK }).click();
  await page.getByRole("checkbox", { name: /3화/ }).check();
  await expect(page.getByText("1화 선택 · 100코인")).toBeVisible();
  await page.getByRole("button", { name: "장바구니 담기" }).click();
  await expect(page.getByRole("status").filter({ hasText: "장바구니에 담았습니다" })).toBeVisible();
  await expect(page.getByRole("link", { name: "장바구니 1개" })).toBeVisible();

  await page.getByRole("link", { name: "장바구니 1개" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "장바구니" })).toBeVisible();
  await page.getByRole("button", { name: "100코인 결제하기" }).click();

  await page.waitForURL(/\/my\?purchased=1/);
  await expect(page.getByText("결제를 마쳤습니다")).toBeVisible();
  await expect(page.getByText("보유 2,900코인")).toBeVisible();

  await page.getByRole("link", { name: /3화\. 지워진 출항 기록/ }).click();
  await expect(page.getByText(PAID_TEXT)).toBeVisible();
});

test("완결 작품은 작품 전체를 살 수 있다", async ({ page }) => {
  await login(page, READER, "일반 회원");
  await page.goto("/works?q=기억을");
  await page.getByRole("link", { name: "기억을 파는 골목" }).click();
  await page.getByRole("button", { name: "작품 전체 담기" }).click();
  await expect(page.getByRole("link", { name: "장바구니에 담겨 있음" })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByText("작품 전체", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "250코인 결제하기" }).click();
  await page.waitForURL(/\/my/);

  await page.getByRole("link", { name: "기억을 파는 골목" }).click();
  await page.getByRole("link", { name: /3화\. 저울의 반대편/ }).click();
  await expect(page.getByText("저울 앞에 오래 서 있었다")).toBeVisible();
});

test("코인이 모자라면 충전하고 결제할 수 있다", async ({ page }) => {
  await login(page, READER, "일반 회원");
  await page.goto("/my");
  await page.getByRole("button", { name: "1,000코인 충전" }).click();
  await expect(page.getByRole("status").filter({ hasText: "충전했습니다" })).toBeVisible();
  await expect(page.getByText(/보유 3,\d+코인/)).toBeVisible();
});

test("뷰어 설정은 다음에 열어도 유지된다", async ({ page }) => {
  await page.goto("/works?q=궤도");
  await page.getByRole("link", { name: "궤도 위의 우체부" }).click();
  await page.getByRole("link", { name: "첫 화 보기" }).click();

  const toggle = page.getByRole("button", { name: "보기 설정" });
  await toggle.click();
  await page.getByRole("radio", { name: "검정" }).check();
  await page.getByRole("button", { name: "글자 크기 늘리기" }).click();

  await page.reload();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-viewer-theme", "black");
  const size = await page.evaluate(() => document.documentElement.style.getPropertyValue("--viewer-size"));
  expect(size).toBe("19px");
});

test("회차 이동 링크로 앞뒤 회차를 오간다", async ({ page }) => {
  await page.goto("/works?q=궤도");
  await page.getByRole("link", { name: "궤도 위의 우체부" }).click();
  await page.getByRole("link", { name: "첫 화 보기" }).click();
  await page.getByRole("navigation", { name: "회차 이동" }).getByRole("link", { name: /2화/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /2화/ })).toBeVisible();
});
