"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./comic-auto-scroll.module.scss";

const SPEEDS = [
  { label: "느리게", pixelsPerSecond: 40 },
  { label: "보통", pixelsPerSecond: 80 },
  { label: "빠르게", pixelsPerSecond: 160 },
] as const;

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

/** 사용자가 켤 때만 움직이고, 언제든 끄거나 직접 스크롤하면 멈춘다(KWCAG 6.2.2). */
export function ComicAutoScroll() {
  const [running, setRunning] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const speedId = useId();
  const speed = useRef<number>(SPEEDS[1].pixelsPerSecond);
  speed.current = SPEEDS[speedIndex]?.pixelsPerSecond ?? SPEEDS[1].pixelsPerSecond;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      // 스크롤은 정수 단위로 반영되므로 소수점을 모아 느린 속도에서도 움직이게 한다.
      carry += ((now - last) / 1000) * speed.current;
      last = now;
      const pixels = Math.floor(carry);
      if (pixels > 0) {
        carry -= pixels;
        window.scrollBy({ top: pixels, behavior: "instant" });
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1) {
        setRunning(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    const stop = () => setRunning(false);
    const onKey = (event: KeyboardEvent) => {
      // 켜고 끄는 버튼의 스페이스 키까지 멈춤으로 보면 눌렀을 때 곧바로 다시 켜진다.
      if (SCROLL_KEYS.has(event.key) && !(event.target instanceof HTMLButtonElement)) stop();
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", onKey);
    };
  }, [running]);

  return (
    <div className={styles.control}>
      <button type="button" className={styles.toggle} aria-pressed={running} onClick={() => setRunning((on) => !on)}>
        {running ? "자동 스크롤 멈춤" : "자동 스크롤"}
      </button>
      <label htmlFor={speedId} className="visually-hidden">
        자동 스크롤 속도
      </label>
      <select
        id={speedId}
        className={styles.speed}
        value={speedIndex}
        onChange={(event) => setSpeedIndex(Number(event.target.value))}
      >
        {SPEEDS.map(({ label }, index) => (
          <option key={label} value={index}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
