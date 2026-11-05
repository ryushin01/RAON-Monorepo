"use client";

import { countChars, EMPTY_DOC, type EpisodeDoc, type EpisodeInput, type StudioEpisode } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button, ButtonLink, Notice, TextAreaField, TextField } from "@/shared/ui";
import { saveEpisode, setEpisodePublished } from "../api/actions";
import styles from "./episode-editor.module.scss";
import { editorExtensions } from "./extensions";

const AUTOSAVE_MS = 2000;

const timeFormat = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

interface Props {
  workId: string;
  /** 없으면 새 회차를 쓰는 화면이다. 처음 저장할 때 만들어진다. */
  episode?: StudioEpisode;
}

export function EpisodeEditor({ workId, episode: initial }: Props) {
  const router = useRouter();
  const contentLabelId = useId();
  const [episode, setEpisode] = useState(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [authorNote, setAuthorNote] = useState(initial?.authorNote ?? "");
  const [isFree, setIsFree] = useState(initial?.isFree ?? false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const editor = useEditor({
    extensions: editorExtensions,
    content: initial?.content ?? EMPTY_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-labelledby": contentLabelId, "aria-multiline": "true", role: "textbox" },
    },
    onUpdate: () => setDirty(true),
  });

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            blockquote: current.isActive("blockquote"),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
            chars: countChars(current.getJSON() as EpisodeDoc),
          }
        : null,
  });

  const save = useMutation({
    mutationFn: async (input: EpisodeInput) => {
      const result = await saveEpisode(workId, episode?.id ?? null, input);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved) => {
      const created = !episode;
      setEpisode(saved);
      setDirty(false);
      setSavedAt(new Date());
      if (created) {
        // 편집 상태를 유지한 채 주소만 바꾼다. 새로고침해도 이 회차로 돌아온다.
        window.history.replaceState(null, "", `/studio/works/${workId}/episodes/${saved.id}`);
      }
    },
  });

  const publish = useMutation({
    mutationFn: async (input: { episodeId: string; published: boolean }) => {
      const result = await setEpisodePublished(workId, input.episodeId, input.published);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved) => {
      setEpisode(saved);
      router.refresh();
    },
  });

  const collect = (): EpisodeInput | null =>
    editor
      ? {
          title: title.trim() || "제목 없음",
          content: editor.getJSON() as EpisodeDoc,
          authorNote: authorNote.trim() || null,
          isFree,
        }
      : null;

  const busy = save.isPending || publish.isPending;

  // 초안만 자동 저장한다. 공개한 회차는 독자에게 바로 보이므로 저장 버튼으로만 반영한다.
  const autosaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    autosaveRef.current = () => {
      const input = collect();
      if (input && !save.isPending) save.mutate(input);
    };
  });
  const isDraft = episode?.status !== "PUBLISHED";
  // biome-ignore lint/correctness/useExhaustiveDependencies: 입력이 바뀔 때마다 대기 시간을 다시 재기 위해 값들을 넣었다.
  useEffect(() => {
    if (!dirty || !isDraft || !title.trim()) return;
    const timer = setTimeout(() => autosaveRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, isDraft, title, authorNote, isFree, toolbar?.chars]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onSave = () => {
    const input = collect();
    if (input) save.mutate(input);
  };

  const onPublish = async () => {
    const input = collect();
    if (!input) return;
    // 지금 화면의 내용을 먼저 저장한 뒤 공개한다.
    const saved = dirty || !episode ? await save.mutateAsync(input).catch(() => null) : episode;
    if (saved) publish.mutate({ episodeId: saved.id, published: true });
  };

  const stateText = save.isPending
    ? "저장 중…"
    : save.error
      ? "저장하지 못했습니다."
      : dirty
        ? isDraft
          ? "저장 대기 중"
          : "저장하지 않은 변경 사항이 있습니다."
        : savedAt
          ? `${timeFormat.format(savedAt)} 저장됨`
          : episode
            ? "변경 사항 없음"
            : "아직 저장하지 않았습니다.";

  return (
    <div className={styles.editor}>
      <div className={styles.bar}>
        <p className={styles.state} role="status">
          {episode ? `${episode.number}화 · ${isDraft ? "초안" : "공개 중"} · ` : "새 회차 · "}
          {stateText}
        </p>
        <div className={styles.actions}>
          <ButtonLink variant="ghost" small href={`/studio/works/${workId}`}>
            작품 관리로
          </ButtonLink>
          <Button variant="secondary" small onClick={onSave} disabled={busy || !editor}>
            저장
          </Button>
          {isDraft ? (
            <Button small onClick={() => void onPublish()} disabled={busy || !editor}>
              공개하기
            </Button>
          ) : (
            <Button
              variant="secondary"
              small
              disabled={busy}
              onClick={() => episode && publish.mutate({ episodeId: episode.id, published: false })}
            >
              비공개로 바꾸기
            </Button>
          )}
        </div>
      </div>

      {(save.error ?? publish.error) && <Notice tone="error">{(save.error ?? publish.error)?.message}</Notice>}
      {publish.isSuccess && !isDraft && <Notice>공개했습니다. 독자가 이 회차를 볼 수 있습니다.</Notice>}

      <TextField
        label="회차 제목"
        value={title}
        maxLength={60}
        required
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
        }}
      />

      <div className={styles.surface}>
        <span id={contentLabelId} className={styles.label}>
          본문
        </span>
        {/* biome-ignore lint/a11y/useSemanticElements: 입력 요소가 아닌 서식 버튼 묶음이라 fieldset이 맞지 않는다. */}
        <div className={styles.toolbar} role="group" aria-label="본문 서식">
          <button
            type="button"
            aria-pressed={toolbar?.bold ?? false}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            굵게
          </button>
          <button
            type="button"
            aria-pressed={toolbar?.italic ?? false}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            기울임
          </button>
          <button
            type="button"
            aria-pressed={toolbar?.blockquote ?? false}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            인용
          </button>
          <button type="button" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
            구분선
          </button>
          <button type="button" disabled={!toolbar?.canUndo} onClick={() => editor?.chain().focus().undo().run()}>
            실행 취소
          </button>
          <button type="button" disabled={!toolbar?.canRedo} onClick={() => editor?.chain().focus().redo().run()}>
            다시 실행
          </button>
        </div>
        <EditorContent editor={editor} className={styles.content} />
        <p className={styles.count}>공백 제외 {(toolbar?.chars ?? 0).toLocaleString("ko-KR")}자</p>
      </div>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={isFree}
          onChange={(event) => {
            setIsFree(event.target.checked);
            setDirty(true);
          }}
        />
        무료 회차로 공개
      </label>

      <TextAreaField
        label="작가의 말"
        value={authorNote}
        maxLength={500}
        hint="본문 아래에 보입니다. 비워 두어도 됩니다."
        onChange={(event) => {
          setAuthorNote(event.target.value);
          setDirty(true);
        }}
      />
    </div>
  );
}
