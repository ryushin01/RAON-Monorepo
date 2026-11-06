"use client";

import {
  countChars,
  countCharsWithSpaces,
  type EpisodeDoc,
  type EpisodeInput,
  type StudioEpisode,
} from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatDateTime } from "@/shared/lib";
import { Button, ButtonLink, Notice, TextAreaField, TextField } from "@/shared/ui";
import { fetchEpisode, saveEpisode, setEpisodePublished } from "../api/actions";
import { UNTITLED } from "../model/constants";
import { clearBackup, type DraftBackup, loggedOutSince, readBackup, writeBackup } from "../model/draft-backup";
import { DEFAULT_EDITOR_PREFS, readEditorPrefs, subscribeEditorPrefs, toggleEditorPref } from "../model/editor-prefs";
import { isScheduled, toPublishAt } from "../model/schedule";
import { useAutosave } from "../model/use-autosave";
import { CharGoal } from "./char-goal";
import styles from "./episode-editor.module.scss";
import { editorExtensions } from "./extensions";
import { FindReplace } from "./find-replace";
import { WritingTools } from "./writing-tools";

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

/**
 * Next는 지나간 화면을 숨겨 둔다. 그동안 Tiptap은 파괴되지만 React 상태는 남아서, 그대로 돌아오면 본문만 옛 내용이고
 * 제목은 수정본인 채 저장될 수 있다. 그래서 돌아올 때마다 서버에서 최신 회차를 읽어 에디터를 새로 시작한다.
 * 저장하지 못한 입력은 백업에 있으므로 복원을 제안한다.
 */
export function EpisodeEditor({ episode }: { episode: StudioEpisode }) {
  const [current, setCurrent] = useState(episode);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState<"ready" | "refreshing" | "failed">("ready");
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const shown = useRef(false);
  const attempt = useRef(0);
  const regionRef = useRef<HTMLDivElement>(null);

  const refresh = (announceDone = false) => {
    attempt.current += 1;
    const id = attempt.current;
    setStatus("refreshing");
    // 사용자가 직접 다시 시도했을 때만 시작과 완료를 스크린 리더에 알린다.
    setNotice(announceDone ? "최신 내용을 불러오는 중입니다." : "");
    fetchEpisode(episode.id)
      .then((result) => {
        if (id !== attempt.current) return;
        // 옛 내용으로 다시 시작하면 최신 원고를 덮어쓸 수 있으므로, 읽지 못하면 편집 칸을 열지 않는다.
        if (!result.ok) {
          setFailure(result.message);
          setNotice("");
          setStatus("failed");
          return;
        }
        setCurrent(result.data);
        setGeneration((value) => value + 1);
        setStatus("ready");
        if (announceDone) setNotice("최신 내용을 불러왔습니다.");
      })
      .catch(() => {
        if (id !== attempt.current) return;
        setFailure("네트워크를 확인한 뒤 다시 시도해 주세요.");
        setNotice("");
        setStatus("failed");
      });
  };

  // 다시 시도 버튼은 읽는 동안 사라지므로, 초점을 항상 남아 있는 영역으로 옮겨 페이지 처음으로 튕기지 않게 한다.
  const retry = () => {
    regionRef.current?.focus();
    refresh(true);
  };

  // 화면이 그려지기 전에 편집 칸을 내려서, 다시 읽는 동안 쓴 글이 교체로 사라지는 일이 없게 한다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 화면에 다시 나타날 때만 실행한다.
  useLayoutEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    refresh();
    return () => {
      attempt.current += 1;
    };
  }, [episode.id]);

  return (
    <div ref={regionRef} tabIndex={-1}>
      <p role="status" className="visually-hidden">
        {notice}
      </p>
      {status === "refreshing" && <p aria-busy="true">최신 내용을 불러오는 중입니다.</p>}
      {status === "failed" && (
        <div className={styles.backup}>
          <p role="alert">최신 내용을 불러오지 못했습니다. {failure}</p>
          <div className={styles.actions}>
            <Button small onClick={retry}>
              다시 시도
            </Button>
          </div>
        </div>
      )}
      {status === "ready" && <EpisodeEditorBody key={generation} episode={current} />}
    </div>
  );
}

