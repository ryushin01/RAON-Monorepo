import type { WorkNote } from "@raon/contracts";
import styles from "./note-link-card.module.scss";

/** 커서가 놓인 설정 이름의 문서를 보여 준다. 읽기 전용이며 고치려면 설정집 화면으로 간다. */
export function NoteLinkCard({
  note,
}: {
  note: Pick<WorkNote, "title" | "category" | "aliases" | "properties" | "body">;
}) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: 긴 문서를 키보드로 스크롤할 수 있게 초점을 받는다(KWCAG 6.1.1).
    <aside className={styles.card} aria-label="커서가 놓인 설정" tabIndex={0}>
      <h3 className={styles.title}>
        {note.category && <span className={styles.meta}>{note.category} </span>}
        {note.title}
      </h3>
      {note.aliases.length > 0 && <p className={styles.meta}>다른 이름: {note.aliases.join(", ")}</p>}
      {note.properties.length > 0 && (
        <dl className={styles.properties}>
          {note.properties.map(({ name, value }, index) => (
            // 같은 이름을 여러 번 쓸 수 있어 위치를 함께 쓴다.
            // biome-ignore lint/suspicious/noArrayIndexKey: 읽기 전용 목록이라 순서가 바뀌지 않는다.
            <div key={`${index}-${name}`}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {note.body && <p className={styles.body}>{note.body}</p>}
    </aside>
  );
}
