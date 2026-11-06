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

test("선호작에 넣고 이어 보기로 돌아오며, 댓글을 남긴다", async ({ page }) => {
  await login(page, READER, "일반 회원");
  await page.goto("/works?q=퇴근");
  await page.getByRole("link", { name: "퇴근 후 던전 관리사무소" }).click();
  await page.getByRole("button", { name: "선호작 추가" }).click();
  await expect(page.getByRole("button", { name: "✓ 선호작" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "첫 화 보기" }).click();
  await page.getByRole("navigation", { name: "회차 이동" }).getByRole("link", { name: /2화/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /2화/ })).toBeVisible();

  const comment = `댓글 ${Date.now()}`;
  await page.getByRole("textbox", { name: /댓글 쓰기/ }).fill(comment);
  await page.getByRole("button", { name: "등록" }).click();
  await expect(page.getByText(comment)).toBeVisible();
  await page
    .getByRole("button", { name: /^삭제:/ })
    .first()
    .click();
  await expect(page.getByText(comment)).toHaveCount(0);

  await page.goto("/my");
  await expect(
    page.getByRole("region", { name: "선호작" }).getByRole("link", { name: "퇴근 후 던전 관리사무소" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "퇴근 후 던전 관리사무소 2화 이어 보기" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /2화/ })).toBeVisible();
});

test("별점을 주면 평균에 반영되고, 다시 누르면 지운다", async ({ page }) => {
  await login(page, READER, "일반 회원");
  await page.goto("/works?q=설산");
  await page.getByRole("link", { name: "설산에 묻은 칼" }).click();
  await expect(page.getByText(/별점 /)).toHaveCount(0);

  await page.getByRole("button", { name: "4점" }).click();
  await expect(page.getByRole("button", { name: "4점" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/별점 4\(1명\)/)).toBeVisible();

  await page.getByRole("button", { name: "4점" }).click();
  await expect(page.getByRole("button", { name: "4점" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/별점 4\(1명\)/)).toHaveCount(0);
});

test("별점 저장 뒤 화면을 새로 받는 동안에도 점수를 유지하고 다시 누를 수 없다", async ({ page }) => {
  await login(page, READER, "일반 회원");
  await page.goto("/works?q=궤도");
  await page.getByRole("link", { name: "궤도 위의 우체부" }).click();
  const score = page.getByRole("button", { name: "2점" });
  await expect(score).toHaveAttribute("aria-pressed", "false");

  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() === "GET" && request.headers().rsc) await held;
    await route.continue();
  });

  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await score.click();
  await saved;
  await expect(score).toHaveAttribute("aria-pressed", "true");
  await expect(score).toHaveAttribute("aria-disabled", "true");
  // click()은 aria-disabled가 풀리기를 기다리므로 키보드로 누른다. 이 입력은 무시되어야 한다.
  await score.press("Enter");

  release();
  await expect(score).toHaveAttribute("aria-disabled", "false");
  await expect(score).toHaveAttribute("aria-pressed", "true");
  await score.click();
  await expect(score).toHaveAttribute("aria-pressed", "false");
});

test("선호작 저장 뒤 화면을 새로 받는 동안 눌러도 상태가 어긋나지 않는다", async ({ page }) => {
  await login(page, READER, "일반 회원");
  await page.goto("/works?q=궤도");
  await page.getByRole("link", { name: "궤도 위의 우체부" }).click();
  const button = page.getByRole("button", { name: /선호작/ });
  await expect(button).toHaveAttribute("aria-pressed", "false");

  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() === "GET" && request.headers().rsc) await held;
    await route.continue();
  });

  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await button.click();
  await saved;
  await expect(button).toHaveAttribute("aria-disabled", "false");
  await expect(button).toHaveAttribute("aria-pressed", "true");

  release();
  await button.press("Enter");
  await expect(button).toHaveAttribute("aria-pressed", "false");
});

test("태그와 별점순으로 찾고, 뱃지를 글자로 보여 준다", async ({ page }) => {
  await page.goto("/works?q=유리");
  await page.getByRole("link", { name: "유리 정원의 살인" }).click();
  await page.getByRole("list", { name: "태그" }).getByRole("link", { name: "#밀실" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "#밀실 작품" })).toBeVisible();
  await expect(page.getByRole("link", { name: "유리 정원의 살인" })).toBeVisible();

  await page.goto("/works?sort=rating");
  await expect(page.getByRole("link", { name: "별점순" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(/검은 먹의 강호|유리 정원의 살인/);

  await page.goto("/works?sort=popular");
  await expect(page.getByText("인기", { exact: true }).first()).toBeVisible();
});

test("모바일 첫 화면에서 소개 문장과 추천 작품이 함께 보인다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");
  await expect(page.getByText("작가는 회차를 연재하고")).toBeVisible();
  await expect(page.getByRole("region", { name: "추천 작품" }).getByRole("heading", { level: 2 })).toBeInViewport();
});

test("메인 배너는 자동으로 넘어가지 않고 버튼으로 넘긴다", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "추천 작품" });
  await expect(banner.getByText("인기 1위")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(banner.getByText("인기 1위")).toBeVisible();
  await banner.getByRole("button", { name: "다음 배너" }).click();
  await expect(banner.getByText("새로 올라온 회차")).toBeVisible();
  await expect(banner.getByText("인기 1위")).toBeHidden();
});

test("테마와 뷰어 설정은 쿠키에 저장하고, 세션 토큰은 스크립트가 읽지 못한다", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "어두운 화면" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await login(page, READER, "일반 회원");
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "raon_theme")).toMatchObject({ value: "dark", httpOnly: false });
  expect(cookies.find((c) => c.name === "raon_session")).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(await page.evaluate(() => document.cookie)).not.toContain("raon_session");
});
