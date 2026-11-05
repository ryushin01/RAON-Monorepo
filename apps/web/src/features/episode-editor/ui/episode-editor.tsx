"use client";

import { countChars, type EpisodeDoc, type EpisodeInput, type StudioEpisode } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useId, useRef, useState } from "react";
import { Button, ButtonLink, Notice, TextAreaField, TextField } from "@/shared/ui";
import { saveEpisode, setEpisodePublished } from "../api/actions";
import { UNTITLED } from "../model/constants";
import { clearBackup, type DraftBackup, readBackup, writeBackup } from "../model/draft-backup";
import { useAutosave } from "../model/use-autosave";
import styles from "./episode-editor.module.scss";
import { editorExtensions } from "./extensions";

const AUTOSAVE_MS = 2000;
const RETRY_MS = 15_000;
const BACKUP_MS = 500;

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
  const [backup, setBackup] = useState<DraftBackup | null>(null);

  // localStorage는 브라우저에만 있으므로 화면을 그린 뒤에 읽는다.
  useEffect(() => {
    setBackup(
      readBackup(initial.id, {
        title: initial.title,
        content: initial.content,
        authorNote: initial.authorNote,
        isFree: initial.isFree,
      }),
    );
  }, [initial.id, initial.title, initial.content, initial.authorNote, initial.isFree]);

  const latestRevision = useRef(0);
  const backupPending = useRef(false);
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
      // 복원 여부를 아직 고르지 않은 백업은 이번 저장에 들어 있지 않으므로 남긴다.
      if (sent === latestRevision.current && !backupPending.current) clearBackup(initial.id);
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

  const collectInput = (): EpisodeInput | null =>
    editor
      ? {
          title: title.trim() || UNTITLED,
          content: editor.getJSON() as EpisodeDoc,
          authorNote: authorNote.trim() || null,
          isFree,
        }
      : null;

  const collect = (manual: boolean): SaveRequest | null => {
    const input = collectInput();
    return input && { revision, manual, input };
  };

  // 초안만 자동 저장한다. 공개한 회차는 독자에게 바로 보이므로 저장 버튼으로만 반영한다.
  useAutosave({
    revision,
    savedRevision,
    failedRevision,
    enabled: isDraft,
    isSaving: save.isPending,
    delayMs: AUTOSAVE_MS,
    retryMs: RETRY_MS,
    save: () => {
      const request = collect(false);
      if (request) save.mutate(request);
    },
  });

  // 저장하지 못한 입력을 브라우저에 보관한다. 뒤로 가기나 탭 종료, 저장 실패에도 원고를 되찾을 수 있다.
  const backupRef = useRef<() => void>(() => {});
  useEffect(() => {
    latestRevision.current = revision;
    backupPending.current = backup !== null;
    backupRef.current = () => {
      // 복원 여부를 고르기 전에는 이전 백업을 덮어쓰지 않는다.
      const input = dirty && !backup ? collectInput() : null;
      if (input) writeBackup(initial.id, input);
    };
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: 입력이 바뀔 때마다 대기 시간을 다시 재기 위해 revision을 넣었다.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => backupRef.current(), BACKUP_MS);
    return () => clearTimeout(timer);
  }, [dirty, revision]);
  useEffect(() => () => backupRef.current(), []);
  // 탭을 닫으면 위의 정리 함수가 돌지 않으므로 마지막 입력을 여기서 남긴다.
  useEffect(() => {
    const onPageHide = () => backupRef.current();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const restore = () => {
    if (!backup) return;
    if (dirty && !window.confirm("지금 입력한 내용을 백업한 내용으로 바꿀까요? 지금 입력한 내용은 사라집니다.")) return;
    editor?.commands.setContent(backup.input.content);
    setTitle(backup.input.title === UNTITLED ? "" : backup.input.title);
    setAuthorNote(backup.input.authorNote ?? "");
    setIsFree(backup.input.isFree);
    setBackup(null);
    touch();
  };

  const discardBackup = () => {
    clearBackup(initial.id);
    setBackup(null);
  };

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
      ? isDraft
        ? "저장하지 못했습니다. 잠시 뒤 다시 시도합니다."
        : "저장하지 못했습니다. 저장 버튼을 다시 눌러 주세요."
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
      {backup && (
        <div className={styles.backup}>
          <p role="status">
            저장하지 못한 내용이 있습니다({timeFormat.format(new Date(backup.savedAt))} 작성). 이어서 쓸까요?
          </p>
          <div className={styles.actions}>
            <Button small disabled={!editor} onClick={restore}>
              복원
            </Button>
            <Button variant="secondary" small onClick={discardBackup}>
              버리기
            </Button>
          </div>
        </div>
      )}

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
