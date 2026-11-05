import { useEffect, useRef } from "react";

interface AutosaveOptions {
  /** 입력이 바뀔 때마다 늘어나는 번호 */
  revision: number;
  /** 서버에 저장을 마친 번호 */
  savedRevision: number;
  /** 저장에 실패한 번호. 이 번호면 더 오래 기다린 뒤 다시 시도한다. */
  failedRevision: number | null;
  enabled: boolean;
  isSaving: boolean;
  delayMs: number;
  retryMs: number;
  save: () => void;
}

/**
 * 입력이 멈추면 저장한다. 저장 중에 입력이 바뀌면 저장이 끝난 뒤 다시 저장하고,
 * 실패하면 시간을 두고 다시 시도한다. 화면을 떠날 때 남은 변경 사항도 저장한다.
 */
export function useAutosave({
  revision,
  savedRevision,
  failedRevision,
  enabled,
  isSaving,
  delayMs,
  retryMs,
  save,
}: AutosaveOptions) {
  const saveRef = useRef(save);
  const pendingRef = useRef(false);
  const dirty = revision !== savedRevision;

  useEffect(() => {
    saveRef.current = save;
    // 저장 중이어도 그 뒤에 입력한 내용이 남아 있으면 떠날 때 한 번 더 보낸다.
    pendingRef.current = enabled && dirty;
  });

  const waitMs = revision === failedRevision ? retryMs : delayMs;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 입력이 바뀔 때마다 대기 시간을 다시 재기 위해 revision을 넣었다.
  useEffect(() => {
    if (!enabled || !dirty || isSaving) return;
    const timer = setTimeout(() => saveRef.current(), waitMs);
    return () => clearTimeout(timer);
  }, [enabled, dirty, isSaving, waitMs, revision]);

  useEffect(
    () => () => {
      if (pendingRef.current) saveRef.current();
    },
    [],
  );
}
