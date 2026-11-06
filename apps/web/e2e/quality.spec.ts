import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { AUTHOR, login, READER } from "./helpers";

async function workPath(page: Page, query: string) {
  await page.goto(`/works?q=${encodeURIComponent(query)}`);
  return page.getByRole("heading", { level: 2 }).first().locator("xpath=ancestor::a").getAttribute("href");
}

async function assertClean(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${name}: ${v.id} ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name} 가로 넘침`).toBeLessThanOrEqual(0);
}

const SIZES = [
  { name: "narrow", width: 280, height: 640 },
  { name: "phone", width: 320, height: 640 },
  { name: "desktop", width: 1280, height: 800 },
];

for (const theme of ["light", "dark"] as const) {
  for (const size of SIZES) {
    // 280px는 넘침만 보면 되므로 밝은 화면에서만 돈다.
    if (size.name === "narrow" && theme === "dark") continue;
    test.describe(`${theme} ${size.name}`, () => {
      test.use({ colorScheme: theme, viewport: { width: size.width, height: size.height } });

      test("공개 화면", async ({ page }) => {
        await page.goto("/");
        await assertClean(page, "home");
        await page.goto("/works");
        await assertClean(page, "works");
        await page.goto("/works?q=없는작품검색어");
        await assertClean(page, "no-result");
        const path = await workPath(page, "검은 먹");
        await page.goto(path as string);
        await assertClean(page, "detail");
        await page.goto(`${path}/episodes/1`);
        await assertClean(page, "viewer");
        await page.getByRole("button", { name: "보기 설정" }).click();
        await assertClean(page, "viewer-settings");
        await page.goto(`${path}/episodes/2`);
        await assertClean(page, "viewer-locked");
        await page.goto("/login");
        await assertClean(page, "login");
        await page.goto("/signup");
        await assertClean(page, "signup");
        await page.goto("/없는-주소");
        await assertClean(page, "not-found");
      });

      test("일반 회원 화면", async ({ page }) => {
        await login(page, READER, "일반 회원");
        const path = await workPath(page, "오후 세 시");
        await page.goto(path as string);
        await assertClean(page, "detail-reader");
        await page.goto("/cart");
        await assertClean(page, "cart");
        await page.goto("/my");
        await assertClean(page, "my");
      });

      test("작가 화면", async ({ page }) => {
        await login(page, AUTHOR, "작가");
        await assertClean(page, "studio");
        await page.goto("/studio/works/new");
        await assertClean(page, "studio-new");
        await page.goto("/studio");
        await page.getByRole("link", { name: "등대지기의 마지막 항로" }).click();
        await assertClean(page, "studio-work");
        await page.getByRole("link", { name: "설정집과 메모" }).click();
        await page.getByRole("heading", { level: 1 }).waitFor();
        await page.getByRole("button", { name: "새 문서" }).click();
        await assertClean(page, "studio-notes");
        await page.goBack();
        await page.getByRole("link", { name: /1화/ }).click();
        await assertClean(page, "editor");
        await page.getByRole("button", { name: "찾기·바꾸기" }).click();
        await page.getByRole("textbox", { name: "찾을 글자" }).fill("바다");
        for (const name of [
          "단락 분석",
          "반복 표현",
          "집필 타이머",
          "상용구와 특수문자",
          "버전 기록",
          "이 회차 내보내기",
          "설정집 참조",
          "회차 메모",
        ]) {
          await page.getByText(name, { exact: true }).click();
        }
        await assertClean(page, "editor-tools");
      });
    });
  }
}

test("키보드만으로 본문 바로가기를 쓸 수 있다", async ({ page }) => {
  await page.goto("/works");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "본문 바로가기" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("화면마다 제목이 다르다", async ({ page }) => {
  await page.goto("/works");
  await expect(page).toHaveTitle("전체 작품 | RAON 라온");
  await page.goto("/login");
  await expect(page).toHaveTitle("로그인 | RAON 라온");
});
