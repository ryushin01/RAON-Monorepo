const PG_UNIQUE_VIOLATION = "23505";

/** 드라이버가 원인을 cause로 감싸므로 끝까지 따라가며 유일 제약 위반인지 본다. */
export function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error as { code?: string; cause?: unknown } | undefined;
  while (current && !seen.has(current)) {
    if (current.code === PG_UNIQUE_VIOLATION) return true;
    seen.add(current);
    current = current.cause as typeof current;
  }
  return false;
}
