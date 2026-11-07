"use client";

import {
  GENRE_LABEL,
  GENRES,
  type Genre,
  MAX_TAGS,
  type StudioWork,
  WORK_FORMAT_LABEL,
  WORK_FORMATS,
  type WorkFormat,
} from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef } from "react";
import { Button, Notice, SelectField, TextAreaField, TextField } from "@/shared/ui";
import { saveWork } from "../api/actions";
import styles from "./work-form.module.scss";

type Draft = Parameters<typeof saveWork>[1];

class FormError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export function WorkForm({ work }: { work?: StudioWork }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const save = useMutation({
    mutationFn: async (draft: Draft) => {
      const result = await saveWork(work?.id ?? null, draft);
      if (!result.ok) throw new FormError(result.message, result.fieldErrors);
      return result.data;
    },
    onSuccess: (saved) => {
      if (work) {
        router.refresh();
        return;
      }
      // 새 작품 화면은 숨겨져 남으므로 다음에 열 때 지난 입력이 보이지 않게 비운다.
      formRef.current?.reset();
      save.reset();
      router.push(`/studio/works/${saved.id}`);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save.mutate({
      format: work?.format ?? (String(form.get("format")) as WorkFormat),
      title: String(form.get("title")),
      synopsis: String(form.get("synopsis")),
      genre: String(form.get("genre")) as Genre,
      episodePrice: String(form.get("episodePrice")),
      wholePrice: String(form.get("wholePrice")),
      tags: String(form.get("tags")),
    });
  };

  const fieldErrors = save.error instanceof FormError ? save.error.fieldErrors : undefined;
  // 태그 하나가 잘못되면 tags.0처럼 위치가 붙어 온다.
  const tagError = Object.entries(fieldErrors ?? {}).find(([key]) => key.startsWith("tags"))?.[1];

  // 오류가 있으면 첫 번째 잘못된 입력 칸으로 초점을 옮긴다.
  useEffect(() => {
    if (fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
      {/* 형식에 따라 회차의 내용이 달라지므로 만들 때만 고른다. */}
      {!work && (
        <SelectField label="형식" name="format" defaultValue="NOVEL" hint="만든 뒤에는 바꿀 수 없습니다.">
          {WORK_FORMATS.map((format) => (
            <option key={format} value={format}>
              {WORK_FORMAT_LABEL[format]}
            </option>
          ))}
        </SelectField>
      )}
      <TextField
        label="작품명"
        name="title"
        defaultValue={work?.title}
        required
        maxLength={60}
        error={fieldErrors?.title}
      />
      <SelectField label="장르" name="genre" defaultValue={work?.genre ?? "FANTASY"} error={fieldErrors?.genre}>
        {GENRES.map((genre) => (
          <option key={genre} value={genre}>
            {GENRE_LABEL[genre]}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label="작품 소개"
        name="synopsis"
        defaultValue={work?.synopsis}
        required
        maxLength={2000}
        hint="10자 이상으로 입력해 주세요."
        error={fieldErrors?.synopsis}
      />
      <TextField
        label="태그"
        name="tags"
        defaultValue={work?.tags.join(", ")}
        hint={`쉼표로 구분해 ${MAX_TAGS}개까지 입력합니다. 태그 하나는 10자 이하입니다.`}
        error={tagError}
      />
      <div className={styles.prices}>
        <TextField
          label="회차 가격(코인)"
          name="episodePrice"
          type="number"
          inputMode="numeric"
          min={10}
          defaultValue={work?.episodePrice ?? 100}
          required
          error={fieldErrors?.episodePrice}
        />
        <TextField
          label="작품 전체 가격(코인)"
          name="wholePrice"
          type="number"
          inputMode="numeric"
          min={10}
          defaultValue={work?.wholePrice ?? ""}
          hint="완결 작품에서만 판매합니다. 비워 두면 회차로만 판매합니다."
          error={fieldErrors?.wholePrice}
        />
      </div>
      {save.error && !fieldErrors && <Notice tone="error">{save.error.message}</Notice>}
      {save.isSuccess && work && <Notice>저장했습니다.</Notice>}
      <div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "저장 중…" : work ? "작품 정보 저장" : "작품 만들기"}
        </Button>
      </div>
    </form>
  );
}
