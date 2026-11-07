"use client";

import { useCompletion } from "@ai-sdk/react";
import { closeHistory } from "@tiptap/pm/history";
import type { Editor } from "@tiptap/react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Button, Notice, SelectField } from "@/shared/ui";
import {
  flattenPolished,
  POLISH_MAX_CHARS,
  POLISH_STYLE_LABEL,
  POLISH_STYLES,
  type PolishStyle,
} from "../model/polish";
import styles from "./writing-tools.module.scss";

interface Target {
  from: number;
  to: number;
  text: string;
}

/** 고른 글이 있으면 그 글, 없으면 커서가 있는 단락을 다듬는다. 단락을 넘는 선택은 받지 않는다. */
function readTarget(editor: Editor): Target | string {
  const { from, to, $from, $to } = editor.state.selection;
  if (!$from.sameParent($to)) return "한 단락 안에서 골라 주세요.";
  const start = from === to ? $from.start() : from;
  const end = from === to ? $from.end() : to;
  const text = editor.state.doc.textBetween(start, end, "\n", "\n");
  if (!text.trim()) return "다듬을 글을 고르거나 커서를 단락 안에 두어 주세요.";
  if (text.length > POLISH_MAX_CHARS) return `${POLISH_MAX_CHARS.toLocaleString("ko-KR")}자 이하로 골라 주세요.`;
  return { from: start, to: end, text };
}

/**
 * AI가 다듬은 문장을 보여 주고, 작가가 확인한 뒤에만 본문에 넣는다.
 * 만드는 동안 글자마다 읽어 주면 방해되므로 시작과 끝만 알린다.
 */
export function AiPolish({ editor }: { editor: Editor }) {
  const [style, setStyle] = useState<PolishStyle>("natural");
  const [target, setTarget] = useState<Target | null>(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  const { completion, complete, isLoading, stop, error, setCompletion } = useCompletion({
    api: "/api/ai/polish",
    streamProtocol: "text",
    onFinish: () => {
      setMessage("다듬은 글을 만들었습니다. 확인한 뒤 적용해 주세요.");
      resultRef.current?.focus();
    },
  });

  const start = () => {
    if (isLoading) return;
    const next = readTarget(editor);
    setMessage("");
    if (typeof next === "string") {
      setProblem(next);
      return;
    }
    setProblem("");
    setTarget(next);
    setCompletion("");
    setMessage("다듬는 중입니다.");
    // 다듬는 도중 문체를 바꿔도 이 요청은 누른 때의 문체로 보낸다.
    void complete(next.text, { body: { style } });
  };

  const apply = () => {
    if (!target || !completion.trim()) return;
    // 다듬는 사이에 본문이 바뀌었으면 엉뚱한 곳을 덮어쓰지 않게 적용하지 않는다.
    const current = editor.state.doc.textBetween(target.from, target.to, "\n", "\n");
    if (current !== target.text) {
      setProblem("그사이 본문이 바뀌어 적용하지 않았습니다. 다시 다듬어 주세요.");
      return;
    }
    editor
      .chain()
      .focus()
      // 직전 입력과 한 번에 되돌려지지 않도록 적용을 따로 된 실행 취소 단계로 만든다.
      .command(({ tr }) => {
        closeHistory(tr);
        return true;
      })
      .insertContentAt({ from: target.from, to: target.to }, flattenPolished(completion))
      .run();
    setTarget(null);
    setCompletion("");
    setMessage("본문에 적용했습니다. 실행 취소로 되돌릴 수 있습니다.");
  };

  const discard = () => {
    setTarget(null);
    setCompletion("");
    setMessage("다듬은 글을 버렸습니다.");
  };

  return (
    <>
      <p className={styles.note}>
        고른 글이나 커서가 있는 단락을 Anthropic의 AI로 보내 다듬습니다. 결과는 확인한 뒤에 적용합니다.
      </p>
      <SelectField
        label="문체"
        value={style}
        disabled={isLoading}
        onChange={(event) => setStyle(event.target.value as PolishStyle)}
      >
        {POLISH_STYLES.map((value) => (
          <option key={value} value={value}>
            {POLISH_STYLE_LABEL[value]}
          </option>
        ))}
      </SelectField>
      <div className={styles.actions}>
        <Button variant="secondary" small type="button" aria-disabled={isLoading} onClick={start}>
          다듬기
        </Button>
        {isLoading && (
          <Button variant="ghost" small type="button" onClick={() => stop()}>
            멈추기
          </Button>
        )}
      </div>
      <p className={styles.note} role="status">
        {message}
      </p>
      {problem && <Notice tone="error">{problem}</Notice>}
      {error && <Notice tone="error">{error.message || "다듬지 못했습니다. 잠시 뒤 다시 시도해 주세요."}</Notice>}
      {(completion || isLoading) && (
        <motion.section
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          ref={resultRef}
          className={styles.polished}
          tabIndex={-1}
          aria-label="다듬은 글"
          aria-busy={isLoading}
        >
          <p>{completion || "…"}</p>
        </motion.section>
      )}
      {completion && !isLoading && target && (
        <div className={styles.actions}>
          <Button small type="button" onClick={apply}>
            적용
          </Button>
          <Button variant="secondary" small type="button" onClick={start}>
            다시 다듬기
          </Button>
          <Button variant="ghost" small type="button" onClick={discard}>
            버리기
          </Button>
        </div>
      )}
    </>
  );
}
