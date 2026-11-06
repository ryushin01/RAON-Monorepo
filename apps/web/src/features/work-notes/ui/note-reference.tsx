"use client";

import { useId, useState } from "react";
import { Notice } from "@/shared/ui";
import styles from "./notes.module.scss";
import { useNotes } from "./use-notes";

/** 글을 쓰면서 설정을 찾아 읽는다. 고치려면 설정집 화면으로 간다. */
export function NoteReference({ workId }: { workId: string }) {
  const { data, error, isPending } = useNotes(workId);
  const [query, setQuery] = useState("");
  const inputId = useId();
  const needle = query.trim().toLowerCase();
  const notes = (data ?? []).filter(
    (note) =>
      note.kind === "SETTING" &&
      (!needle ||
        [note.title, note.category, ...note.aliases, note.body].some((text) => text.toLowerCase().includes(needle))),
  );

  return (
    <>
      <search className={styles.field}>
        <label htmlFor={inputId} className={styles.label}>
          설정 찾기
        </label>
        <input
          id={inputId}
          className={styles.input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </search>
      {error && <Notice tone="error">{error.message}</Notice>}
      {isPending && <p aria-busy="true">설정을 불러오는 중입니다.</p>}
      {data && notes.length === 0 && (
        <p className={styles.note}>{needle ? "찾은 설정이 없습니다." : "아직 설정 문서가 없습니다."}</p>
      )}
      <ul className={styles.reference}>
        {notes.map((note) => (
          <li key={note.id}>
            <h4 className={styles.referenceTitle}>
              {note.category && <span className={styles.category}>{note.category} </span>}
              {note.title}
            </h4>
            {note.aliases.length > 0 && <p className={styles.note}>다른 이름: {note.aliases.join(", ")}</p>}
            {note.body && <p className={styles.body}>{note.body}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
