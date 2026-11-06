"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Notice, TextAreaField } from "@/shared/ui";
import { saveNote } from "../api/actions";
import styles from "./notes.module.scss";
import { useNotes } from "./use-notes";

/** 이 회차에 딸린 메모. 독자에게 보이지 않는다. */
export function EpisodeMemo({ workId, episodeId }: { workId: string; episodeId: string }) {
  const { data, error, invalidate } = useNotes(workId);
  const memo = data?.find((note) => note.episodeId === episodeId);
  // 목록을 읽기 전에는 이미 있는 메모를 모르므로 쓰지 못하게 한다.
  const ready = data !== undefined;
  // 고치기 전에는 저장된 메모를 그대로 보여 준다.
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const save = useMutation({
    mutationFn: async (body: string) => {
      const result = await saveNote(workId, memo?.id ?? null, {
        kind: "MEMO",
        category: "",
        title: "회차 메모",
        aliases: [],
        body,
        episodeId,
      });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
      setMessage("메모를 저장했습니다.");
    },
  });

  return (
    <>
      <TextAreaField
        label="이 회차의 메모"
        value={draft ?? memo?.body ?? ""}
        maxLength={20_000}
        disabled={!ready}
        hint="독자에게 보이지 않습니다."
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage("");
        }}
      />
      <div>
        <Button
          variant="secondary"
          small
          type="button"
          aria-disabled={save.isPending || !ready}
          onClick={() => {
            if (!save.isPending && ready) save.mutate(draft ?? memo?.body ?? "");
          }}
        >
          메모 저장
        </Button>
      </div>
      <p className={styles.note} role="status">
        {message}
      </p>
      {(error ?? save.error) && <Notice tone="error">{(error ?? save.error)?.message}</Notice>}
    </>
  );
}
