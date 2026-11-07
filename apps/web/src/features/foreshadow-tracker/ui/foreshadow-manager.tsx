"use client";

import type { Foreshadow } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, Notice, SelectField, TextAreaField, TextField } from "@/shared/ui";
import { deleteForeshadow, saveForeshadow } from "../api/actions";
import { describeForeshadow, type EpisodeOption, isResolved } from "../model/foreshadow";
import styles from "./foreshadow.module.scss";
import { useForeshadows } from "./use-foreshadows";

class FormError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

function EpisodeSelect({
  label,
  name,
  value,
  episodes,
  error,
}: {
  label: string;
  name: string;
  value: string | null | undefined;
  episodes: EpisodeOption[];
  error?: string;
}) {
  return (
    <SelectField label={label} name={name} defaultValue={value ?? ""} error={error}>
      <option value="">고르지 않음</option>
      {episodes.map((episode) => (
        <option key={episode.id} value={episode.id}>
          {episode.number}화. {episode.title}
          {episode.trashed ? " (휴지통)" : ""}
        </option>
      ))}
    </SelectField>
  );
}

function ForeshadowForm({
  workId,
  foreshadow,
  episodes,
  onSaved,
  onCancel,
}: {
  workId: string;
  foreshadow: Foreshadow | null;
  episodes: EpisodeOption[];
  onSaved: (saved: Foreshadow) => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const result = await saveForeshadow(workId, foreshadow?.id ?? null, {
        title: String(form.get("title")),
        body: String(form.get("body")),
        plantedEpisodeId: String(form.get("plantedEpisodeId")) || null,
        resolvedEpisodeId: String(form.get("resolvedEpisodeId")) || null,
      });
      if (!result.ok) throw new FormError(result.message, result.fieldErrors);
      return result.data;
    },
    onSuccess: onSaved,
  });
  const fieldErrors = save.error instanceof FormError ? save.error.fieldErrors : undefined;

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
      <h3 className={styles.heading}>{foreshadow ? "복선 고치기" : "새 복선"}</h3>
      <TextField
        label="복선 이름"
        name="title"
        defaultValue={foreshadow?.title}
        required
        maxLength={60}
        error={fieldErrors?.title}
      />
      <TextAreaField
        label="내용"
        name="body"
        defaultValue={foreshadow?.body}
        rows={4}
        maxLength={2000}
        hint="어떻게 심었고 어떻게 풀지 적어 둡니다."
        error={fieldErrors?.body}
      />
      <EpisodeSelect
        label="심은 회차"
        name="plantedEpisodeId"
        value={foreshadow?.plantedEpisodeId}
        episodes={episodes}
        error={fieldErrors?.plantedEpisodeId}
      />
      <EpisodeSelect
        label="회수한 회차"
        name="resolvedEpisodeId"
        value={foreshadow?.resolvedEpisodeId}
        episodes={episodes}
        error={fieldErrors?.resolvedEpisodeId}
      />
      {save.error && !fieldErrors && <Notice tone="error">{save.error.message}</Notice>}
      <div className={styles.actions}>
        <Button type="submit" small aria-disabled={save.isPending}>
          복선 저장
        </Button>
        <Button type="button" variant="ghost" small onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

/** 작품의 복선을 심은 회차, 회수한 회차와 함께 관리한다. */
export function ForeshadowManager({ workId, episodes }: { workId: string; episodes: EpisodeOption[] }) {
  const { data, error, isPending, invalidate } = useForeshadows(workId);
  const [editing, setEditing] = useState<Foreshadow | "new" | null>(null);
  const [message, setMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const remove = useMutation({
    mutationFn: async (foreshadow: Foreshadow) => {
      const result = await deleteForeshadow(foreshadow.id);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: async (_, foreshadow) => {
      await invalidate();
      setMessage(`‘${foreshadow.title}’ 복선을 지웠습니다.`);
      // 누른 버튼이 사라지므로 초점을 제목으로 옮긴다.
      headingRef.current?.focus();
    },
  });

  const groups = [
    { title: "회수하지 않은 복선", items: (data ?? []).filter((item) => !isResolved(item)) },
    { title: "회수한 복선", items: (data ?? []).filter(isResolved) },
  ];

  return (
    <section aria-label="복선" className={styles.manager}>
      <div>
        <h2 ref={headingRef} className={styles.heading} tabIndex={-1}>
          복선
        </h2>
        <p className={styles.note} role="status">
          {message}
        </p>
      </div>
      {editing ? (
        <ForeshadowForm
          key={editing === "new" ? "new" : editing.id}
          workId={workId}
          foreshadow={editing === "new" ? null : editing}
          episodes={episodes}
          onCancel={() => {
            setEditing(null);
            headingRef.current?.focus();
          }}
          onSaved={async (saved) => {
            await invalidate();
            setEditing(null);
            setMessage(`‘${saved.title}’ 복선을 저장했습니다.`);
            headingRef.current?.focus();
          }}
        />
      ) : (
        <div>
          <Button small onClick={() => setEditing("new")}>
            새 복선
          </Button>
        </div>
      )}
      {(error ?? remove.error) && <Notice tone="error">{(error ?? remove.error)?.message}</Notice>}
      {isPending && <p aria-busy="true">복선을 불러오는 중입니다.</p>}
      {data?.length === 0 && <p className={styles.note}>아직 복선이 없습니다.</p>}
      {data &&
        data.length > 0 &&
        groups.map(({ title, items }) => (
          <div key={title}>
            <h3 className={styles.groupTitle}>
              {title} {items.length}개
            </h3>
            <ul className={styles.list}>
              {items.map((foreshadow) => (
                <li key={foreshadow.id}>
                  <h4 className={styles.title}>{foreshadow.title}</h4>
                  <p className={styles.note}>{describeForeshadow(foreshadow, episodes)}</p>
                  {foreshadow.body && <p className={styles.body}>{foreshadow.body}</p>}
                  <div className={styles.actions}>
                    <Button
                      variant="secondary"
                      small
                      aria-label={`고치기: ${foreshadow.title}`}
                      onClick={() => setEditing(foreshadow)}
                    >
                      고치기
                    </Button>
                    <Button
                      variant="ghost"
                      small
                      aria-label={`삭제: ${foreshadow.title}`}
                      aria-disabled={remove.isPending}
                      onClick={() => {
                        if (!remove.isPending && window.confirm(`‘${foreshadow.title}’ 복선을 지울까요?`)) {
                          remove.mutate(foreshadow);
                        }
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
