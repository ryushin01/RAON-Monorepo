"use client";

import { countChars, type EpisodeDoc, type EpisodeInput, type StudioEpisode } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useId, useState } from "react";
import { Button, ButtonLink, Notice, TextAreaField, TextField } from "@/shared/ui";
import { saveEpisode, setEpisodePublished } from "../api/actions";
import { UNTITLED } from "../model/constants";
import { useAutosave } from "../model/use-autosave";
import styles from "./episode-editor.module.scss";
import { editorExtensions } from "./extensions";

const AUTOSAVE_MS = 2000;

const timeFormat = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

interface SaveRequest {
  revision: number;
  input: EpisodeInput;
  /** 직접 누른 저장만 소리 내어 알린다. 자동 저장까지 읽어 주면 글을 쓰는 데 방해가 된다. */
  manual: boolean;
}

export function EpisodeEditor({ episode: initial }: { episode: StudioEpisode }) {
  const router = useRouter();
  const contentLabelId = useId();
  const [episode, setEpisode] = useState(initial);
  const [title, setTitle] = useState(initial.title === UNTITLED ? "" : initial.title);
  const [authorNote, setAuthorNote] = useState(initial.authorNote ?? "");
  const [isFree, setIsFree] = useState(initial.isFree);
  const [revision, setRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [failedRevision, setFailedRevision] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const touch = () => setRevision((value) => value + 1);
  const dirty = revision !== savedRevision;
  const isDraft = episode.status !== "PUBLISHED";

  const editor = useEditor({
    extensions: editorExtensions,
    content: initial.content,
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-labelledby": contentLabelId, "aria-multiline": "true", role: "textbox" },
    },
    onUpdate: touch,
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
    mutationFn: async ({ input }: SaveRequest) => {
      const result = await saveEpisode(initial.id, input);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved, { revision: sent, manual }) => {
      setEpisode(saved);
      // 저장하는 동안 더 입력했다면 sent가 최신이 아니므로 변경 사항이 남은 상태로 둔다.
      setSavedRevision(sent);
      setFailedRevision(null);
      const now = new Date();
      setSavedAt(now);
      if (manual) setAnnouncement(`${timeFormat.format(now)}에 저장했습니다.`);
    },
    onError: (_, { revision: sent }) => {
      setFailedRevision(sent);
      setAnnouncement("저장하지 못했습니다.");
    },
  });

  const publish = useMutation({
    mutationFn: async (published: boolean) => {
      const result = await setEpisodePublished(episode.workId, initial.id, published);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved) => {
      setEpisode(saved);
      setAnnouncement(saved.status === "PUBLISHED" ? "공개했습니다." : "비공개로 바꿨습니다.");
      router.refresh();
    },
  });

  const collect = (manual: boolean): SaveRequest | null =>
    editor
      ? {
          revision,
          manual,
          input: {
            title: title.trim() || UNTITLED,
            content: editor.getJSON() as EpisodeDoc,
            authorNote: authorNote.trim() || null,
            isFree,
          },
        }
      : null;

  // 초안만 자동 저장한다. 공개한 회차는 독자에게 바로 보이므로 저장 버튼으로만 반영한다.
  useAutosave({
    revision,
    savedRevision,
    failedRevision,
    enabled: isDraft,
    isSaving: save.isPending,
    delayMs: AUTOSAVE_MS,
    save: () => {
      const request = collect(false);
      if (request) save.mutate(request);
    },
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onLeave = (event: MouseEvent) => {
    // 초안은 떠날 때 자동 저장되므로 공개한 회차의 변경 사항만 묻는다.
    if (dirty && !isDraft && !window.confirm("저장하지 않은 변경 사항이 있습니다. 저장하지 않고 나갈까요?")) {
      event.preventDefault();
    }
  };

  const onSave = () => {
    const request = collect(true);
    if (request) save.mutate(request);
  };

  const onPublish = async () => {
    const request = collect(true);
    if (!request) return;
    // 지금 화면의 내용을 먼저 저장한 뒤 공개한다.
    if (dirty) {
      const saved = await save.mutateAsync(request).catch(() => null);
      if (!saved) return;
    }
    publish.mutate(true);
  };

  const busy = save.isPending || publish.isPending;
  const stateText = save.isPending
    ? "저장 중…"
    : failedRevision === revision
      ? "저장하지 못했습니다."
      : dirty
        ? isDraft
          ? "저장 대기 중"
          : "저장하지 않은 변경 사항이 있습니다."
        : savedAt
          ? `${timeFormat.format(savedAt)} 저장됨`
          : "변경 사항 없음";
  const error = save.error ?? publish.error;

  return (
    <div className={styles.editor}>
      <div className={styles.bar}>
        <p className={styles.state}>
          {episode.number}화 · {isDraft ? "초안" : "공개 중"} · {stateText}
        </p>
        <div className={styles.actions}>
          <ButtonLink variant="ghost" small href={`/studio/works/${episode.workId}`} onClick={onLeave}>
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
            <Button variant="secondary" small disabled={busy} onClick={() => publish.mutate(false)}>
              비공개로 바꾸기
            </Button>
          )}
        </div>
      </div>

      <p role="status" className="visually-hidden">
        {announcement}
      </p>
      {error && <Notice tone="error">{error.message}</Notice>}

      <TextField
        label="회차 제목"
        value={title}
        maxLength={60}
        hint="비워 두면 ‘제목 없음’으로 저장합니다."
        onChange={(event) => {
          setTitle(event.target.value);
          touch();
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
            touch();
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
          touch();
        }}
      />
    </div>
  );
}
