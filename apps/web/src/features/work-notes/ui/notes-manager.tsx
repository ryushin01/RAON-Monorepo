"use client";

import { NOTE_KINDS, type NoteKind, type WorkNote, type WorkSearchResult } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button, Notice, SelectField, TextAreaField, TextField } from "@/shared/ui";
import { deleteNote, saveNote, searchWork } from "../api/actions";
import styles from "./notes.module.scss";
import { useNotes } from "./use-notes";

const KIND_LABEL: Record<NoteKind, string> = { SETTING: "설정", MEMO: "메모" };

class FormError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const parseAliases = (value: string) =>
  value
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean);

function NoteForm({
  workId,
  note,
  onSaved,
  onCancel,
}: {
  workId: string;
  note: WorkNote | null;
  onSaved: (saved: WorkNote) => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const result = await saveNote(workId, note?.id ?? null, {
        kind: String(form.get("kind")) as NoteKind,
        category: String(form.get("category")),
        title: String(form.get("title")),
        aliases: parseAliases(String(form.get("aliases"))),
        body: String(form.get("body")),
        episodeId: note?.episodeId ?? null,
      });
      if (!result.ok) throw new FormError(result.message, result.fieldErrors);
      return result.data;
    },
    onSuccess: onSaved,
  });
  const fieldErrors = save.error instanceof FormError ? save.error.fieldErrors : undefined;
  const aliasError = Object.entries(fieldErrors ?? {}).find(([key]) => key.startsWith("aliases"))?.[1];

  // 처음 열 때와 오류가 있을 때 해당 칸으로 초점을 옮긴다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 새 오류가 올 때마다 초점을 다시 옮기려고 넣었다.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [name="title"]')?.focus();
  }, [fieldErrors]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!save.isPending) save.mutate(new FormData(event.currentTarget));
  };

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
      <h2 className={styles.subheading}>{note ? "문서 고치기" : "새 문서"}</h2>
      {/* 회차 메모는 종류를 바꿀 수 없다. */}
      {note?.episodeId ? (
        <input type="hidden" name="kind" value="MEMO" />
      ) : (
        <SelectField label="종류" name="kind" defaultValue={note?.kind ?? "SETTING"} error={fieldErrors?.kind}>
          {NOTE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </option>
          ))}
        </SelectField>
      )}
      <TextField
        label="제목"
        name="title"
        defaultValue={note?.title}
        required
        maxLength={60}
        error={fieldErrors?.title}
      />
      <TextField
        label="분류"
        name="category"
        defaultValue={note?.category}
        maxLength={20}
        hint="인물, 장소처럼 묶을 이름입니다. 비워 두어도 됩니다."
        error={fieldErrors?.category}
      />
      <TextField
        label="다른 이름"
        name="aliases"
        defaultValue={note?.aliases.join(", ")}
        hint="쉼표로 나누어 씁니다. 검색할 때 함께 찾습니다."
        error={aliasError}
      />
      <TextAreaField
        label="내용"
        name="body"
        defaultValue={note?.body}
        rows={8}
        maxLength={20_000}
        error={fieldErrors?.body}
      />
      {save.error && !fieldErrors && <Notice tone="error">{save.error.message}</Notice>}
      <div className={styles.actions}>
        <Button type="submit" small aria-disabled={save.isPending}>
          문서 저장
        </Button>
        <Button type="button" variant="ghost" small onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

