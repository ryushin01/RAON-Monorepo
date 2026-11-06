import { expect, type Page, test } from "@playwright/test";
import { AUTHOR, login, READER } from "./helpers";

/** 지나간 화면이 숨겨져 남아 있어도 문서가 HTML 표준을 지키는지 본다. */
async function assertDocumentValid(page: Page) {
  const result = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    return {
      mains: document.querySelectorAll("main:not([hidden])").length,
      duplicates: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
    };
  });
  expect(result).toEqual({ mains: 1, duplicates: [] });
}

test.describe("HTML 표준, KWCAG 8.1.1", () => {
  test("화면을 오가도 main은 하나이고 id가 겹치지 않는다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "전체 작품" }).click();
    await page.waitForURL("/works");
    await assertDocumentValid(page);

    await page.getByRole("link", { name: "검은 먹의 강호" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "검은 먹의 강호" })).toBeVisible();
    await assertDocumentValid(page);

    await page.getByRole("link", { name: "첫 화 보기" }).click();
    await expect(page.getByRole("button", { name: "보기 설정" })).toBeVisible();
    await assertDocumentValid(page);

    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "검은 먹의 강호" })).toBeVisible();
    await assertDocumentValid(page);
  });
});

test.describe("KWCAG 운용", () => {
  test("6.4.1 화면을 옮긴 뒤에도 본문 바로가기가 보이는 본문으로 간다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "전체 작품" }).click();
    await page.waitForURL("/works");
    await expect(page.getByRole("heading", { level: 1, name: "전체 작품" })).toBeVisible();

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const skip = page.getByRole("link", { name: "본문 바로가기" });
    await skip.focus();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");

    const focused = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      return { tag: active.tagName, visible: active.checkVisibility(), title: active.querySelector("h1")?.textContent };
    });
    expect(focused).toEqual({ tag: "MAIN", visible: true, title: "전체 작품" });
  });

  test("6.5.3 보이는 글자가 접근 가능한 이름에 들어 있고 맨 앞에 온다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "RAON 첫 화면" })).toBeVisible();
    await expect(page.getByRole("link", { name: "더 보기: 인기 작품" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^첫 화 보기:/ })).toBeVisible();
  });

  test("6.1.3 조작 요소의 대각선 길이가 6mm 이상이다", async ({ page }) => {
    const MIN_DIAGONAL_PX = (6 / 25.4) * 96;
    for (const path of ["/", "/works", "/login"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const small = await page.evaluate((min) => {
        const elements = document.querySelectorAll("button, select, input:not([type=hidden]), textarea, nav a, main a");
        return [...elements]
          .filter((element) => (element as HTMLElement).checkVisibility())
          .filter((element) => {
            const { width, height } = element.getBoundingClientRect();
            return width > 1 && Math.hypot(width, height) < min;
          })
          .map((element) => element.outerHTML.slice(0, 80));
      }, MIN_DIAGONAL_PX);
      expect(small, path).toEqual([]);
    }
  });

  test("6.1.1 키보드만으로 회차를 고르고 장바구니에 담는다", async ({ page }) => {
    await login(page, READER, "일반 회원");
    await page.goto("/works?q=오후");
    await page.getByRole("link", { name: "오후 세 시의 약속" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const checkbox = page.getByRole("checkbox", { name: /3화/ });
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();

    const add = page.getByRole("button", { name: "장바구니 담기" });
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "담았습니다" })).toBeVisible();

    // 6.1.2 처리 후 초점이 문서 밖으로 사라지지 않는다.
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");

    await page.goto("/cart");
    const remove = page.getByRole("button", { name: /^빼기:.*3화/ });
    await remove.focus();
    await page.keyboard.press("Enter");
    await expect(remove).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  });

  test("6.1.2 고정 영역이 초점 받은 요소를 가리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await login(page, READER, "일반 회원");
    await page.goto("/works?q=궤도");
    await page.getByRole("link", { name: "궤도 위의 우체부" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("checkbox", { name: /3화/ }).waitFor();

    for (const name of ["1화", "2화", "3화"]) {
      await page.getByRole("link", { name: new RegExp(`^${name}`) }).focus();
      const covered = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement;
        const { left, top, width, height } = active.getBoundingClientRect();
        const atPoint = document.elementFromPoint(left + width / 2, top + height / 2);
        return !atPoint || !(active === atPoint || active.contains(atPoint));
      });
      expect(covered, name).toBe(false);
    }
  });

  test("6.1.2 가로로 스크롤하는 머리글 메뉴가 초점 표시를 자르지 않는다", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    const space = await nav
      .getByRole("link")
      .first()
      .evaluate((link) => {
        // 초점 표시는 outline 3px와 offset 2px를 합쳐 요소 밖으로 5px 나간다.
        const box = link.getBoundingClientRect();
        const clip = (link.closest("ul") as HTMLElement).getBoundingClientRect();
        return Math.min(box.left - clip.left, box.top - clip.top, clip.bottom - box.bottom);
      });
    expect(space).toBeGreaterThanOrEqual(5);
  });

  test("6.1.3 새 화면의 조작 요소도 6mm 이상이다", async ({ page }) => {
    const MIN_DIAGONAL_PX = (6 / 25.4) * 96;
    const smallControls = () =>
      page.evaluate((min) => {
        const elements = document.querySelectorAll("button, select, input:not([type=hidden]), textarea, nav a, main a");
        return [...elements]
          .filter((element) => (element as HTMLElement).checkVisibility())
          .filter((element) => {
            const { width, height } = element.getBoundingClientRect();
            return width > 1 && Math.hypot(width, height) < min;
          })
          .map((element) => element.outerHTML.slice(0, 80));
      }, MIN_DIAGONAL_PX);

    await login(page, READER, "일반 회원");
    await page.goto("/works?q=유리");
    await page.getByRole("link", { name: "유리 정원의 살인" }).click();
    await expect(page.getByRole("group", { name: "내 별점" })).toBeVisible();
    expect(await smallControls()).toEqual([]);

    await page.context().clearCookies();
    await login(page, AUTHOR, "작가");
    await page.getByRole("link", { name: "등대지기의 마지막 항로" }).click();
    await expect(page.getByRole("button", { name: "새 회차 쓰기" })).toBeVisible();
    expect(await smallControls()).toEqual([]);
  });

  test("6.1.1 별점과 배너를 키보드로 쓴다", async ({ page }) => {
    await page.goto("/");
    const next = page.getByRole("button", { name: "다음 배너" });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/2 \/ 3/)).toBeVisible();
    await expect(next).toBeFocused();

    await login(page, READER, "일반 회원");
    await page.goto("/works?q=오후");
    await page.getByRole("link", { name: "오후 세 시의 약속" }).click();
    const score = page.getByRole("button", { name: "3점" });
    await score.focus();
    await page.keyboard.press("Enter");
    await expect(score).toHaveAttribute("aria-pressed", "true");
    // 저장하는 동안에도 초점을 잃지 않는다(KWCAG 6.1.2).
    await expect(score).toBeFocused();
    await expect(score).toHaveAttribute("aria-disabled", "false");
    await page.keyboard.press("Enter");
    await expect(score).toHaveAttribute("aria-pressed", "false");
  });

  test("6.1.1 표지 올리기와 회차 이동을 키보드로 쓴다", async ({ page }) => {
    await login(page, AUTHOR, "작가");
    await page.getByRole("link", { name: "궤도 위의 우체부" }).click();
    const list = page.getByRole("region", { name: "회차" });
    const down = list.getByRole("button", { name: "아래로: 1화" });
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(list.getByRole("link", { name: /^1화\. 제3돔/ })).toBeVisible();
    await list.getByRole("button", { name: "아래로: 1화" }).focus();
    await page.keyboard.press("Enter");
    await expect(list.getByRole("link", { name: /^1화\. 수신인 불명/ })).toBeVisible();

    const upload = page.getByRole("button", { name: "표지 올리기" });
    await upload.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("표지 이미지")).toBeFocused();
    await expect(page.getByLabel("표지 이미지")).toHaveAccessibleDescription(/이미지 파일을 골라 주세요/);
  });

  test("6.1.1 에디터에서 Tab으로 빠져나올 수 있다", async ({ page }) => {
    await login(page, AUTHOR, "작가");
    await page.getByRole("link", { name: "등대지기의 마지막 항로" }).click();
    await page.getByRole("link", { name: /^1화/ }).click();
    const editor = page.getByRole("textbox", { name: "본문" });
    await editor.focus();
    await page.keyboard.press("Tab");
    await expect(editor).not.toBeFocused();
    await expect(page.getByRole("textbox", { name: /회차 목표/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("checkbox", { name: "무료 회차로 공개" })).toBeFocused();
  });
});

