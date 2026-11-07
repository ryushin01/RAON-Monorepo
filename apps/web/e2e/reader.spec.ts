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

test("댓글에 답글을 달고 공감하며, 공감순으로 보고, 지운 댓글은 자리를 남긴다", async ({ page, browser }) => {
  await login(page, READER, "일반 회원");
  await page.goto("/works?q=등대지기");
  await page.getByRole("link", { name: "등대지기의 마지막 항로" }).click();
  await page.getByRole("link", { name: /^1화/ }).click();
  await page.waitForURL(/episodes\/1$/);
  const stamp = Date.now();
  const comment = `부모 댓글 ${stamp}`;
  const section = page.getByRole("region", { name: "댓글" });

  await section.getByRole("textbox", { name: /댓글 쓰기/ }).fill(comment);
  await section.getByRole("button", { name: "등록", exact: true }).click();
  const item = section.getByRole("listitem").filter({ hasText: comment });
  await expect(item).toBeVisible();

  await item
    .getByRole("button", { name: /^답글: / })
    .first()
    .click();
  await expect(page.getByRole("textbox", { name: /답글 쓰기/ })).toBeFocused();
  await page.keyboard.type(`답글 ${stamp}`);
  await page.getByRole("button", { name: "답글 등록" }).click();
  const replies = item.getByRole("list", { name: "답글 1개" });
  await expect(replies).toContainText(`답글 ${stamp}`);

  const like = item.getByRole("button", { name: /^공감 0: / }).first();
  await like.click();
  await expect(item.getByRole("button", { name: /^공감 1: / }).first()).toHaveAttribute("aria-pressed", "true");

  await section.getByRole("link", { name: "공감순" }).click();
  await expect(page).toHaveURL(/commentSort=likes/);
  await expect(section.getByRole("link", { name: "✓ 공감순" })).toHaveAttribute("aria-current", "true");

  await item.getByRole("button", { name: /의 댓글$/ }).click();
  await expect(section.getByRole("heading", { level: 2, name: /^댓글/ })).toBeFocused();
  const left = section
    .getByRole("listitem")
    .filter({ hasText: `답글 ${stamp}` })
    .first();
  await expect(left).toContainText("삭제된 댓글입니다.");
  await expect(page.getByText(comment)).toHaveCount(0);

  // 로그인하지 않으면 지운 내용도 공감 버튼도 없다.
  const guest = await (await browser.newContext()).newPage();
  const response = await guest.goto(page.url());
  expect(await response?.text()).not.toContain(comment);
  await expect(guest.getByRole("button", { name: /^공감 / })).toHaveCount(0);
  await guest.context().close();

  // 다음 실행을 위해 남은 답글을 지우면 자리도 사라진다.
  await left.getByRole("button", { name: /의 답글$/ }).click();
  await expect(page.getByText(`답글 ${stamp}`)).toHaveCount(0);
  await expect(section.getByText("삭제된 댓글입니다.")).toHaveCount(0);
});

test("모드를 바꾸면 그 형식의 첫 화면과 메뉴로 가고, 첫 화면이 마지막 모드로 열린다", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(nav.getByRole("link", { name: "웹소설" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { name: "인기 작품" })).toBeVisible();

  await nav.getByRole("link", { name: "웹툰" }).click();
  await page.waitForURL("/webtoon");
  await expect(nav.getByRole("link", { name: "웹툰" })).toHaveAttribute("aria-current", "true");
  await expect(nav.getByRole("link", { name: "무협" })).toHaveAttribute("href", "/works?format=COMIC&genre=MARTIAL");

  // 쿠키에 기억하므로 첫 화면을 새로 열어도 웹툰 모드다.
  await page.goto("/");
  await expect(nav.getByRole("link", { name: "웹툰" })).toHaveAttribute("aria-current", "true");

  await page.goto("/works?format=NOVEL");
  await expect(page.getByRole("heading", { level: 1, name: "전체 웹소설" })).toBeVisible();
  await expect(page.getByRole("group", { name: "형식" }).getByRole("link", { name: "웹소설" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(nav.getByRole("link", { name: "웹소설" })).toHaveAttribute("aria-current", "true");
});

test("웹툰을 세로로 이어 보고, 유료 회차는 이미지 없이 잠기며, 자동 스크롤을 켜고 끈다", async ({ page }) => {
  await page.goto("/webtoon");
  await expect(page.getByRole("link", { name: /밤바다 우체국/ }).first()).toBeVisible();
  await page.goto("/works?format=COMIC&q=밤바다");
  await page.getByRole("link", { name: "밤바다 우체국" }).click();
  await page.getByRole("link", { name: /^1화/ }).click();
  await page.waitForURL(/episodes\/1$/);

  const panels = page.getByRole("article").getByRole("img");
  await expect(panels).toHaveCount(3);
  await expect(panels.first()).toHaveAttribute("alt", /달이 뜬 밤/);
  await expect
    .poll(() => panels.first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth))
    .toBeGreaterThan(0);
  // 로그아웃한 뒤에도 남지 않도록 브라우저에 캐시하지 않는다.
  const imageResponse = await page.request.get((await panels.first().getAttribute("src")) as string);
  expect(imageResponse.headers()["cache-control"]).toContain("no-store");
  // 글자 본문용 보기 설정은 없다.
  await expect(page.getByRole("button", { name: /보기 설정/ })).toHaveCount(0);
  // 칸이 이어져 보이도록 사이에 간격이 없다.
  const gap = await panels.evaluateAll((items) => {
    const [first, second] = items.map((item) => item.getBoundingClientRect());
    return (second?.top ?? 0) - (first?.bottom ?? 0);
  });
  expect(Math.abs(gap)).toBeLessThan(1);

  const nav = page.getByRole("navigation", { name: "회차 이동" });
  await expect(nav.getByText("첫 회차")).toBeVisible();
  await expect(nav.getByRole("link", { name: /^다음 화: 2화/ })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 500 });
  const before = await page.evaluate(() => window.scrollY);
  await nav.getByRole("button", { name: "자동 스크롤" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  // 직접 스크롤하면 멈춘다.
  await page.mouse.wheel(0, 10);
  await expect(nav.getByRole("button", { name: "자동 스크롤" })).toHaveAttribute("aria-pressed", "false");

  await nav.getByRole("link", { name: /^다음 화: 2화/ }).click();
  await page.waitForURL(/episodes\/2$/);
  await expect(page.getByText(/유료 회차입니다/)).toBeVisible();
  await expect(page.getByRole("article").getByRole("img")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "자동 스크롤" })).toHaveCount(0);
});
