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

test("저장 중에 더 쓰고 나가도 최신 원고가 남는다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `저장 순서 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  const url = page.url();

  // 첫 저장만 늦춘다. 순서가 뒤집히면 늦게 끝난 첫 저장이 최신 원고를 덮어쓴다.
  let first = true;
  await page.route("**/studio/works/**", async (route) => {
    if (route.request().method() === "POST" && first) {
      first = false;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await route.continue();
  });
  await editorOf(page).click();
  await page.keyboard.type("앞 문장");
  await expect(page.getByText(/저장 중/)).toBeVisible({ timeout: 5000 });
  await page.keyboard.type(" 뒤 문장");
  await page.getByRole("link", { name: "작품 관리로" }).click();
  await expect(page.getByRole("button", { name: "새 회차 쓰기" })).toBeVisible();

  await page.waitForTimeout(3500);
  await page.unroute("**/studio/works/**");
  await page.goto(url);
  await expect(editorOf(page)).toContainText("앞 문장 뒤 문장");
});

test("공개 회차 수정을 버리고 나갔다 돌아오면 제목과 본문이 모두 원래대로다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `되돌림 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await page.getByRole("textbox", { name: "회차 제목" }).fill("원래 제목");
  await editorOf(page).click();
  await page.keyboard.type("원래 본문");
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/1화 · 공개 중/)).toBeVisible();

  await page.getByRole("textbox", { name: "회차 제목" }).fill("버릴 제목");
  await editorOf(page).click();
  await page.keyboard.type(" 버릴 본문");

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("link", { name: "작품 관리로" }).click();
  await expect(page.getByRole("button", { name: "새 회차 쓰기" })).toBeVisible();
  await page.getByRole("link", { name: /^1화/ }).click();

  await expect(editorOf(page)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "회차 제목" })).toHaveValue("원래 제목");
  await expect(editorOf(page)).toHaveText("원래 본문");
  await expect(page.getByText(/저장하지 않은 변경 사항/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "복원" })).toHaveCount(0);
});

test("자동 저장 뒤 나갔다 돌아오면 최신 원고가 보인다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `돌아오기 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await editorOf(page).click();
  await page.keyboard.type("저장된 본문");
  await expect(page.getByText(/1화 · 초안 · .*저장됨/)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "작품 관리로" }).click();
  await expect(page.getByRole("button", { name: "새 회차 쓰기" })).toBeVisible();
  await page.getByRole("link", { name: /^1화/ }).click();
  await expect(editorOf(page)).toHaveText("저장된 본문");
});

