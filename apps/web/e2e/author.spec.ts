import { expect, test } from "@playwright/test";
import { AUTHOR, login, READER } from "./helpers";

test("작가는 에디터로 집필해 공개하고, 독자가 바로 읽는다", async ({ page, browser }) => {
  const title = `테스트 작품 ${Date.now()}`;
  await login(page, AUTHOR, "작가");
  await page.waitForURL("/studio");

  await page.getByRole("link", { name: "새 작품 만들기" }).click();
  await page.getByRole("textbox", { name: "작품명", exact: true }).fill(title);
  await page.getByLabel("작품 소개").fill("에디터에서 쓴 회차를 공개하는 테스트 작품입니다.");
  await page.getByLabel("회차 가격(코인)").fill("120");
  await page.getByRole("button", { name: "작품 만들기" }).click();
  await page.waitForURL(/\/studio\/works\/[0-9a-f-]{36}$/);

  await page.getByRole("link", { name: "새 회차 쓰기" }).click();
  await page.getByLabel("회차 제목").fill("첫 번째 이야기");
  await page.getByLabel("무료 회차로 공개").check();
  const editor = page.getByRole("textbox", { name: "본문" });
  await editor.click();
  await page.keyboard.type("에디터로 직접 쓴 문장입니다.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "굵게" }).click();
  await expect(page.getByRole("button", { name: "굵게" })).toHaveAttribute("aria-pressed", "true");
  await editor.click();
  await page.keyboard.type("굵은 둘째 문장.");

  // 초안은 자동 저장된다.
  await expect(page.getByText(/1화 · 초안 · .*저장됨/)).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/episodes\/[0-9a-f-]{36}$/);

  // 새로고침해도 내용이 남아 있다.
  await page.reload();
  await expect(page.getByRole("textbox", { name: "본문" })).toContainText("직접 쓴 문장");

  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/1화 · 공개 중/)).toBeVisible();

  // 다른 브라우저의 비회원이 목록에서 찾아 읽는다.
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/works?q=${encodeURIComponent(title)}`);
  await guest.getByRole("link", { name: title }).click();
  await guest.getByRole("link", { name: "첫 화 보기" }).click();
  await expect(guest.getByText("에디터로 직접 쓴 문장입니다.")).toBeVisible();
  await guest.close();
});

test("로그인 유형이 맞지 않으면 안내한다", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("radio", { name: "일반 회원" }).check();
  await page.getByLabel("이메일").fill(AUTHOR);
  await page.getByLabel("비밀번호").fill("raon1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "작가 계정입니다" })).toBeVisible();
});

test("일반 회원은 스튜디오에 들어갈 수 없고, 비회원은 로그인으로 간다", async ({ page }) => {
  await page.goto("/cart");
  await expect(page).toHaveURL(/\/login\?next=%2Fcart/);

  await login(page, READER, "일반 회원");
  await page.goto("/studio");
  await expect(page).toHaveURL("/");
});

test("회원가입한 작가는 바로 스튜디오로 간다", async ({ page }) => {
  const id = Date.now();
  await page.goto("/signup");
  await page.getByRole("radio", { name: "작가" }).check();
  await page.getByLabel("이메일").fill(`new${id}@raon.test`);
  await page.getByLabel("비밀번호").fill("password1");
  await page.getByLabel("닉네임").fill(`작가${String(id).slice(-6)}`);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("/studio");
  await expect(page.getByText("아직 만든 작품이 없습니다")).toBeVisible();
});
