"use client";

import { GENRE_LABEL, GENRES, WORK_FORMAT_LABEL, WORK_FORMATS, type WorkFormat } from "@raon/contracts";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { MODE_COOKIE } from "@/shared/config";
import { readPreference, writePreference } from "@/shared/lib";
import { currentMode, MODE_HOME, modeWorksHref } from "../model/mode";
import styles from "./mode-nav.module.scss";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function chooseMode(mode: WorkFormat) {
  writePreference(MODE_COOKIE, mode);
  for (const listener of listeners) listener();
}

/** 웹툰과 웹소설을 오가는 탭과 그 모드의 메뉴. 처음 그릴 때는 쿠키를 읽지 못해 기본 모드로 그린다. */
export function ModeNav() {
  const pathname = usePathname();
  const format = useSearchParams().get("format");
  const saved = useSyncExternalStore(
    subscribe,
    () => readPreference(MODE_COOKIE),
    () => undefined,
  );
  const mode = currentMode(pathname, format, saved);

  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      <ul className={styles.modes}>
        {WORK_FORMATS.map((item) => (
          <li key={item}>
            <Link
              href={MODE_HOME[item]}
              aria-current={item === mode ? "true" : undefined}
              onClick={() => chooseMode(item)}
            >
              {/* 고른 탭의 바탕이 옆 탭으로 미끄러져 옮겨 간다. 장식이라 읽지 않는다. */}
              {item === mode && (
                <motion.span
                  layoutId="mode-indicator"
                  className={styles.indicator}
                  data-indicator=""
                  aria-hidden="true"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                />
              )}
              <span className={styles.label}>{WORK_FORMAT_LABEL[item]}</span>
            </Link>
          </li>
        ))}
      </ul>
      <ul className={styles.menu}>
        <li>
          <Link href={modeWorksHref(mode)}>전체 작품</Link>
        </li>
        <li>
          <Link href={modeWorksHref(mode, "status=COMPLETED")}>완결</Link>
        </li>
        {GENRES.map((genre) => (
          <li key={genre}>
            <Link href={modeWorksHref(mode, `genre=${genre}`)}>{GENRE_LABEL[genre]}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
