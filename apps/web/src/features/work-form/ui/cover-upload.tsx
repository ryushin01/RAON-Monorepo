"use client";

import { COVER_MAX_BYTES, COVER_MIME_TYPES, type StudioWork } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { coverSrc, WorkCover } from "@/entities/work";
import { Button, Notice, TextField } from "@/shared/ui";
import { deleteCover, uploadCover } from "../api/actions";
import styles from "./work-form.module.scss";

function validate(file: File | undefined): string | null {
  if (!file || file.size === 0) return "이미지 파일을 골라 주세요.";
  if (!(COVER_MIME_TYPES as readonly string[]).includes(file.type)) return "JPG, PNG, WebP 이미지만 올릴 수 있습니다.";
  if (file.size > COVER_MAX_BYTES) return "2MB 이하의 이미지만 올릴 수 있습니다.";
  return null;
}

/** 파일을 고르는 것만으로 올리지 않고 버튼을 눌러야 올린다(KWCAG 7.2.1). */
export function CoverUpload({ work }: { work: StudioWork }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fileError, setFileError] = useState<string>();
  const [saved, setSaved] = useState("");

  const upload = useMutation({
    mutationFn: async (data: FormData) => {
      const result = await uploadCover(work.id, data);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      formRef.current?.reset();
      setSaved("표지를 올렸습니다.");
      router.refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (workId: string) => {
      const result = await deleteCover(workId);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      setSaved("표지를 지웠습니다.");
      router.refresh();
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved("");
    const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    const problem = validate(file);
    setFileError(problem ?? undefined);
    if (problem || !file) return;
    const data = new FormData();
    data.append("file", file);
    upload.mutate(data);
  };

  // 오류를 그린 뒤에 그 칸으로 초점을 옮긴다.
  useEffect(() => {
    if (fileError) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fileError]);

  const busy = upload.isPending || remove.isPending;
  const error = upload.error ?? remove.error;

  return (
    <div className={styles.cover}>
      <div className={styles.coverPreview}>
        <WorkCover title={work.title} authorName="" imageUrl={coverSrc(work)} />
      </div>
      <form ref={formRef} className={styles.coverForm} onSubmit={onSubmit} noValidate>
        <TextField
          label="표지 이미지"
          name="file"
          type="file"
          accept={COVER_MIME_TYPES.join(",")}
          hint="JPG, PNG, WebP, 2MB 이하. 올리지 않으면 제목으로 표지를 만듭니다."
          error={fileError}
        />
        <div className={styles.status}>
          <Button type="submit" variant="secondary" disabled={busy}>
            {upload.isPending ? "올리는 중…" : "표지 올리기"}
          </Button>
          {work.coverUpdatedAt && (
            <Button variant="secondary" disabled={busy} onClick={() => remove.mutate(work.id)}>
              표지 지우기
            </Button>
          )}
        </div>
        {error && <Notice tone="error">{error.message}</Notice>}
        {saved && !error && <Notice>{saved}</Notice>}
      </form>
    </div>
  );
}
