import Link from "next/link";
import { Suspense } from "react";
import { ModeNav } from "@/features/mode-switch";
import { ThemeSwitch } from "@/features/theme-switch";
import styles from "./site-header.module.scss";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`on-panel ${styles.panel}`}>
        <div className={styles.top}>
          <search className={styles.search}>
            <form action="/works">
              <label htmlFor="site-search" className="visually-hidden">
                작품명 또는 작가명 검색
              </label>
              <input id="site-search" type="search" name="q" placeholder="작품명, 작가명" maxLength={50} />
              <button type="submit">검색</button>
            </form>
          </search>
          <Link href="/" className={styles.logo} aria-label="RAON 첫 화면">
            {/* 프레임 위쪽을 페이지 바탕색으로 파낸 듯한 노치. 장식이다. */}
            <svg viewBox="0 0 240 46" preserveAspectRatio="none" aria-hidden="true" data-notch="">
              <path d="M0 0H240L222 38Q218.5 46 210 46H30Q21.5 46 18 38Z" />
            </svg>
            <span>RAON</span>
          </Link>
          <div className={styles.utility}>
            <ThemeSwitch />
            <Suspense fallback={<span className={styles.placeholder} />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
        {/* 주소의 쿼리를 읽으므로 그 부분만 요청 때 그린다. 자리를 미리 잡아 화면이 밀리지 않게 한다. */}
        <Suspense fallback={<div className={styles.navPlaceholder} />}>
          <ModeNav />
        </Suspense>
      </div>
    </header>
  );
}
