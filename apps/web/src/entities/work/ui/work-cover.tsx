import styles from "./work-cover.module.scss";

const PATTERNS = ["lines", "diagonal", "circle", "grid"] as const;

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return result;
}

const TONES = ["teal", "clay", "ochre", "forest", "plum", "dusk", "rose"] as const;

/**
 * 작품 제목으로 만드는 표지. 같은 제목은 항상 같은 표지가 된다.
 * 카드에 제목과 작가를 글자로 함께 보여 주므로 보조기술에는 숨긴다.
 * bare는 카드가 표지 위에 제목을 직접 얹을 때 표지의 글자를 뺀다.
 */
export function WorkCover({
  title,
  authorName,
  imageUrl,
  bare,
}: {
  title: string;
  authorName: string;
  imageUrl?: string;
  bare?: boolean;
}) {
  if (imageUrl) {
    return (
      <div className={styles.cover} aria-hidden="true">
        {/* 제목과 작가를 옆에 글자로 제공하므로 대체 텍스트는 비운다. */}
        {/* biome-ignore lint/performance/noImgElement: 크기를 모르는 사용자 이미지를 같은 출처 라우트에서 그대로 전달한다. */}
        <img className={styles.image} src={imageUrl} alt="" loading="lazy" />
      </div>
    );
  }

  const value = hash(title);
  const pattern = PATTERNS[value % PATTERNS.length] as (typeof PATTERNS)[number];
  const tone = TONES[(value >>> 3) % TONES.length] as (typeof TONES)[number];

  return (
    <div className={`${styles.cover} ${styles[tone]}`} aria-hidden="true" data-pattern={pattern}>
      <div className={`${styles.pattern} ${styles[pattern]}`} />
      {!bare && (
        <>
          <p className={styles.title}>{title}</p>
          <p className={styles.author}>{authorName}</p>
        </>
      )}
    </div>
  );
}
