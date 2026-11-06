"use client";

import type { EpisodeDoc, EpisodeVersionSummary, StudioEpisode } from "@raon/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Button, Notice, TextField } from "@/shared/ui";
import { createVersion, deleteVersion, getVersion, listVersions, restoreVersion } from "../api/actions";
import { type DiffLine, diffParagraphs } from "../model/paragraph-diff";
import styles from "./version-history.module.scss";

const nameOf = (version: EpisodeVersionSummary) =>
  version.label ?? (version.kind === "AUTO" ? "자동 저장" : "이름 없는 버전");

function Diff({ lines }: { lines: DiffLine[] }) {
  if (lines.every((line) => line.type === "same")) return <p className={styles.note}>지금 본문과 글자가 같습니다.</p>;
  return (
    <ol className={styles.diff}>
      {lines.map((line, index) => (
        // 단락 순서가 곧 정체성이고 목록을 다시 정렬하지 않는다.
        // biome-ignore lint/suspicious/noArrayIndexKey: 같은 글자의 단락이 반복될 수 있다.
        <li key={index}>
          {line.type === "added" ? (
            <ins>
              <span className="visually-hidden">추가: </span>
              {line.text}
            </ins>
          ) : line.type === "removed" ? (
            <del>
              <span className="visually-hidden">삭제: </span>
              {line.text}
            </del>
          ) : (
            line.text
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * 회차의 지난 내용. 남기기와 복원은 서버에 있는 원고를 기준으로 하므로, 저장하지 않은 입력을 먼저 저장한다.
 */
export function VersionHistory({
  episodeId,
  isPublic,
  getDoc,
  saveFirst,
  onRestored,
}: {
  episodeId: string;
  isPublic: boolean;
  getDoc: () => EpisodeDoc;
  saveFirst: () => Promise<boolean>;
  onRestored: (episode: StudioEpisode) => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["episode-versions", episodeId];
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [compare, setCompare] = useState<{ name: string; lines: DiffLine[] } | null>(null);

  const list = useQuery({
    queryKey,
    // 지난 원고는 서로 다른 작가가 쓰지 않으므로 보이는 동안 다시 읽지 않아도 된다. 남기거나 복원하면 직접 비운다.
    staleTime: 30_000,
    queryFn: async () => {
      const result = await listVersions(episodeId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
  const refreshList = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: async (name: string) => {
      if (!(await saveFirst())) throw new Error("저장하지 못해 버전을 남기지 않았습니다.");
      const result = await createVersion(episodeId, name.trim() || null);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: async (version) => {
      setLabel("");
      setMessage(`‘${nameOf(version)}’ 버전을 남겼습니다.`);
      await refreshList();
    },
  });

  const open = useMutation({
    mutationFn: async (version: EpisodeVersionSummary) => {
      const result = await getVersion(episodeId, version.id);
      if (!result.ok) throw new Error(result.message);
      return { name: nameOf(version), lines: diffParagraphs(result.data.content, getDoc()) };
    },
    onSuccess: (data) => {
      setCompare(data);
      setMessage(`‘${data.name}’ 버전과 지금 본문을 비교합니다.`);
    },
  });

  const restore = useMutation({
    mutationFn: async (version: EpisodeVersionSummary) => {
      if (!(await saveFirst())) throw new Error("저장하지 못해 되돌리지 않았습니다.");
      const result = await restoreVersion(episodeId, version.id);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: async (episode) => {
      await refreshList();
      onRestored(episode);
    },
  });

  const remove = useMutation({
    mutationFn: async (version: EpisodeVersionSummary) => {
      const result = await deleteVersion(episodeId, version.id);
      if (!result.ok) throw new Error(result.message);
      return version;
    },
    onSuccess: async (version) => {
      setMessage(`‘${nameOf(version)}’ 버전을 지웠습니다.`);
      setCompare(null);
      await refreshList();
    },
  });

  const busy = create.isPending || open.isPending || restore.isPending || remove.isPending;
  const error = create.error ?? open.error ?? restore.error ?? remove.error ?? list.error;

  return (
    <>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) create.mutate(label);
        }}
      >
        <TextField
          label="버전 이름"
          value={label}
          maxLength={40}
          hint={
            isPublic
              ? "비워 두어도 됩니다. 지금 본문을 저장한 뒤 남기며, 공개 중인 회차라 저장한 내용이 독자에게 바로 보입니다."
              : "비워 두어도 됩니다. 지금 본문을 저장한 뒤 남깁니다."
          }
          onChange={(event) => setLabel(event.target.value)}
        />
        <Button variant="secondary" small type="submit" aria-disabled={busy}>
          지금 버전 남기기
        </Button>
      </form>
      <p className={styles.note} role="status">
        {message}
      </p>
      {error && <Notice tone="error">{error.message}</Notice>}
      {list.isPending && <p aria-busy="true">버전을 불러오는 중입니다.</p>}
      {list.data?.length === 0 && (
        <p className={styles.note}>아직 버전이 없습니다. 본문을 고쳐 저장하면 자동으로 남습니다.</p>
      )}
      {list.data && list.data.length > 0 && (
        <ul className={styles.list}>
          {list.data.map((version) => {
            const name = nameOf(version);
            return (
              <li key={version.id}>
                <div className={styles.meta}>
                  <strong>{name}</strong>
                  <span>
                    {formatDateTime(version.createdAt)} · {version.charCount.toLocaleString("ko-KR")}자
                  </span>
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    small
                    type="button"
                    aria-label={`비교: ${name}`}
                    aria-disabled={busy}
                    onClick={() => {
                      if (!busy) open.mutate(version);
                    }}
                  >
                    비교
                  </Button>
                  <Button
                    variant="secondary"
                    small
                    type="button"
                    aria-label={`복원: ${name}`}
                    aria-disabled={busy}
                    onClick={() => {
                      if (busy) return;
                      const warning = isPublic ? " 공개 중인 회차라 독자에게 바로 보입니다." : "";
                      if (window.confirm(`이 버전으로 되돌릴까요? 지금 내용은 새 버전으로 남습니다.${warning}`)) {
                        restore.mutate(version);
                      }
                    }}
                  >
                    복원
                  </Button>
                  <Button
                    variant="ghost"
                    small
                    type="button"
                    aria-label={`삭제: ${name}`}
                    aria-disabled={busy}
                    onClick={() => {
                      if (!busy && window.confirm("이 버전을 지울까요? 되돌릴 수 없습니다.")) remove.mutate(version);
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {compare && (
        <section className={styles.compare} aria-label={`${compare.name} 버전과 지금 본문 비교`}>
          <h4 className={styles.compareTitle}>‘{compare.name}’ 버전에서 바뀐 곳</h4>
          <p className={styles.note}>
            본문의 글자만 비교합니다. 서식은 비교하지 않으며, 복원하면 제목과 작가의 말도 이 버전으로 바뀝니다.
          </p>
          <Diff lines={compare.lines} />
        </section>
      )}
    </>
  );
}
