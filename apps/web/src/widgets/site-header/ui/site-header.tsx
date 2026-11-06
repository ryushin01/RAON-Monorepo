import { GENRE_LABEL, GENRES } from "@raon/contracts";
import Link from "next/link";
import { Suspense } from "react";
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
        <nav className={styles.nav} aria-label="주요 메뉴">
          <ul>
            <li>
              <Link href="/works">전체 작품</Link>
            </li>
            <li>
              <Link href="/works?status=COMPLETED">완결</Link>
            </li>
            {GENRES.map((genre) => (
              <li key={genre}>
                <Link href={`/works?genre=${genre}`}>{GENRE_LABEL[genre]}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
