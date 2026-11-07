"use client";

import type { Foreshadow, ForeshadowInput } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { Button, Notice, TextField } from "@/shared/ui";
import { saveForeshadow } from "../api/actions";
import { describeForeshadow, type EpisodeOption, isResolved, toForeshadowInput } from "../model/foreshadow";
import styles from "./foreshadow.module.scss";
import { useForeshadows } from "./use-foreshadows";

interface SaveRequest {
  id: string | null;
  input: ForeshadowInput;
  done: string;
}

/** 글을 쓰면서 이 회차에 복선을 심거나 회수한다. 내용을 고치려면 설정집 화면으로 간다. */
export function ForeshadowReference({
  workId,
  episodeId,
  episodes,
}: {
  workId: string;
  episodeId: string;
  episodes: EpisodeOption[];
}) {
  const { data, error, isPending, invalidate } = useForeshadows(workId);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const save = useMutation({
    mutationFn: async ({ id, input }: SaveRequest) => {
      const result = await saveForeshadow(workId, id, input);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: async (_, { id, done }) => {
      await invalidate();
      setMessage(done);
      if (!id) setTitle("");
    },
  });

  const run = (request: SaveRequest) => {
    if (!save.isPending) save.mutate(request);
  };

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      inputRef.current?.focus();
      setMessage("복선 이름을 입력해 주세요.");
      return;
    }
    run({
      id: null,
      input: { title: name, body: "", plantedEpisodeId: episodeId, resolvedEpisodeId: null },
      done: `‘${name}’ 복선을 이 회차에 심었습니다.`,
    });
  };

  const open = (data ?? []).filter((item) => !isResolved(item));
  const resolvedHere = (data ?? []).filter((item) => item.resolvedEpisodeId === episodeId);

  const item = (foreshadow: Foreshadow, action: React.ReactNode) => (
    <li key={foreshadow.id}>
      <h4 className={styles.title}>{foreshadow.title}</h4>
      <p className={styles.note}>{describeForeshadow(foreshadow, episodes)}</p>
      {foreshadow.body && <p className={styles.body}>{foreshadow.body}</p>}
      <div className={styles.actions}>{action}</div>
    </li>
  );

  return (
    <>
      <form className={styles.form} onSubmit={onAdd} noValidate>
        <TextField
          ref={inputRef}
          label="새 복선 이름"
          value={title}
          maxLength={60}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="secondary" small aria-disabled={save.isPending}>
            이 회차에 심기
          </Button>
        </div>
      </form>
      <p className={styles.note} role="status">
        {message}
      </p>
      {(error ?? save.error) && <Notice tone="error">{(error ?? save.error)?.message}</Notice>}
      {isPending && <p aria-busy="true">복선을 불러오는 중입니다.</p>}
      {data && open.length === 0 && resolvedHere.length === 0 && <p className={styles.note}>회수할 복선이 없습니다.</p>}
      {open.length > 0 && (
        <>
          <h3 className={styles.groupTitle}>회수하지 않은 복선 {open.length}개</h3>
          <ul className={styles.list}>
            {open.map((foreshadow) =>
              item(
                foreshadow,
                <Button
                  variant="secondary"
                  small
                  aria-label={`이 회차에서 회수: ${foreshadow.title}`}
                  aria-disabled={save.isPending}
                  onClick={() =>
                    run({
                      id: foreshadow.id,
                      input: toForeshadowInput(foreshadow, { resolvedEpisodeId: episodeId }),
                      done: `‘${foreshadow.title}’ 복선을 이 회차에서 회수했습니다.`,
                    })
                  }
                >
                  이 회차에서 회수
                </Button>,
              ),
            )}
          </ul>
        </>
      )}
      {resolvedHere.length > 0 && (
        <>
          <h3 className={styles.groupTitle}>이 회차에서 회수한 복선 {resolvedHere.length}개</h3>
          <ul className={styles.list}>
            {resolvedHere.map((foreshadow) =>
              item(
                foreshadow,
                <Button
                  variant="ghost"
                  small
                  aria-label={`회수 취소: ${foreshadow.title}`}
                  aria-disabled={save.isPending}
                  onClick={() =>
                    run({
                      id: foreshadow.id,
                      input: toForeshadowInput(foreshadow, { resolvedEpisodeId: null }),
                      done: `‘${foreshadow.title}’ 복선의 회수를 취소했습니다.`,
                    })
                  }
                >
                  회수 취소
                </Button>,
              ),
            )}
          </ul>
        </>
      )}
    </>
  );
}
