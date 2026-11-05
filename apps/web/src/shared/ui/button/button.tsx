import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./button.module.scss";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface StyleProps {
  variant?: ButtonVariant;
  small?: boolean;
  block?: boolean;
}

function classes({ variant = "primary", small, block }: StyleProps, className?: string) {
  return [styles.button, styles[variant], small && styles.small, block && styles.block, className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  small,
  block,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & StyleProps) {
  return <button type={type} className={classes({ variant, small, block }, className)} {...props} />;
}

export function ButtonLink({ variant, small, block, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={classes({ variant, small, block }, className)} {...props} />;
}
