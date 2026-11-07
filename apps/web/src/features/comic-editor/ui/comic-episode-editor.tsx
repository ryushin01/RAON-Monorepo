"use client";

import {
  COMIC_IMAGE_MAX_BYTES,
  COMIC_IMAGE_MAX_COUNT,
  COVER_MIME_TYPES,
  type ComicImage,
  type StudioEpisode,
} from "@raon/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Button, ButtonLink, Notice, TextAreaField, TextField } from "@/shared/ui";
import {
  deleteImage,
  listImages,
  moveImage,
  saveComicEpisode,
  setComicPublished,
  updateImageAlt,
  uploadImage,
} from "../api/actions";
import styles from "./comic-episode-editor.module.scss";

const MAX_MB = (COMIC_IMAGE_MAX_BYTES / 1024 / 1024).toFixed(1);

export function validateImageFile(file: File): string | null {
  // 브라우저가 형식을 모르면 빈 값이다. 그때는 서버가 내용으로 판별한다.
  if (file.type && !(COVER_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name}: JPG, PNG, WebP 이미지만 올릴 수 있습니다.`;
  }
  if (file.size > COMIC_IMAGE_MAX_BYTES) return `${file.name}: ${MAX_MB}MB 이하의 이미지만 올릴 수 있습니다.`;
  return null;
}

interface RowProps {
  episodeId: string;
  image: ComicImage;
  index: number;
  count: number;
  onChanged: (message: string) => Promise<void>;
  /** 지운 뒤 초점을 옮길 곳. 누른 버튼이 사라진다(KWCAG 6.1.2). */
  focusAfterRemove: () => void;
}

function ImageRow({ episodeId, image, index, count, onChanged, focusAfterRemove }: RowProps) {
  const label = `${index + 1}번째 이미지`;
  const [alt, setAlt] = useState(image.alt);
  const save = useMutation({
    mutationFn: async (next: string) => {
      const result = await updateImageAlt(episodeId, image.id, next);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => onChanged(`${label}의 설명을 저장했습니다.`),
  });
  const move = useMutation({
    mutationFn: async (direction: "up" | "down") => {
      const result = await moveImage(episodeId, image.id, direction);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => onChanged(`${label}를 옮겼습니다.`),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteImage(episodeId, id);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: async () => {
      await onChanged(`${label}를 지웠습니다.`);
      focusAfterRemove();
    },
  });
  const busy = save.isPending || move.isPending || remove.isPending;
  const error = save.error ?? move.error ?? remove.error;

  return (
    <li className={styles.item}>
      {/* 설명은 바로 옆 입력 칸에 있으므로 미리보기는 빈 대체 텍스트로 둔다. */}
      {/* biome-ignore lint/performance/noImgElement: 인증이 필요한 원본을 그대로 보여 주므로 이미지 최적화를 거치지 않는다. */}
      <img
        className={styles.thumb}
        src={`/api/studio/episodes/${episodeId}/images/${image.id}`}
        alt=""
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading="lazy"
      />
      <div className={styles.itemBody}>
        <TextAreaField
          label={`${label} 설명`}
          value={alt}
          rows={3}
          maxLength={1000}
          hint="화면을 볼 수 없는 독자에게 읽어 줍니다. 장면과 대사를 적어 주세요."
          onChange={(event) => setAlt(event.target.value)}
        />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            small
            aria-label={`설명 저장: ${label}`}
            aria-disabled={busy}
            onClick={() => {
              if (!busy) save.mutate(alt);
            }}
          >
            설명 저장
          </Button>
          <Button
            variant="secondary"
            small
            aria-label={`위로: ${label}`}
            aria-disabled={busy || index === 0}
            onClick={() => {
              if (!busy && index > 0) move.mutate("up");
            }}
          >
            위로
          </Button>
          <Button
            variant="secondary"
            small
            aria-label={`아래로: ${label}`}
            aria-disabled={busy || index === count - 1}
            onClick={() => {
              if (!busy && index < count - 1) move.mutate("down");
            }}
          >
            아래로
          </Button>
          <Button
            variant="ghost"
            small
            aria-label={`삭제: ${label}`}
            aria-disabled={busy}
            onClick={() => {
              if (!busy && window.confirm(`${label}를 지울까요? 되돌릴 수 없습니다.`)) remove.mutate(image.id);
            }}
          >
            삭제
          </Button>
        </div>
        {error && <Notice tone="error">{error.message}</Notice>}
      </div>
    </li>
  );
}

/** 웹툰 회차를 쓴다. 본문 대신 세로로 이어지는 이미지와 그 설명을 다룬다. */
export function ComicEpisodeEditor({ episode: initial }: { episode: StudioEpisode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = ["comic-images", initial.id];
  const [episode, setEpisode] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [authorNote, setAuthorNote] = useState(initial.authorNote ?? "");
  const [isFree, setIsFree] = useState(initial.isFree);
  const [message, setMessage] = useState("");
  const [fileError, setFileError] = useState<string>();
  const [altError, setAltError] = useState<string>();
  const [newAlt, setNewAlt] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const isDraft = episode.status !== "PUBLISHED";

  const images = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await listImages(initial.id);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const onChanged = async (text: string) => {
    await refresh();
    setMessage(text);
  };

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      // 순서를 지키려고 한 장씩 차례로 올린다. 실패하면 앞서 올린 장은 남기고 멈춘다.
      for (const [index, file] of files.entries()) {
        setMessage(`${files.length}장 중 ${index + 1}번째를 올리는 중입니다.`);
        const data = new FormData();
        data.append("alt", newAlt.trim());
        data.append("file", file);
        const result = await uploadImage(initial.id, data);
        if (!result.ok) throw new Error(`${file.name}: ${result.message}`);
      }
      return files.length;
    },
    onSuccess: (count) => {
      formRef.current?.reset();
      setNewAlt("");
      setMessage(isDraft ? `이미지 ${count}장을 올렸습니다. 설명을 입력해 주세요.` : "이미지를 올렸습니다.");
    },
    onError: () => setMessage(""),
    onSettled: () => refresh(),
  });

  const save = useMutation({
    mutationFn: async (input: { title: string; authorNote: string | null; isFree: boolean }) => {
      const result = await saveComicEpisode(episode, input);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved) => {
      setEpisode(saved);
      setMessage("회차 정보를 저장했습니다.");
    },
  });
  const publish = useMutation({
    mutationFn: async (published: boolean) => {
      const result = await setComicPublished(episode.workId, episode.id, published);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved) => {
      setEpisode(saved);
      setMessage(saved.status === "PUBLISHED" ? "공개했습니다." : "비공개로 바꿨습니다.");
      router.refresh();
    },
  });

  const onUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (upload.isPending) return;
    const input = event.currentTarget.elements.namedItem("files") as HTMLInputElement;
    // 파일 이름 순서가 곧 장면 순서인 경우가 많으므로 이름순으로 올린다.
    const files = [...(input.files ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
    const problem = files.length === 0 ? "이미지 파일을 골라 주세요." : files.map(validateImageFile).find(Boolean);
    // 공개 중인 회차는 독자에게 바로 보이므로 설명 없이 올릴 수 없다(KWCAG 5.1.1).
    const missingAlt =
      !problem && !isDraft && !newAlt.trim() ? "공개 중인 회차는 설명을 함께 입력해 주세요." : undefined;
    setFileError(problem ?? undefined);
    setAltError(missingAlt);
    upload.reset();
    if (problem) {
      input.focus();
      return;
    }
    if (missingAlt) {
      event.currentTarget.querySelector<HTMLElement>("textarea")?.focus();
      return;
    }
    upload.mutate(files);
  };

  const list = images.data ?? [];
  const busy = save.isPending || publish.isPending;
  const error = save.error ?? publish.error ?? images.error;

  return (
    <div className={styles.editor}>
      <div className={styles.bar}>
        <p className={styles.state}>
          {episode.number}화 · {isDraft ? "초안" : "공개 중"} · 이미지 {list.length}장
        </p>
        <div className={styles.actions}>
          <ButtonLink variant="ghost" small href={`/studio/works/${episode.workId}`}>
            작품 관리로
          </ButtonLink>
          <Button
            variant="secondary"
            small
            aria-disabled={busy}
            onClick={() => {
              if (!busy) save.mutate({ title: title.trim(), authorNote: authorNote.trim() || null, isFree });
            }}
          >
            저장
          </Button>
          <Button
            small
            variant={isDraft ? "primary" : "secondary"}
            aria-disabled={busy}
            onClick={() => {
              if (!busy) publish.mutate(isDraft);
            }}
          >
            {isDraft ? "공개하기" : "비공개로 바꾸기"}
          </Button>
        </div>
      </div>
      <p role="status" className={styles.note}>
        {message}
      </p>
      {error && <Notice tone="error">{error.message}</Notice>}

      <div className={styles.fields}>
        <TextField
          label="회차 제목"
          value={title}
          maxLength={60}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <label className={styles.check}>
          <input type="checkbox" checked={isFree} onChange={(event) => setIsFree(event.target.checked)} />
          무료 회차로 공개
        </label>
        <TextAreaField
          label="작가의 말"
          value={authorNote}
          maxLength={500}
          hint="이미지 아래에 보입니다. 비워 두어도 됩니다."
          onChange={(event) => setAuthorNote(event.target.value)}
        />
      </div>

      <form ref={formRef} className={styles.upload} onSubmit={onUpload} noValidate>
        <TextField
          label="이미지 파일"
          name="files"
          type="file"
          // 공개 중인 회차는 설명과 함께 한 장씩 올린다.
          multiple={isDraft}
          accept={COVER_MIME_TYPES.join(",")}
          error={fileError}
          hint={`JPG, PNG, WebP. 한 장에 ${MAX_MB}MB, 회차마다 ${COMIC_IMAGE_MAX_COUNT}장까지입니다.${isDraft ? " 파일 이름 순서대로 올립니다." : ""}`}
        />
        {!isDraft && (
          <TextAreaField
            label="올릴 이미지 설명"
            value={newAlt}
            rows={3}
            maxLength={1000}
            required
            error={altError}
            onChange={(event) => {
              setNewAlt(event.target.value);
              if (event.target.value.trim()) setAltError(undefined);
            }}
          />
        )}
        <div className={styles.actions}>
          <Button type="submit" variant="secondary" small aria-disabled={upload.isPending}>
            {upload.isPending ? "올리는 중…" : "이미지 올리기"}
          </Button>
        </div>
        {upload.error && <Notice tone="error">{upload.error.message}</Notice>}
      </form>

      <section aria-label="회차 이미지">
        <h2 ref={headingRef} className={styles.heading} tabIndex={-1}>
          회차 이미지
        </h2>
        {images.isPending && <p aria-busy="true">이미지를 불러오는 중입니다.</p>}
        {images.data && list.length === 0 && <p className={styles.note}>아직 올린 이미지가 없습니다.</p>}
        {list.length > 0 && (
          <ol className={styles.list}>
            {list.map((image, index) => (
              <ImageRow
                key={image.id}
                episodeId={initial.id}
                image={image}
                index={index}
                count={list.length}
                onChanged={onChanged}
                focusAfterRemove={() => headingRef.current?.focus()}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
