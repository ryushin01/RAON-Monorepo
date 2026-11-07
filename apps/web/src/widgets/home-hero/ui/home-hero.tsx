import { useId } from "react";
import { ButtonLink } from "@/shared/ui";
import styles from "./home-hero.module.scss";
import { TypeSpiral } from "./type-spiral";

export function HomeHero() {
  const titleId = useId();
  return (
    <section className={styles.hero} aria-labelledby={titleId}>
      <div className={styles.copy}>
        <p className={styles.kicker}>웹툰·웹소설 연재 플랫폼</p>
        <h1 id={titleId} className={styles.title}>
          오늘 밤 읽을 이야기,
          <br />
          라온에서.
        </h1>
        <p className={styles.lead}>
          작가는 회차를 연재하고, 독자는 회차나 완결 작품을 골라 코인으로 읽습니다. 읽던 곳은 내 서재에서 이어 봅니다.
        </p>
        <p className={styles.actions}>
          <ButtonLink href="/works">작품 둘러보기</ButtonLink>
          <ButtonLink href="/works?sort=popular" variant="secondary">
            인기순으로 보기
          </ButtonLink>
        </p>
      </div>
      <div className={styles.art}>
        <TypeSpiral />
      </div>
    </section>
  );
}