function WorkSearch({ workId, onOpenNote }: { workId: string; onOpenNote: (id: string) => void }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [inputError, setInputError] = useState("");
  const search = useMutation({
    mutationFn: async (q: string) => {
      const result = await searchWork(workId, q);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
  const data: WorkSearchResult | undefined = search.data;
  const total = data ? data.episodes.length + data.notes.length : 0;

  return (
    <section aria-label="작품 전체 검색">
      <search>
        <form
          className={styles.searchForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!query.trim()) {
              setInputError("검색어를 입력해 주세요.");
              return;
            }
            setInputError("");
            if (!search.isPending) search.mutate(query.trim());
          }}
        >
          <label htmlFor={inputId} className={styles.label}>
            작품 전체 검색(회차 본문과 문서)
          </label>
          <div className={styles.searchRow}>
            <input
              id={inputId}
              className={styles.input}
              type="search"
              value={query}
              maxLength={50}
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? `${inputId}-error` : undefined}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button type="submit" variant="secondary" small>
              검색
            </Button>
          </div>
          {inputError && (
            <p id={`${inputId}-error`} className={styles.error}>
              {inputError}
            </p>
          )}
        </form>
      </search>
      <p className={styles.note} role="status">
        {data ? `${total}건 찾았습니다.` : ""}
      </p>
      {search.error && <Notice tone="error">{search.error.message}</Notice>}
      {data && total > 0 && (
        <ul className={styles.results}>
          {data.episodes.map((hit) => (
            <li key={hit.id}>
              <Link href={`/studio/works/${workId}/episodes/${hit.id}`}>
                {hit.number}화. {hit.title}
              </Link>
              <p className={styles.note}>
                {hit.matches}곳 · {hit.snippet}
              </p>
            </li>
          ))}
          {data.notes.map((hit) => (
            <li key={hit.id}>
              <Button
                variant="ghost"
                small
                type="button"
                aria-label={`검색 결과 열기: ${hit.title}`}
                onClick={() => onOpenNote(hit.id)}
              >
                {KIND_LABEL[hit.kind]}: {hit.title}
              </Button>
              <p className={styles.note}>
                {hit.matches}곳 · {hit.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const FILTERS = ["ALL", ...NOTE_KINDS] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = { ALL: "전체", ...KIND_LABEL };

export function NotesManager({
  workId,
  episodeNumbers = {},
}: {
  workId: string;
  /** 회차 메모에 몇 화인지 보여 주기 위한 표. */
  episodeNumbers?: Record<string, number>;
}) {
  const { data, error, isPending, invalidate } = useNotes(workId);
  const [editing, setEditing] = useState<WorkNote | "new" | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [message, setMessage] = useState("");
  const listHeading = useRef<HTMLHeadingElement>(null);

  const remove = useMutation({
    mutationFn: async (note: WorkNote) => {
      const result = await deleteNote(note.id);
      if (!result.ok) throw new Error(result.message);
      return note;
    },
    onSuccess: async (note) => {
      await invalidate();
      setMessage(`‘${note.title}’ 문서를 지웠습니다.`);
      if (editing !== "new" && editing?.id === note.id) setEditing(null);
      // 눌렀던 버튼이 사라지므로 초점을 목록 제목으로 옮긴다.
      listHeading.current?.focus();
    },
  });

  const visible = (data ?? []).filter((note) => filter === "ALL" || note.kind === filter);
  const groups = new Map<string, WorkNote[]>();
  for (const note of visible) {
    const key = note.category || (note.kind === "MEMO" ? "메모" : "분류 없음");
    groups.set(key, [...(groups.get(key) ?? []), note]);
  }

  return (
    <div className={styles.manager}>
      <WorkSearch
        workId={workId}
        onOpenNote={(id) => {
          const note = data?.find((item) => item.id === id);
          if (note) setEditing(note);
        }}
      />

      {editing ? (
        <NoteForm
          key={editing === "new" ? "new" : editing.id}
          workId={workId}
          note={editing === "new" ? null : editing}
          onCancel={() => {
            setEditing(null);
            listHeading.current?.focus();
          }}
          onSaved={async (saved) => {
            await invalidate();
            setEditing(null);
            setMessage(`‘${saved.title}’ 문서를 저장했습니다.`);
            listHeading.current?.focus();
          }}
        />
      ) : (
        <div>
          <Button small onClick={() => setEditing("new")}>
            새 문서
          </Button>
        </div>
      )}

      <section aria-label="문서 목록">
        <h2 ref={listHeading} className={styles.subheading} tabIndex={-1}>
          문서 목록
        </h2>
        <p className={styles.note} role="status">
          {message}
        </p>
        {/* biome-ignore lint/a11y/useSemanticElements: 입력 요소가 아닌 버튼 묶음이라 fieldset이 맞지 않는다. */}
        <div className={styles.filters} role="group" aria-label="문서 종류">
          {FILTERS.map((item) => (
            <Button
              key={item}
              variant={filter === item ? "primary" : "secondary"}
              small
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {filter === item ? `✓ ${FILTER_LABEL[item]}` : FILTER_LABEL[item]}
            </Button>
          ))}
        </div>
        {(error ?? remove.error) && <Notice tone="error">{(error ?? remove.error)?.message}</Notice>}
        {isPending && <p aria-busy="true">문서를 불러오는 중입니다.</p>}
        {data && visible.length === 0 && <p className={styles.note}>아직 문서가 없습니다.</p>}
        {[...groups].map(([group, notes]) => (
          <section key={group} aria-label={group} className={styles.group}>
            <h3 className={styles.groupTitle}>{group}</h3>
            <ul className={styles.list}>
              {notes.map((note) => (
                <li key={note.id}>
                  <h4 className={styles.noteTitle}>
                    {note.episodeId && episodeNumbers[note.episodeId] !== undefined
                      ? `${episodeNumbers[note.episodeId]}화 메모`
                      : note.title}
                  </h4>
                  {note.aliases.length > 0 && <p className={styles.note}>다른 이름: {note.aliases.join(", ")}</p>}
                  {note.body && <p className={styles.body}>{note.body}</p>}
                  <div className={styles.actions}>
                    <Button
                      variant="secondary"
                      small
                      aria-label={`고치기: ${note.title}`}
                      onClick={() => setEditing(note)}
                    >
                      고치기
                    </Button>
                    <Button
                      variant="ghost"
                      small
                      aria-label={`삭제: ${note.title}`}
                      aria-disabled={remove.isPending}
                      onClick={() => {
                        if (!remove.isPending && window.confirm(`‘${note.title}’ 문서를 지울까요?`)) {
                          remove.mutate(note);
                        }
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}
