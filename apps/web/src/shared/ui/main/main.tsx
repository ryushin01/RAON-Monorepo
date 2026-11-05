"use client";

import { type ComponentProps, useLayoutEffect, useRef } from "react";

/**
 * 페이지의 본문 영역.
 *
 * Next는 지나간 화면을 지우지 않고 display:none으로 숨겨 둔다(Activity). 그대로면 문서에 main과 id="main"이
 * 여러 개 남아 HTML 표준과 KWCAG 8.1.1을 어기고, 본문 바로가기가 숨겨진 화면으로 갈 수 있다.
 * 그래서 화면이 숨겨지는 동안에는 hidden을 붙이고 id를 뗀다.
 */
export function Main(props: ComponentProps<"main">) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.hidden = false;
    element.id = "main";
    return () => {
      element.hidden = true;
      element.removeAttribute("id");
    };
  }, []);

  return <main ref={ref} id="main" tabIndex={-1} {...props} />;
}
