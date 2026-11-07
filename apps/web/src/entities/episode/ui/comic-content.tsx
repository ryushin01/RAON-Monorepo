import type { ComicImage } from "@raon/contracts";
import styles from "./comic-content.module.scss";

/** 웹툰 회차. 칸이 이어져 보이도록 간격 없이 세로로 붙인다. 크기를 미리 알려 불러오는 동안 화면이 밀리지 않게 한다. */
export function ComicContent({ episodeId, images }: { episodeId: string; images: ComicImage[] }) {
  return (
    <div className={styles.comic}>
      {images.map((image, index) => (
        // biome-ignore lint/performance/noImgElement: 권한을 확인하는 원본을 받으므로 이미지 최적화를 거치지 않는다.
        <img
          key={image.id}
          src={`/api/episodes/${episodeId}/images/${image.id}`}
          alt={image.alt}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          // 첫 화면의 이미지는 바로 받고 나머지는 가까워질 때 받는다.
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </div>
  );
}
