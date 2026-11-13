import { type ReactNode, useId } from "react";
import { ButtonLink } from "@/shared/ui";
import styles from "./home-hero.module.scss";

/** 머리글과 이어지는 어두운 첫 화면. children에는 표지 묶음처럼 데이터를 읽는 부분을 넘긴다. */
export function HomeHero({ children }: { children?: ReactNode }) {
  const titleId = useId();
  return (
    <section className={`on-panel ${styles.hero}`} aria-labelledby={titleId} data-hero="">
      <svg className={styles.ridges} viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true">
        <path
          className={styles.far}
          d="M0 200C120 150 220 190 340 150S560 90 700 150 960 230 1090 170 1320 110 1440 165V400H0Z"
        />
        <path
          className={styles.near}
          d="M0 290C150 230 260 300 420 250S690 200 840 262 1120 320 1250 250 1380 225 1440 245V400H0Z"
        />
      </svg>
      <div className={styles.copy}>
        <p className={styles.kicker}>(웹툰·웹소설 연재 플랫폼)</p>
        <h1 id={titleId} className={styles.title}>
          오늘 밤 읽을
          <br />
          이야기, 라온에서.
        </h1>
        <p className={styles.lead}>
          작가는 회차를 연재하고, 독자는 회차나 완결 작품을 골라 코인으로 읽습니다. 읽던 곳은 내 서재에서 이어 봅니다.
        </p>
        <p>
          <ButtonLink href="/works" arrow>
            작품 둘러보기
          </ButtonLink>
        </p>
      </div>
      {children}
    </section>
  );
}
