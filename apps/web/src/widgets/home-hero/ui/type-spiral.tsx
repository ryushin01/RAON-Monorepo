import { useId } from "react";
import styles from "./home-hero.module.scss";

const SIZE = 800;
const TURNS = 13;
const GAP = 40;
const STEP = 0.2;
const PHRASE = "RAON 라온 WEB NOVEL 웹소설 연재 ";

/** 가운데에서 바깥으로 도는 아르키메데스 나선 경로. 고정된 값이라 서버에서 한 번만 계산한다. */
function spiralPath() {
  const points: string[] = [];
  for (let angle = 0; angle <= TURNS * Math.PI * 2; angle += STEP) {
    const radius = 24 + (GAP * angle) / (Math.PI * 2);
    points.push(
      `${(SIZE / 2 + radius * Math.cos(angle)).toFixed(1)} ${(SIZE / 2 + radius * Math.sin(angle)).toFixed(1)}`,
    );
  }
  return `M${points.join("L")}`;
}

const PATH = spiralPath();
const TEXT = PHRASE.repeat(120);

/** 글자로 그린 장식 나선. 움직이지 않으므로 정지 기능이 필요 없다(KWCAG 6.2.2). */
export function TypeSpiral() {
  const id = useId();
  return (
    <svg
      className={styles.spiral}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-testid="type-spiral"
    >
      <defs>
        <path id={id} d={PATH} />
      </defs>
      <text>
        <textPath href={`#${id}`}>{TEXT}</textPath>
      </text>
    </svg>
  );
}
