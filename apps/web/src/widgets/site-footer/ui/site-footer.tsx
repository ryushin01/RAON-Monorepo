import { useId } from "react";
import { ButtonLink } from "@/shared/ui";
import styles from "./site-footer.module.scss";

export function SiteFooter() {
  const titleId = useId();
  return (
    <footer className={styles.footer}>
      <div className="page">
        <section className={styles.panel} aria-labelledby={titleId}>
          <span className={styles.circle} aria-hidden="true" />
          <div className={styles.invite}>
            <p className={styles.label}>작가 스튜디오</p>
            <h2 id={titleId} className={styles.title}>
              당신의 이야기를
              <br />
              연재해 보세요.
            </h2>
            <p className={styles.lead}>작품을 만들고 회차를 올리면 바로 연재가 시작됩니다.</p>
            <ButtonLink href="/studio" arrow>
              연재 시작하기
            </ButtonLink>
          </div>
          <div className={styles.meta}>
            <p>
              <strong>RAON</strong> 웹툰·웹소설 연재 플랫폼
            </p>
            <p>이 사이트의 작품과 결제는 모두 가상입니다.</p>
          </div>
        </section>
      </div>
    </footer>
  );
}
