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

/**
 * 셀렉트 화살표. 브라우저 기본 화살표는 위치를 맞출 수 없어 숨기고 이것을 둡니다.
 * 감싼 요소의 `--select-inset`(셀렉트의 테두리 + 왼쪽 안쪽 여백)만큼 오른쪽 끝에서 떨어져, 오른쪽 간격이 글자 왼쪽 간격과 같습니다.
 * 꾸밈이라 보조기기에서 숨기고 누름을 셀렉트로 넘깁니다.
 */
export function SelectChevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" focusable="false">
      <path
        d="M1 1.5 6 6.5 11 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SelectField({ label, hint, error, ...props }: FieldProps & ComponentProps<"select">) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {(a11y) => (
        <div className={styles.selectWrap}>
          <select className={`${styles.control} ${styles.select}`} {...a11y} {...props} />
          <SelectChevron />
        </div>
      )}
    </Field>
  );
}
