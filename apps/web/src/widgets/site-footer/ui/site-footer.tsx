import styles from "./site-footer.module.scss";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="page">
        <p>
          <strong>RAON</strong> 웹툰·웹소설 연재 플랫폼
        </p>
        <p>이 사이트의 작품과 결제는 모두 가상입니다.</p>
      </div>
    </footer>
  );
}
