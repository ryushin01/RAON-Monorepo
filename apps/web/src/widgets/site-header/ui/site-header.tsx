import Link from "next/link";
import { Suspense } from "react";
import { ModeNav } from "@/features/mode-switch";
import { ThemeSwitch } from "@/features/theme-switch";
import styles from "./site-header.module.scss";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.panel}>
        <div className={styles.top}>
          <Link href="/" className={styles.logo} aria-label="RAON 첫 화면">
            RAON
          </Link>
          <search className={styles.search}>
            <form action="/works">
              <label htmlFor="site-search" className="visually-hidden">
                작품명 또는 작가명 검색
              </label>
              <input id="site-search" type="search" name="q" placeholder="작품명, 작가명" maxLength={50} />
              <button type="submit">검색</button>
            </form>
          </search>
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
