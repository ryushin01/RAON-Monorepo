import { expect, type Page, test } from "@playwright/test";
import { AUTHOR, login, READER } from "./helpers";

async function createWork(page: Page, title: string) {
  await page.goto("/studio/works/new");
  await page.getByRole("textbox", { name: "작품명 (필수)" }).fill(title);
  await page.getByLabel(/작품 소개/).fill("에디터에서 쓴 회차를 공개하는 테스트 작품입니다.");
  await page.getByLabel(/회차 가격/).fill("120");
  await page.getByRole("button", { name: "작품 만들기" }).click();
  await page.waitForURL(/\/studio\/works\/[0-9a-f-]{36}$/);
}

const editorOf = (page: Page) => page.getByRole("textbox", { name: "본문" });

test("작가는 에디터로 집필해 공개하고, 독자가 바로 읽는다", async ({ page, browser }) => {
  const title = `테스트 작품 ${Date.now()}`;
  await login(page, AUTHOR, "작가");
  await page.waitForURL("/studio");
  await createWork(page, title);

  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await page.getByLabel("회차 제목").fill("첫 번째 이야기");
  await page.getByLabel("무료 회차로 공개").check();
  await editorOf(page).click();
  await page.keyboard.type("에디터로 직접 쓴 문장입니다.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "굵게" }).click();
  await expect(page.getByRole("button", { name: "굵게" })).toHaveAttribute("aria-pressed", "true");
  await editorOf(page).click();
  await page.keyboard.type("굵은 둘째 문장.");

  // 초안은 자동 저장된다.
  await expect(page.getByText(/1화 · 초안 · .*저장됨/)).toBeVisible({ timeout: 10_000 });

  // 새로고침해도 내용이 남아 있다.
  await page.reload();
  await expect(editorOf(page)).toContainText("직접 쓴 문장");

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

test("새 회차는 매번 새 초안이고 직전 회차를 덮어쓰지 않는다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `덮어쓰기 ${Date.now()}`);

  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await page.getByLabel("회차 제목").fill("첫째");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(/1화 · 초안 · .*저장됨/)).toBeVisible();

  await page.getByRole("link", { name: "작품 관리로" }).click();
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await expect(page.getByText(/2화 · 초안/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "회차 제목" })).toHaveValue("");

  await page.getByRole("link", { name: "작품 관리로" }).click();
  await expect(page.getByRole("link", { name: /^1화\. 첫째/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^2화\. 제목 없음/ })).toBeVisible();
});

test("저장하는 동안 쓴 내용도 잃지 않는다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `저장 경합 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);

  // 서버 액션을 늦춰 저장이 진행 중일 때 입력이 들어가게 한다.
  await page.route("**/studio/works/**", async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await editorOf(page).click();
  await page.keyboard.type("앞 문장");
  await expect(page.getByText(/저장 중/)).toBeVisible({ timeout: 5000 });
  await page.keyboard.type(" 뒤 문장");
  // 첫 저장이 끝나도 변경 사항이 남아 있으므로 저장됨으로 표시하면 안 된다.
  await expect(page.getByText(/저장 대기 중|저장 중/)).toBeVisible();
  await expect(page.getByText(/1화 · 초안 · .*저장됨/)).toBeVisible({ timeout: 15_000 });
  await page.unroute("**/studio/works/**");

  await page.reload();
  await expect(editorOf(page)).toContainText("앞 문장 뒤 문장");
});

test("초안은 나갈 때 저장하고, 공개한 회차는 나가기 전에 묻는다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `나가기 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  const url = page.url();

  await editorOf(page).click();
  await page.keyboard.type("바로 나간 원고");
  await page.getByRole("link", { name: "작품 관리로" }).click();
  await expect(page.getByRole("button", { name: "새 회차 쓰기" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goto(url);
  await expect(editorOf(page)).toContainText("바로 나간 원고");

  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/1화 · 공개 중/)).toBeVisible();
  await editorOf(page).click();
  await page.keyboard.type(" 수정");

  const messages: string[] = [];
  page.once("dialog", (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  await page.getByRole("link", { name: "작품 관리로" }).click();
  expect(messages[0]).toContain("저장하지 않은 변경 사항");
  await expect(page).toHaveURL(url);
});

test("뒤로 가기로 나가도 공개 회차의 수정 내용을 복원할 수 있다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `복원 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await editorOf(page).click();
  await page.keyboard.type("공개한 본문");
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/1화 · 공개 중/)).toBeVisible();
  const url = page.url();

  await editorOf(page).click();
  await page.keyboard.type(" 고치던 내용");
  await page.goBack();
  await expect(page.getByRole("button", { name: "새 회차 쓰기" })).toBeVisible();
  // 전체 새로고침으로 숨겨진 편집 화면까지 사라진 뒤 다시 연다.
  await page.reload();
  await page.goto(url);

  await expect(editorOf(page)).not.toContainText("고치던 내용");
  await page.getByRole("button", { name: "복원" }).click();
  await expect(editorOf(page)).toContainText("공개한 본문 고치던 내용");
  // 복원해도 공개 회차는 저장을 눌러야 독자에게 반영된다.
  await expect(page.getByText(/저장하지 않은 변경 사항/)).toBeVisible();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(/1화 · 공개 중 · .*저장됨/)).toBeVisible();

  await page.reload();
  await expect(editorOf(page)).toContainText("공개한 본문 고치던 내용");
  await expect(page.getByRole("button", { name: "복원" })).toHaveCount(0);
});

test("자동 저장이 실패하면 안내하고 다시 시도한다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `재시도 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);

  await page.route("**/studio/works/**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await editorOf(page).click();
  await page.keyboard.type("끊긴 동안 쓴 글");
  await expect(page.getByText(/저장하지 못했습니다\. 잠시 뒤 다시 시도합니다/)).toBeVisible({ timeout: 10_000 });

  await page.unroute("**/studio/works/**");
  await expect(page.getByText(/1화 · 초안 · .*저장됨/)).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(editorOf(page)).toContainText("끊긴 동안 쓴 글");
});

test("초안과 판매 전 작품을 지울 수 있다", async ({ page }) => {
  const title = `삭제 ${Date.now()}`;
  await login(page, AUTHOR, "작가");
  await createWork(page, title);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "작품 관리로" }).click();

  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "삭제: 1화" }).click();
  await expect(page.getByText("아직 쓴 회차가 없습니다.")).toBeVisible();

  await page.getByRole("button", { name: "작품 삭제" }).click();
  await page.waitForURL("/studio");
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
});

test("로그인 유형이 맞지 않으면 안내한다", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("radio", { name: "일반 회원" }).check();
  await page.getByLabel(/이메일/).fill(AUTHOR);
  await page.getByLabel(/비밀번호/).fill("raon1234");
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
  await page.getByLabel(/이메일/).fill(`new${id}@raon.test`);
  await page.getByLabel(/비밀번호/).fill("password1");
  await page.getByLabel(/닉네임/).fill(`작가${String(id).slice(-6)}`);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("/studio");
  await expect(page.getByText("아직 만든 작품이 없습니다")).toBeVisible();
});
