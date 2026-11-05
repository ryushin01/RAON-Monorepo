import { useEffect, useRef } from "react";

interface AutosaveOptions {
  /** 입력이 바뀔 때마다 늘어나는 번호 */
  revision: number;
  /** 서버에 저장을 마친 번호 */
  savedRevision: number;
  /** 저장에 실패한 번호. 입력이 다시 바뀌기 전에는 재시도하지 않는다. */
  failedRevision: number | null;
  enabled: boolean;
  isSaving: boolean;
  delayMs: number;
  save: () => void;
}

/**
 * 입력이 멈추면 저장한다. 저장 중에 입력이 바뀌면 저장이 끝난 뒤 다시 저장한다.
 * 화면을 떠날 때 남은 변경 사항도 저장한다.
 */
export function useAutosave({
  revision,
  savedRevision,
  failedRevision,
  enabled,
  isSaving,
  delayMs,
  save,
}: AutosaveOptions) {
  const saveRef = useRef(save);
  const pendingRef = useRef(false);
  const dirty = revision !== savedRevision;

  useEffect(() => {
    saveRef.current = save;
    pendingRef.current = enabled && dirty && !isSaving;
  });

  useEffect(() => {
    if (!enabled || !dirty || isSaving || revision === failedRevision) return;
    const timer = setTimeout(() => saveRef.current(), delayMs);
    return () => clearTimeout(timer);
  }, [enabled, dirty, isSaving, revision, failedRevision, delayMs]);

  useEffect(
    () => () => {
      if (pendingRef.current) saveRef.current();
    },
    [],
  );
}
