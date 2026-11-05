import type { ReactNode } from "react";
import styles from "./notice.module.scss";

/** 오류는 바로 읽어 주고(alert), 그 밖의 안내는 하던 일을 끊지 않고 읽어 준다(status). */
export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={[styles.notice, tone === "error" && styles.error].filter(Boolean).join(" ")}
    >
      {children}
    </p>
  );
}
