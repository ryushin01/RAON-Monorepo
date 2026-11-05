/** 드라이버가 원인을 cause로 감싸므로 끝까지 따라가며 오류 코드를 찾는다. */
function hasCode(error: unknown, code: string): boolean {
  const seen = new Set<unknown>();
  let current = error as { code?: string; cause?: unknown } | undefined;
  while (current && !seen.has(current)) {
    if (current.code === code) return true;
    seen.add(current);
    current = current.cause as typeof current;
  }
  return false;
}

export const isUniqueViolation = (error: unknown) => hasCode(error, "23505");
export const isForeignKeyViolation = (error: unknown) => hasCode(error, "23503");
