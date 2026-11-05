import type { ReactNode } from "react";
import styles from "./badge.module.scss";

export function Badge({ solid, children }: { solid?: boolean; children: ReactNode }) {
  return <span className={[styles.badge, solid && styles.solid].filter(Boolean).join(" ")}>{children}</span>;
}