test("돌아온 직후 다시 읽는 동안에는 입력 칸을 내려 쓴 글이 사라지지 않는다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `재조회 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await editorOf(page).click();
  await page.keyboard.type("저장한 본문");
  await expect(page.getByText(/1화 · 초안 · .*저장됨/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("link", { name: "작품 관리로" }).click();
  await expect(page.getByRole("button", { name: "새 회차 쓰기" })).toBeVisible();

  await page.route("**/studio/works/**", async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.getByRole("link", { name: /^1화/ }).click();
  await expect(page.getByText("최신 내용을 불러오는 중입니다.")).toBeVisible();
  await expect(editorOf(page)).toHaveCount(0);
  await expect(editorOf(page)).toHaveText("저장한 본문", { timeout: 10_000 });
  await page.unroute("**/studio/works/**");
});

test("Ctrl·Cmd 클릭으로 새 탭을 열어도 편집과 백업이 계속된다", async ({ page, context }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `새 탭 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await editorOf(page).click();
  await page.keyboard.type("공개 본문");
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/1화 · 공개 중/)).toBeVisible();
  await editorOf(page).click();
  await page.keyboard.type(" 고치는 중");

  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: "작품 관리로" }).click({ modifiers: ["ControlOrMeta"] });
  await (await opened).close();
  expect(dialogs).toEqual([]);

  await editorOf(page).click();
  await page.keyboard.type(" 더");
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("raon:episode-backup:")).length),
    )
    .toBe(1);
});

test("자동 저장이 실패한 채 나가려 하면 묻는다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `실패 경고 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  const url = page.url();
  await page.route("**/studio/works/**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await editorOf(page).click();
  await page.keyboard.type("저장 못 한 글");
  await expect(page.getByText(/잠시 뒤 다시 시도합니다/)).toBeVisible({ timeout: 10_000 });
  // 실패한 뒤 더 입력해도, 저장에 성공하기 전까지는 나갈 때 묻는다.
  await page.keyboard.type(" 더 쓴 글");

  const messages: string[] = [];
  page.once("dialog", (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  await page.getByRole("link", { name: "작품 관리로" }).click();
  expect(messages[0]).toContain("저장하지 못했습니다");
  await expect(page).toHaveURL(url);
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

test("복원 여부를 고르기 전에는 백업을 잃지 않는다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `복원 대기 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await editorOf(page).click();
  await page.keyboard.type("공개한 본문");
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/1화 · 공개 중/)).toBeVisible();
  const url = page.url();

  await editorOf(page).click();
  await page.keyboard.type(" 백업된 내용");
  await page.goBack();
  await expect(page.getByRole("button", { name: "새 회차 쓰기" })).toBeVisible();
  await page.reload();
  await page.goto(url);
  const restore = page.getByRole("button", { name: "복원" });
  await expect(restore).toBeVisible();

  // 복원하지 않고 저장해도 백업은 남는다.
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(/1화 · 공개 중 · .*저장됨/)).toBeVisible();
  await page.reload();
  await expect(restore).toBeVisible();

  // 고르기 전에 새로 입력해도 백업을 덮어쓰지 않는다.
  await editorOf(page).click();
  await page.keyboard.type(" 새 입력");
  await page.waitForTimeout(800);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(restore).toBeVisible();

  // 입력한 내용이 있으면 바꾸기 전에 묻고, 취소하면 그대로 둔다.
  await editorOf(page).click();
  await page.keyboard.type(" 지킬 내용");
  page.once("dialog", (dialog) => void dialog.dismiss());
  await restore.click();
  await expect(editorOf(page)).toContainText("지킬 내용");

  page.once("dialog", (dialog) => void dialog.accept());
  await restore.click();
  await expect(editorOf(page)).toContainText("공개한 본문 백업된 내용");
  await expect(editorOf(page)).not.toContainText("지킬 내용");
});

test("줄바꿈이 낀 문단에 서식을 입혀도 저장된다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `줄바꿈 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await editorOf(page).click();
  await page.keyboard.type("앞");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("뒤");
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "굵게" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(/1화 · 초안 · .*저장됨/)).toBeVisible();
  await page.reload();
  const bold = editorOf(page).locator("strong");
  await expect(bold).toContainText("앞");
  await expect(bold).toContainText("뒤");
});

test("다른 탭에서 로그아웃하면 편집 중인 탭도 원고를 브라우저에 남기지 않는다", async ({ page, context }) => {
  await login(page, AUTHOR, "작가");
  await createWork(page, `탭 로그아웃 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  // 에디터가 열린 뒤에 로그아웃해야 이 탭이 그 사실을 구분할 수 있다.
  await expect(editorOf(page)).toBeVisible();
  const backups = () =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("raon:episode-backup:")));

  const other = await context.newPage();
  await other.goto("/works");
  await other.getByRole("button", { name: "로그아웃" }).click();
  await expect(other.getByRole("link", { name: "로그인" })).toBeVisible();
  await other.close();

  await editorOf(page).click();
  await page.keyboard.type("로그아웃 뒤 입력");
  await page.waitForTimeout(800);
  expect(await backups()).toEqual([]);
});

test("예약 공개는 시각 전까지 독자에게 보이지 않고, 취소하면 초안이 된다", async ({ page, browser }) => {
  const title = `예약 ${Date.now()}`;
  await login(page, AUTHOR, "작가");
  await createWork(page, title);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await page.getByRole("textbox", { name: "회차 제목" }).fill("예약 회차");
  await editorOf(page).click();
  await page.keyboard.type("예약한 본문입니다.");

  // 시각을 넣지 않으면 그 칸으로 안내한다.
  await page.getByRole("button", { name: "예약 공개", exact: true }).click();
  await expect(page.getByLabel(/예약 공개 시각/)).toHaveAccessibleDescription(/예약 시각을 입력해 주세요/);

  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel(/예약 공개 시각/).fill(local);
  await page.getByRole("button", { name: "예약 공개", exact: true }).click();
  await expect(page.getByText(/1화 · 예약 /)).toBeVisible();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/works?q=${encodeURIComponent(title)}`);
  await expect(guest.getByText("조건에 맞는 작품이 없습니다")).toBeVisible();
  await guest.close();

  await page.getByRole("button", { name: "예약 취소" }).click();
  await expect(page.getByText(/1화 · 초안/)).toBeVisible();
});

test("예약 시각이 지나면 예약 취소가 사라져 공개 회차를 내릴 수 없다", async ({ page }) => {
  await page.clock.install();
  await login(page, AUTHOR, "작가");
  await createWork(page, `시각 경과 ${Date.now()}`);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await editorOf(page).click();
  await page.keyboard.type("곧 공개될 본문");

  const soon = new Date(Date.now() + 2 * 3600_000);
  const kst = new Date(soon.getTime() + 9 * 3600_000).toISOString().slice(0, 16);
  await page.getByLabel(/예약 공개 시각/).fill(kst);
  await page.getByRole("button", { name: "예약 공개", exact: true }).click();
  await expect(page.getByRole("button", { name: "예약 취소" })).toBeVisible();

  await page.clock.fastForward("03:00:00");
  await expect(page.getByRole("button", { name: "예약 취소" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "비공개로 바꾸기" })).toBeVisible();
  await expect(page.getByText(/1화 · 공개 중/)).toBeVisible();
});

test("회차 순서를 버튼으로 바꾼다", async ({ page }) => {
  await login(page, AUTHOR, "작가");
  await page.getByRole("link", { name: "기억을 파는 골목" }).click();
  const list = page.getByRole("region", { name: "회차" });
  await expect(list.getByRole("link", { name: /^1화\. 환불 불가/ })).toBeVisible();
  await expect(list.getByRole("button", { name: "위로: 1화" })).toBeDisabled();
  await list.getByRole("button", { name: "위로: 2화" }).click();
  await expect(list.getByRole("link", { name: /^1화\. 영수증/ })).toBeVisible();
  // 다른 테스트에 영향이 없도록 되돌린다.
  await list.getByRole("button", { name: "위로: 2화" }).click();
  await expect(list.getByRole("link", { name: /^1화\. 환불 불가/ })).toBeVisible();
});

test("표지를 올리면 독자 화면에 보이고, 지우면 제목 표지로 돌아간다", async ({ page, browser }) => {
  const title = `표지 ${Date.now()}`;
  await login(page, AUTHOR, "작가");
  await createWork(page, title);
  await page.getByRole("button", { name: "새 회차 쓰기" }).click();
  await page.waitForURL(/\/episodes\/[0-9a-f-]{36}$/);
  await editorOf(page).click();
  await page.keyboard.type("표지 테스트 본문");
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/1화 · 공개 중/)).toBeVisible();
  await page.getByRole("link", { name: "작품 관리로" }).click();

  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("표지 이미지").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "표지 올리기" }).click();
  await expect(page.getByRole("status").filter({ hasText: "표지를 올렸습니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "표지 지우기" })).toBeVisible();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/works?q=${encodeURIComponent(title)}`);
  const image = guest.locator('img[src^="/api/covers/"]').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1);
  await guest.close();

  await page.getByRole("button", { name: "표지 지우기" }).click();
  await expect(page.getByRole("button", { name: "표지 지우기" })).toHaveCount(0);
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
  // 누른 버튼이 사라져도 초점을 잃지 않는다(KWCAG 6.1.2).
  await expect(page.getByRole("heading", { level: 2, name: "회차" })).toBeFocused();

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