test.describe("KWCAG 이해", () => {
  test("7.3.1 7.3.2 오류의 위치와 이유를 알리고 그 칸으로 초점을 옮긴다", async ({ page }) => {
    await login(page, AUTHOR, "작가");
    await page.goto("/studio/works/new");
    const title = page.getByRole("textbox", { name: "작품명 (필수)" });
    await expect(title).toBeVisible();
    await page.getByRole("button", { name: "작품 만들기" }).click();
    await expect(title).toHaveAccessibleDescription("작품명을 입력해 주세요.");
    await expect(title).toBeFocused();
  });

  test("7.3.3 비밀번호 칸은 저장·자동 완성과 붙여넣기를 막지 않는다", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel(/비밀번호/);
    await expect(password).toHaveAttribute("autocomplete", "current-password");
    await expect(password).not.toHaveAttribute("onpaste", /.*/);
  });
});

test.describe("상태 격리", () => {
  test("로그아웃하면 숨겨진 화면의 개인 정보가 문서에서 사라진다", async ({ page }) => {
    await login(page, READER, "일반 회원");
    await page.getByRole("link", { name: "내 서재" }).click();
    await page.waitForURL("/my");
    await expect(page.getByText(/보유 [\d,]+코인/)).toBeVisible();

    await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "전체 작품" }).click();
    await page.waitForURL("/works");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.innerHTML.includes("보유 "))).toBe(false);
  });
});

test("스크립트가 붙기 전에 로그인 폼을 제출해도 비밀번호가 주소에 남지 않는다", async ({ page }) => {
  // 앱 스크립트를 받지 못하게 해 폼은 보이지만 아직 동작하지 않는 상태를 만든다.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));

  await page.goto("/login");
  await page.getByLabel(/이메일/).fill(READER);
  await page.getByLabel(/비밀번호/).fill("secret-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForLoadState();

  expect(urls.filter((url) => url.includes("secret-password"))).toEqual([]);
});
