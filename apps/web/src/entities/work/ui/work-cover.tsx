import styles from "./work-cover.module.scss";

const PATTERNS = ["lines", "diagonal", "circle", "grid"] as const;

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return result;
}

/**
 * 작품 제목으로 만드는 흑백 표지. 같은 제목은 항상 같은 표지가 된다.
 * 카드에 제목과 작가를 글자로 함께 보여 주므로 보조기술에는 숨긴다.
 */
export function WorkCover({ title, authorName }: { title: string; authorName: string }) {
  const value = hash(title);
  const pattern = PATTERNS[value % PATTERNS.length] as (typeof PATTERNS)[number];
  const tone = (value >> 3) % 3 === 0 ? styles.light : styles.dark;

  return (
    <div className={`${styles.cover} ${tone}`} aria-hidden="true" data-pattern={pattern}>
      <div className={`${styles.pattern} ${styles[pattern]}`} />
      <p className={styles.title}>{title}</p>
      <p className={styles.author}>{authorName}</p>
    </div>
  );
}
