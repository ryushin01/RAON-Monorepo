"use client";

import { TextSelection } from "@tiptap/pm/state";
import { type Editor, useEditorState } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Button, TextField } from "@/shared/ui";
import { applyEdits, findRanges, findSymbolEdits, searchKey } from "./writing-extensions";
import styles from "./writing-tools.module.scss";

/** 찾기·바꾸기와 기호 정리. 찾은 곳으로 화면을 옮기지만 초점은 입력 칸에 남겨 이어서 조작할 수 있게 한다. */
export function FindReplace({
  editor,
  initialQuery = "",
  onClose,
}: {
  editor: Editor;
  initialQuery?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState("");
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setQuery(initialQuery);
    setIndex(0);
  }, [initialQuery]);

  const ranges = useEditorState({
    editor,
    selector: ({ editor: current }) => findRanges(current.state.doc, query),
  });
  const position = ranges.length ? Math.min(index, ranges.length - 1) : -1;
  const current = ranges[position] ?? null;

  // 표시만 바꾸는 트랜잭션이라 변경 사항이나 실행 취소 기록에 남지 않는다.
  const from = current?.from;
  const to = current?.to;
  useEffect(() => {
    const range = from !== undefined && to !== undefined ? { from, to } : null;
    editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query, current: range }));
  }, [editor, query, from, to]);
  useEffect(
    () => () => {
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query: "", current: null }));
    },
    [editor],
  );

  const reveal = (next: number) => {
    const range = ranges[next];
    if (!range) return;
    setIndex(next);
    const { tr, doc } = editor.state;
    editor.view.dispatch(tr.setSelection(TextSelection.create(doc, range.from, range.to)).scrollIntoView());
  };
  const move = (delta: number) => {
    if (ranges.length) reveal((position + delta + ranges.length) % ranges.length);
  };

  const replaceCurrent = () => {
    if (!current) return;
    editor.view.dispatch(applyEdits(editor.state.tr, [{ ...current, text: replacement }]));
    setMessage("1건 바꿨습니다.");
  };
  const replaceAll = () => {
    if (!ranges.length) return;
    editor.view.dispatch(
      applyEdits(
        editor.state.tr,
        ranges.map((range) => ({ ...range, text: replacement })),
      ),
    );
    setIndex(0);
    setMessage(`${ranges.length}건 바꿨습니다.`);
  };
  const normalize = () => {
    const edits = findSymbolEdits(editor.state.doc);
    if (edits.length) editor.view.dispatch(applyEdits(editor.state.tr, edits));
    setMessage(edits.length ? `기호 ${edits.length}곳을 바꿨습니다.` : "바꿀 기호가 없습니다.");
  };

  return (
    <search className={styles.find}>
      <form
        className={styles.findForm}
        onSubmit={(event) => {
          event.preventDefault();
          move(1);
        }}
      >
        <TextField
          label="찾을 글자"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
            setMessage("");
          }}
        />
        <TextField
          label="바꿀 글자"
          value={replacement}
          hint="비워 두면 찾은 글자를 지웁니다."
          onChange={(event) => setReplacement(event.target.value)}
        />
        <div className={styles.actions}>
          <Button variant="secondary" small type="button" disabled={!ranges.length} onClick={() => move(-1)}>
            이전
          </Button>
          <Button variant="secondary" small type="submit" disabled={!ranges.length}>
            다음
          </Button>
          <Button variant="secondary" small type="button" disabled={!current} onClick={replaceCurrent}>
            바꾸기
          </Button>
          <Button variant="secondary" small type="button" disabled={!ranges.length} onClick={replaceAll}>
            모두 바꾸기
          </Button>
          <Button variant="secondary" small type="button" onClick={normalize}>
            기호 정리
          </Button>
          <Button variant="ghost" small type="button" onClick={onClose}>
            찾기 닫기
          </Button>
        </div>
      </form>
      <p className={styles.note} role="status">
        {message || (query ? (ranges.length ? `${position + 1} / ${ranges.length}건` : "찾은 글자가 없습니다.") : "")}
      </p>
    </search>
  );
}
