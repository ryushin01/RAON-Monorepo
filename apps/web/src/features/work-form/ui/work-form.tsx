"use client";

import { GENRE_LABEL, GENRES, type Genre, type StudioWork } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
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
  const save = useMutation({
    mutationFn: async (draft: Draft) => {
      const result = await saveWork(work?.id ?? null, draft);
      if (!result.ok) throw new FormError(result.message, result.fieldErrors);
      return result.data;
    },
    onSuccess: (saved) => {
      if (work) router.refresh();
      else router.push(`/studio/works/${saved.id}`);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save.mutate({
      title: String(form.get("title")),
      synopsis: String(form.get("synopsis")),
      genre: String(form.get("genre")) as Genre,
      episodePrice: String(form.get("episodePrice")),
      wholePrice: String(form.get("wholePrice")),
    });
  };

  const fieldErrors = save.error instanceof FormError ? save.error.fieldErrors : undefined;

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
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
