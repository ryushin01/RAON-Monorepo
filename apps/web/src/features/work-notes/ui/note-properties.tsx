import type { NoteProperty } from "@raon/contracts";
import styles from "./notes.module.scss";

/** 속성을 이름과 값의 목록으로 보여 준다. */
export function NoteProperties({ properties }: { properties: NoteProperty[] }) {
  if (properties.length === 0) return null;
  return (
    <dl className={styles.properties}>
      {properties.map(({ name, value }, index) => (
        // 같은 이름을 여러 번 쓸 수 있어 위치를 함께 쓴다.
        // biome-ignore lint/suspicious/noArrayIndexKey: 읽기 전용 목록이라 순서가 바뀌지 않는다.
        <div key={`${index}-${name}`}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
