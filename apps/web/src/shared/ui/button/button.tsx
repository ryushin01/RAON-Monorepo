import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./button.module.scss";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface StyleProps {
  variant?: ButtonVariant;
  small?: boolean;
  block?: boolean;
  /** 알약 옆에 원형 화살표를 따로 붙인다. 장식이라 읽지 않는다. */
  arrow?: boolean;
}

function classes({ variant = "primary", small, block, arrow }: StyleProps, className?: string) {
  return [
    styles.button,
    styles[variant],
    small && styles.small,
    block && styles.block,
    arrow && styles.withArrow,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" />
      </svg>
    </span>
  );
}

function withArrow(children: ReactNode, arrow?: boolean) {
  return arrow ? (
    <>
      <span className={styles.label}>{children}</span>
      <Arrow />
    </>
  ) : (
    children
  );
}

export function Button({
  variant,
  small,
  block,
  arrow,
  className,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & StyleProps) {
  return (
    <button type={type} className={classes({ variant, small, block, arrow }, className)} {...props}>
      {withArrow(children, arrow)}
    </button>
  );
}

export function ButtonLink({
  variant,
  small,
  block,
  arrow,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & StyleProps) {
  return (
    <Link className={classes({ variant, small, block, arrow }, className)} {...props}>
      {withArrow(children, arrow)}
    </Link>
  );
}
