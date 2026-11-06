"use client";

import type { EpisodeDoc } from "@raon/contracts";
import { type Editor, useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PHRASES_KEY } from "@/shared/config";
import { Button, TextField } from "@/shared/ui";
import { analyzeParagraphs, findRepetitions, type Repetition } from "../model/text-analysis";
import styles from "./writing-tools.module.scss";

const docOf = (editor: Editor) => editor.getJSON() as EpisodeDoc;

function ParagraphAnalysis({ editor }: { editor: Editor }) {
  const stats = useEditorState({ editor, selector: ({ editor: current }) => analyzeParagraphs(docOf(current)) });
  const total = stats.dialogue.chars + stats.monologue.chars + stats.description.chars;
  const rows = [
    ["대사", stats.dialogue],
    ["독백", stats.monologue],
    ["서술", stats.description],
  ] as const;
  return (
    <table className={styles.table}>
      <caption className="visually-hidden">단락 종류별 분량</caption>
      <thead>
        <tr>
          <th scope="col">종류</th>
          <th scope="col">단락</th>
          <th scope="col">글자</th>
          <th scope="col">비율</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, entry]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{entry.paragraphs.toLocaleString("ko-KR")}</td>
            <td>{entry.chars.toLocaleString("ko-KR")}</td>
            <td>{total ? Math.round((entry.chars / total) * 100) : 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RepetitionList({
  title,
  items,
  onFind,
}: {
  title: string;
  items: Repetition[];
  onFind: (text: string) => void;
}) {
  return (
    <div>
      <h4 className={styles.subheading}>{title}</h4>
      {items.length ? (
        <ul className={styles.chips}>
          {items.map(({ text, count }) => (
            <li key={text}>
              <Button variant="secondary" small type="button" onClick={() => onFind(text)}>
                {text} {count}회
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>세 번 이상 나온 표현이 없습니다.</p>
      )}
    </div>
  );
}

function Repetitions({ editor, onFind }: { editor: Editor; onFind: (text: string) => void }) {
  const { words, endings } = useEditorState({
    editor,
    selector: ({ editor: current }) => findRepetitions(docOf(current)),
  });
  return (
    <>
      <RepetitionList title="반복한 낱말" items={words} onFind={onFind} />
      <RepetitionList title="반복한 문장 끝맺음" items={endings} onFind={onFind} />
      <p className={styles.note}>누르면 본문에서 찾습니다.</p>
    </>
  );
}

const pad = (value: number) => String(value).padStart(2, "0");

/** 사용자가 시작할 때만 움직인다. 매초 읽어 주지 않도록 시간에는 알림 역할을 주지 않는다. */
export function WritingTimer({ chars }: { chars: number }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startChars = useRef(chars);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const added = Math.max(chars - startChars.current, 0);
  const perMinute = elapsed >= 60 ? Math.round((added / elapsed) * 60) : null;

  return (
    <>
      <p className={styles.timer}>
        {pad(Math.floor(elapsed / 3600))}:{pad(Math.floor(elapsed / 60) % 60)}:{pad(elapsed % 60)}
      </p>
      <p className={styles.note}>
        늘어난 글자 {added.toLocaleString("ko-KR")}자
        {perMinute === null ? " · 1분이 지나면 속도를 보여 줍니다." : ` · 분당 ${perMinute.toLocaleString("ko-KR")}자`}
      </p>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          small
          type="button"
          onClick={() => {
            // 멈췄던 시간부터 이어서 잰다.
            if (!running) startedAt.current = Date.now() - elapsed * 1000;
            setRunning(!running);
          }}
        >
          {running ? "타이머 멈춤" : "타이머 시작"}
        </Button>
        <Button
          variant="ghost"
          small
          type="button"
          onClick={() => {
            setRunning(false);
            setElapsed(0);
            startChars.current = chars;
          }}
        >
          타이머 초기화
        </Button>
      </div>
    </>
  );
}

const MAX_PHRASES = 50;
const MAX_PHRASE_LENGTH = 200;
const SYMBOLS = ["…", "—", "「", "」", "『", "』", "※", "♡"];

const phraseListeners = new Set<() => void>();
const NO_PHRASES: string[] = [];
let cachedRaw: string | null = null;
let cachedPhrases = NO_PHRASES;

function readPhrases(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PHRASES_KEY);
  } catch {
    return NO_PHRASES;
  }
  if (raw === cachedRaw) return cachedPhrases;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedPhrases = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    cachedPhrases = NO_PHRASES;
  }
  return cachedPhrases;
}

/** 저장 공간이 가득 차거나 저장소가 막혀 있으면 false를 돌려준다. */
function writePhrases(phrases: string[]): boolean {
  try {
    window.localStorage.setItem(PHRASES_KEY, JSON.stringify(phrases));
  } catch {
    return false;
  }
  for (const listener of phraseListeners) listener();
  return true;
}

const SAVE_FAILED = "이 브라우저에 저장하지 못했습니다. 저장 공간을 확인해 주세요.";

function subscribePhrases(listener: () => void) {
  phraseListeners.add(listener);
  return () => {
    phraseListeners.delete(listener);
  };
}

function Phrases({ editor }: { editor: Editor }) {
  const phrases = useSyncExternalStore(subscribePhrases, readPhrases, () => NO_PHRASES);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  // HTML로 해석되지 않도록 문자열이 아니라 글자 노드로 넣는다.
  const insert = (text: string) => editor.chain().focus().insertContent({ type: "text", text }).run();

  return (
    <>
      <ul className={styles.chips} aria-label="특수문자">
        {SYMBOLS.map((symbol) => (
          <li key={symbol}>
            <Button
              variant="secondary"
              small
              type="button"
              aria-label={`${symbol} 넣기`}
              onClick={() => insert(symbol)}
            >
              {symbol}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className={styles.phraseForm}
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return setError("등록할 상용구를 입력해 주세요.");
          if (phrases.includes(text)) return setError("이미 등록한 상용구입니다.");
          if (phrases.length >= MAX_PHRASES) return setError(`상용구는 ${MAX_PHRASES}개까지 등록할 수 있습니다.`);
          // 저장하지 못하면 입력을 남겨 다시 시도할 수 있게 한다.
          if (!writePhrases([...phrases, text])) return setError(SAVE_FAILED);
          setDraft("");
          setError(undefined);
        }}
      >
        <TextField
          label="새 상용구"
          value={draft}
          maxLength={MAX_PHRASE_LENGTH}
          error={error}
          hint="이 브라우저에 저장합니다."
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button variant="secondary" small type="submit">
          상용구 등록
        </Button>
      </form>
      {phrases.length > 0 && (
        <ul className={styles.phraseList}>
          {phrases.map((phrase) => (
            <li key={phrase}>
              <span className={styles.phraseText}>{phrase}</span>
              <Button
                variant="secondary"
                small
                type="button"
                aria-label={`넣기: ${phrase}`}
                onClick={() => insert(phrase)}
              >
                넣기
              </Button>
              <Button
                variant="ghost"
                small
                type="button"
                aria-label={`삭제: ${phrase}`}
                onClick={() =>
                  setError(writePhrases(phrases.filter((item) => item !== phrase)) ? undefined : SAVE_FAILED)
                }
              >
                삭제
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** 접힌 도구는 그리지 않아서 입력할 때마다 분석하는 비용이 들지 않는다. */
function Tool({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className={styles.tool} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{title}</summary>
      {open && <div className={styles.toolBody}>{children}</div>}
    </details>
  );
}

export function WritingTools({
  editor,
  chars,
  onFind,
}: {
  editor: Editor;
  chars: number;
  onFind: (text: string) => void;
}) {
  return (
    <section className={styles.tools} aria-label="집필 도구">
      <h3 className={styles.heading}>집필 도구</h3>
      <Tool title="단락 분석">
        <ParagraphAnalysis editor={editor} />
      </Tool>
      <Tool title="반복 표현">
        <Repetitions editor={editor} onFind={onFind} />
      </Tool>
      <Tool title="집필 타이머">
        <WritingTimer chars={chars} />
      </Tool>
      <Tool title="상용구와 특수문자">
        <Phrases editor={editor} />
      </Tool>
    </section>
  );
}
