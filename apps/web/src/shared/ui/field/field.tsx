import { type ComponentProps, type ReactElement, type ReactNode, useId } from "react";
import styles from "./field.module.scss";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & {
  required?: boolean;
  children: (a11y: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactElement;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required && <span className={styles.required}> (필수)</span>}
      </label>
      {children({ id, ...(error ? { "aria-invalid": true } : {}), "aria-describedby": describedBy })}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, hint, error, ...props }: FieldProps & ComponentProps<"input">) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {(a11y) => <input className={styles.control} type="text" {...a11y} {...props} />}
    </Field>
  );
}

export function TextAreaField({ label, hint, error, ...props }: FieldProps & ComponentProps<"textarea">) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {(a11y) => <textarea className={styles.control} {...a11y} {...props} />}
    </Field>
  );
}

export function SelectField({ label, hint, error, ...props }: FieldProps & ComponentProps<"select">) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {(a11y) => <select className={styles.control} {...a11y} {...props} />}
    </Field>
  );
}
