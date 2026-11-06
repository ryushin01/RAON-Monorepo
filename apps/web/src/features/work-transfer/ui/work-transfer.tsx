"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import {
  EXPORT_FORMATS,
  type ExportFormat,
  exportFileName,
  exportMimeType,
  renderWorkExport,
} from "@/entities/episode";
import { downloadText } from "@/shared/lib";
import { Button, Notice, SelectField } from "@/shared/ui";
import { fetchWorkExport, importEpisode } from "../api/actions";
import { ImportError, parseImportFile } from "../model/import-file";
import styles from "./work-transfer.module.scss";

export function WorkTransfer({ workId }: { workId: string }) {
  const router = useRouter();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [message, setMessage] = useState("");
  const [fileError, setFileError] = useState("");

  const exportWork = useMutation({
    mutationFn: async () => {
      const result = await fetchWorkExport(workId);
      if (!result.ok) throw new Error(result.message);
      const episodes = result.data.episodes.filter((episode) => includeDrafts || episode.status === "PUBLISHED");
      if (episodes.length === 0) throw new Error("내보낼 회차가 없습니다.");
      downloadText(
        exportFileName(result.data.title, format),
        renderWorkExport(format, { title: result.data.title, episodes }),
        exportMimeType(format),
      );
      return episodes.length;
    },
    onSuccess: (count) => setMessage(`${count}개 회차를 내보냈습니다.`),
    onError: () => setMessage(""),
  });

  const importFile = useMutation({
    mutationFn: async (file: File) => {
      const { title, content } = parseImportFile(file.name, new Uint8Array(await file.arrayBuffer()));
      const result = await importEpisode(workId, { title, content, authorNote: null, isFree: false });
      if (!result.ok) throw new ImportError(result.message);
      return result.data;
    },
    onSuccess: (episode) => {
      if (fileRef.current) fileRef.current.value = "";
      router.push(`/studio/works/${workId}/episodes/${episode.id}`);
    },
    onError: (error) => {
      setFileError(error.message);
      fileRef.current?.focus();
    },
  });

  const onImport = (event: FormEvent) => {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setFileError("가져올 파일을 골라 주세요.");
      fileRef.current?.focus();
      return;
    }
    setFileError("");
    if (!importFile.isPending) importFile.mutate(file);
  };

  return (
    <div className={styles.transfer}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!exportWork.isPending) exportWork.mutate();
        }}
      >
        <SelectField label="형식" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
          {EXPORT_FORMATS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <label className={styles.check}>
          <input type="checkbox" checked={includeDrafts} onChange={(event) => setIncludeDrafts(event.target.checked)} />
          초안 포함
        </label>
        <Button type="submit" variant="secondary" small aria-disabled={exportWork.isPending}>
          작품 내보내기
        </Button>
        <p className={styles.note} role="status">
          {message}
        </p>
        {exportWork.error && <Notice tone="error">{exportWork.error.message}</Notice>}
      </form>

      <form className={styles.form} onSubmit={onImport} noValidate>
        <div className={styles.field}>
          <label htmlFor={fileId} className={styles.label}>
            가져올 파일
          </label>
          <input
            id={fileId}
            ref={fileRef}
            className={styles.file}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            aria-invalid={fileError ? true : undefined}
            aria-describedby={`${fileId}-hint${fileError ? ` ${fileId}-error` : ""}`}
          />
          {fileError && (
            <p id={`${fileId}-error`} className={styles.error}>
              {fileError}
            </p>
          )}
          <p id={`${fileId}-hint`} className={styles.note}>
            TXT와 MD 파일, 1MB까지. 빈 줄은 단락을 나누고 서식은 글자 그대로 들어갑니다. 새 초안으로 만듭니다.
          </p>
        </div>
        <Button type="submit" variant="secondary" small aria-disabled={importFile.isPending}>
          새 회차로 가져오기
        </Button>
      </form>
    </div>
  );
}
