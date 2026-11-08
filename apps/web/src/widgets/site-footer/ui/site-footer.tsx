import Link from "next/link";
import { useId } from "react";
import { ButtonLink } from "@/shared/ui";
import styles from "./site-footer.module.scss";

const MENUS = [
  {
    title: "둘러보기",
    links: [
      ["웹툰", "/webtoon"],
      ["웹소설", "/novel"],
      ["전체 작품", "/works"],
    ],
  },
  {
    title: "내 활동",
    links: [
      ["서재", "/my"],
      ["담은 작품", "/cart"],
      ["스튜디오", "/studio"],
    ],
  },
] as const;

export function SiteFooter() {
  const titleId = useId();
  return (
    <footer className={`on-panel ${styles.footer}`}>
      <div className={`page ${styles.inner}`}>
        <section className={styles.invite} aria-labelledby={titleId}>
          <p>(작가 스튜디오)</p>
          <h2 id={titleId} className={styles.title}>
            당신의 이야기를
            <br />
            연재해 보세요.
          </h2>
          <p className={styles.lead}>작품을 만들고 회차를 올리면 바로 연재가 시작됩니다.</p>
          <ButtonLink href="/studio" arrow>
            연재 시작하기
          </ButtonLink>
        </section>
        <div className={styles.bottom}>
          <p className={styles.meta}>
            RAON 웹툰·웹소설 연재 플랫폼
            <br />이 사이트의 작품과 결제는 모두 가상입니다.
          </p>
          <nav className={styles.menus} aria-label="바닥글 메뉴">
            {MENUS.map((menu) => (
              <div key={menu.title} className={styles.menu}>
                <p>{menu.title}</p>
                <ul>
                  {menu.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href}>{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
      {/* 화면 폭에 꼭 맞는 커다란 이름. 장식이다. */}
      <svg className={styles.wordmark} viewBox="0 0 1000 300" aria-hidden="true">
        <text x="0" y="345" textLength="1000" lengthAdjust="spacingAndGlyphs">
          RAON
        </text>
      </svg>
    </footer>
  );
}
