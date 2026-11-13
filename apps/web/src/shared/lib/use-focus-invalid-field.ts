"use client";

import { type RefObject, useEffect } from "react";

/**
 * 오류를 그린 뒤 폼의 첫 번째 잘못된 칸(aria-invalid="true")으로 초점을 옮긴다(KWCAG 7.3.1 오류 정정).
 * errors가 새로 올 때마다 다시 옮긴다. fallback 선택자를 주면 잘못된 칸이 없을 때(처음 열 때) 그 칸으로 옮긴다.
 * 두 선택자를 한 번에 찾으면 문서 순서상 앞의 칸이 먼저 잡히므로 잘못된 칸부터 따로 찾는다.
 */
export function useFocusInvalidField(formRef: RefObject<HTMLFormElement | null>, errors: unknown, fallback?: string) {
  useEffect(() => {
    if (!errors && !fallback) return;
    const form = formRef.current;
    const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? (fallback ? form?.querySelector<HTMLElement>(fallback) : null))?.focus();
  }, [formRef, errors, fallback]);
}
