import { type Page, test } from "@playwright/test";
import { AUTHOR, login, READER } from "../e2e/helpers";

// README의 스크린샷을 다시 찍는다: yarn screenshots
const shot = async (page: Page, name: string) => {
  // 호버 전환 도중에 찍히지 않게 포인터를 치운다.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `../../docs/images/${name}.jpg`, type: "jpeg", quality: 82 });
};

test.use({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });

test("README 스크린샷", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await shot(page, "home");
  await page.goto("/works");
  await page.waitForLoadState("networkidle");
  await shot(page, "works");

  await page.goto("/webtoon");
  await page.waitForLoadState("networkidle");
  await shot(page, "webtoon-home");
  await page.goto("/works?format=COMIC&q=밤바다");
  await page.getByRole("link", { name: "밤바다 우체국" }).click();
  await page.getByRole("link", { name: /^1화/ }).click();
  await page.waitForURL(/episodes\/1$/);
  await page.waitForLoadState("networkidle");
  await shot(page, "webtoon-viewer");

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

  // 집필 도구: 찾기와 단락 분석을 펼친다.
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.getByRole("button", { name: "찾기·바꾸기" }).click();
  await page.getByRole("textbox", { name: "찾을 글자" }).fill("등대");
  await page.getByText("단락 분석", { exact: true }).click();
  await page.getByRole("button", { name: "찾기·바꾸기" }).scrollIntoViewIfNeeded();
  await shot(page, "editor-tools");

  // 버전을 남기고 본문을 고쳐 비교한다. 공개 회차는 자동 저장하지 않으므로 고친 내용은 저장되지 않는다.
  await page.getByText("버전 기록", { exact: true }).click();
  await page.getByRole("textbox", { name: "버전 이름" }).fill("초고");
  await page.getByRole("button", { name: "지금 버전 남기기" }).click();
  await page.getByRole("button", { name: "비교: 초고" }).waitFor();
  // 마지막 줄의 오른쪽 끝을 눌러 커서를 본문 끝에 둔다. 운영체제마다 End 키의 동작이 다르다.
  const lastParagraph = page.getByRole("textbox", { name: "본문" }).locator("p").last();
  const box = await lastParagraph.boundingBox();
  await lastParagraph.click({ position: { x: (box?.width ?? 1) - 2, y: (box?.height ?? 1) - 2 } });
  // 에디터가 클릭한 위치를 읽기 전에 키를 누르면 문서 맨 앞에 입력된다. 사람의 입력 속도에서는 일어나지 않는다.
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.keyboard.type("그 신호는 분명 등대를 부르고 있었다.");
  await page.getByRole("button", { name: "비교: 초고" }).click();
  await page.locator("ins").first().waitFor();
  await page.getByRole("region", { name: /비교/ }).scrollIntoViewIfNeeded();
  await shot(page, "editor-versions");

  // 설정집: 가상의 설정 문서를 만든다.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "작품 관리로" }).click();
  await page.getByRole("link", { name: "설정집과 메모" }).click();
  for (const [title, category, aliases, body] of [
    ["이안", "인물", "등대지기, 막내", "소금 사막의 마지막 등대지기. 할머니의 할머니 때부터 불을 지켜 왔다."],
    ["소금 사막", "장소", "마른 바다", "3백 년 전에 바다가 마른 자리. 지평선까지 소금뿐이다."],
  ] as const) {
    await page.getByRole("button", { name: "새 문서" }).click();
    await page.getByRole("textbox", { name: /제목/ }).fill(title);
    await page.getByRole("textbox", { name: "분류" }).fill(category);
    await page.getByRole("textbox", { name: /다른 이름/ }).fill(aliases);
    await page.getByRole("textbox", { name: "내용" }).fill(body);
    await page.getByRole("button", { name: "문서 저장" }).click();
    await page.getByRole("heading", { name: title }).waitFor();
  }
  await page.getByRole("searchbox", { name: /작품 전체 검색/ }).fill("등대");
  await page.getByRole("button", { name: "검색", exact: true }).last().click();
  await page.getByText(/건 찾았습니다/).waitFor();
  await page.setViewportSize({ width: 1280, height: 1500 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "notes");
});