function EpisodeEditorBody({ episode: initial }: { episode: StudioEpisode }) {
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
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleError, setScheduleError] = useState<string>();
  const scheduleInputRef = useRef<HTMLInputElement>(null);
  const prefs = useSyncExternalStore(subscribeEditorPrefs, readEditorPrefs, () => DEFAULT_EDITOR_PREFS);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");

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
  const discarded = useRef(false);
  const openedAt = useRef(0);
  const touch = () => setRevision((value) => value + 1);
  const dirty = revision !== savedRevision;
  const isDraft = episode.status !== "PUBLISHED";
  // 공개 시각이 지나면 화면을 다시 그려야 하므로 현재 시각을 상태로 둔다.
  const [now, setNow] = useState(() => Date.now());
  const scheduled = !isDraft && isScheduled(episode.publishedAt, now);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 긴 예약은 타이머가 끝날 때 now가 바뀌어 다시 잰다.
  useEffect(() => {
    if (!scheduled || !episode.publishedAt) return;
    // setTimeout이 다룰 수 있는 최대 시간(약 24일)을 넘으면 그때 다시 잰다.
    const wait = Math.min(Date.parse(episode.publishedAt) - Date.now(), 2 ** 31 - 1);
    const timer = setTimeout(() => setNow(Date.now()), Math.max(wait, 0));
    return () => clearTimeout(timer);
  }, [scheduled, episode.publishedAt, now]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: initial.content,
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-labelledby": contentLabelId, "aria-multiline": "true", role: "textbox" },
    },
    // 도구 모음과 글자 수는 트랜잭션 때 다시 계산하는데, 문서가 준비된 뒤에는 트랜잭션이 없어 0자로 남는다.
    // 내용이 바뀌지 않는 빈 트랜잭션이라 변경 사항이나 실행 취소 기록에는 남지 않는다.
    onCreate: ({ editor: created }) => created.view.dispatch(created.state.tr.setMeta("addToHistory", false)),
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
            charsWithSpaces: countCharsWithSpaces(current.getJSON() as EpisodeDoc),
          }
        : null,
  });

  useEffect(() => {
    if (editor) editor.storage.smartInput.enabled = prefs.smartInput;
  }, [editor, prefs.smartInput]);

  // 쓰고 있는 줄을 화면 가운데에 둔다. 다른 입력 칸에 있을 때는 화면을 옮기지 않는다.
  useEffect(() => {
    if (!editor || !prefs.typewriter) return;
    const center = () => {
      if (!editor.view.hasFocus()) return;
      const { top } = editor.view.coordsAtPos(editor.state.selection.head);
      window.scrollBy({ top: top - window.innerHeight / 2 });
    };
    editor.on("selectionUpdate", center);
    return () => {
      editor.off("selectionUpdate", center);
    };
  }, [editor, prefs.typewriter]);

  const save = useMutation({
    // 같은 scope의 저장은 앞의 요청이 끝난 뒤에 나간다. 늦게 끝난 옛 요청이 최신 원고를 덮어쓰지 않게 한다.
    scope: { id: `episode-save:${initial.id}` },
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
    mutationFn: async ({ published, publishAt }: { published: boolean; publishAt?: string }) => {
      const result = await setEpisodePublished(episode.workId, initial.id, published, publishAt);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved) => {
      setEpisode(saved);
      setNow(Date.now());
      setAnnouncement(
        saved.status !== "PUBLISHED"
          ? "비공개로 바꿨습니다."
          : isScheduled(saved.publishedAt)
            ? "예약했습니다."
            : "공개했습니다.",
      );
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
      // 다른 탭에서 로그아웃했다면 원고를 브라우저에 남기지 않는다.
      if (loggedOutSince(openedAt.current) || discarded.current) return;
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
  useEffect(() => {
    openedAt.current = Date.now();
    return () => backupRef.current();
  }, []);
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

  // onClick이 아니라 onNavigate를 쓴다. Ctrl·Cmd 클릭은 새 탭으로 열려 이 화면을 떠나지 않으므로 호출되지 않는다.
  const onLeave = (event: { preventDefault: () => void }) => {
    // 초안은 떠날 때 자동 저장되므로 묻지 않는다. 다만 저장이 이미 실패했다면 떠난 뒤에는 알릴 방법이 없어 묻는다.
    const failed = failedRevision !== null;
    if (!dirty || (isDraft && !failed)) return;
    const message = failed
      ? "저장하지 못했습니다. 입력한 내용은 이 브라우저에 백업합니다. 그래도 나갈까요?"
      : "저장하지 않은 변경 사항이 있습니다. 저장하지 않고 나갈까요?";
    if (!window.confirm(message)) {
      event.preventDefault();
    } else if (!failed) {
      // 버리기로 했으니 백업도 남기지 않는다.
      discarded.current = true;
      // 복원 여부를 고르지 않은 이전 백업은 이번 입력과 다른 원고이므로 남긴다.
      if (!backupPending.current) clearBackup(initial.id);
    }
  };

  const onSave = () => {
    const request = collect(true);
    if (request) save.mutate(request);
  };

  const onPublish = async (publishAt?: string) => {
    const request = collect(true);
    if (!request) return;
    // 지금 화면의 내용을 먼저 저장한 뒤 공개한다.
    if (dirty) {
      const saved = await save.mutateAsync(request).catch(() => null);
      if (!saved) return;
    }
    publish.mutate({ published: true, publishAt });
  };

  const onCancelSchedule = () => {
    // 화면이 갱신되기 직전에 눌러도 이미 공개된 회차를 내리지 않게 한 번 더 확인한다.
    if (isScheduled(episode.publishedAt)) publish.mutate({ published: false });
    else setNow(Date.now());
  };

  const onSchedule = () => {
    const publishAt = toPublishAt(scheduleAt);
    setScheduleError(publishAt ? undefined : "예약 시각을 입력해 주세요.");
    if (publishAt) void onPublish(publishAt);
    else scheduleInputRef.current?.focus();
  };

  // 브라우저의 페이지 저장 대신 원고를 저장한다. 조합 키라 글자 입력과 겹치지 않는다(KWCAG 6.1.4).
  const busy = save.isPending || publish.isPending;
  const saveShortcut = useRef(onSave);
  useEffect(() => {
    // 저장 버튼이 막힌 동안에는 단축키도 막아 중복 저장을 만들지 않는다.
    saveShortcut.current = () => {
      if (!busy && editor) onSave();
    };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        // 누르고 있어도 한 번만 저장한다.
        if (!event.repeat) saveShortcut.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
          {episode.number}화 ·{" "}
          {isDraft
            ? "초안"
            : scheduled && episode.publishedAt
              ? `예약 ${formatDateTime(episode.publishedAt)}`
              : "공개 중"}{" "}
          · {stateText}
        </p>
        <div className={styles.actions}>
          <ButtonLink variant="ghost" small href={`/studio/works/${episode.workId}`} onNavigate={onLeave}>
            작품 관리로
          </ButtonLink>
          <Button variant="secondary" small onClick={onSave} disabled={busy || !editor}>
            저장
          </Button>
          {isDraft ? (
            <Button small onClick={() => void onPublish()} disabled={busy || !editor}>
              공개하기
            </Button>
          ) : scheduled ? (
            <>
              <Button small disabled={busy || !editor} onClick={() => void onPublish()}>
                지금 공개
              </Button>
              <Button variant="secondary" small disabled={busy} onClick={onCancelSchedule}>
                예약 취소
              </Button>
            </>
          ) : (
            <Button variant="secondary" small disabled={busy} onClick={() => publish.mutate({ published: false })}>
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

      <div hidden={prefs.focus}>
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
      </div>

      <div className={styles.surface}>
        <span id={contentLabelId} className={styles.label}>
          본문
        </span>
        <div className={styles.toolbar}>
          {/* biome-ignore lint/a11y/useSemanticElements: 입력 요소가 아닌 서식 버튼 묶음이라 fieldset이 맞지 않는다. */}
          <div className={styles.group} role="group" aria-label="본문 서식">
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
          {/* biome-ignore lint/a11y/useSemanticElements: 입력 요소가 아닌 보기 버튼 묶음이라 fieldset이 맞지 않는다. */}
          <div className={styles.group} role="group" aria-label="집필 보기">
            <button type="button" aria-pressed={prefs.focus} onClick={() => toggleEditorPref("focus")}>
              집중 모드
            </button>
            <button type="button" aria-pressed={prefs.typewriter} onClick={() => toggleEditorPref("typewriter")}>
              타이프라이터
            </button>
            <button type="button" aria-pressed={prefs.dim} onClick={() => toggleEditorPref("dim")}>
              현재 단락만
            </button>
            <button type="button" aria-pressed={prefs.smartInput} onClick={() => toggleEditorPref("smartInput")}>
              자동 따옴표
            </button>
            <button type="button" aria-pressed={findOpen} onClick={() => setFindOpen((value) => !value)}>
              찾기·바꾸기
            </button>
          </div>
        </div>
        {findOpen && editor && (
          <FindReplace editor={editor} initialQuery={findQuery} onClose={() => setFindOpen(false)} />
        )}
        <EditorContent editor={editor} className={styles.content} data-dim={prefs.dim || undefined} />
        <CharGoal
          withSpaces={toolbar?.charsWithSpaces ?? 0}
          withoutSpaces={toolbar?.chars ?? 0}
          compact={prefs.focus}
        />
      </div>

      {editor && !prefs.focus && (
        <WritingTools
          editor={editor}
          chars={toolbar?.charsWithSpaces ?? 0}
          onFind={(text) => {
            setFindQuery(text);
            setFindOpen(true);
          }}
        />
      )}

      {isDraft && !prefs.focus && (
        <div className={styles.schedule}>
          <TextField
            ref={scheduleInputRef}
            label="예약 공개 시각(한국 시간)"
            type="datetime-local"
            value={scheduleAt}
            error={scheduleError}
            hint="이 시각이 되면 독자에게 보입니다."
            onChange={(event) => setScheduleAt(event.target.value)}
          />
          <Button variant="secondary" disabled={busy || !editor} onClick={onSchedule}>
            예약 공개
          </Button>
        </div>
      )}

      <label className={styles.check} hidden={prefs.focus}>
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

      <div hidden={prefs.focus}>
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
    </div>
  );
}
