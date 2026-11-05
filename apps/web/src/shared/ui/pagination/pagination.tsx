import Link from "next/link";
import styles from "./pagination.module.scss";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** 쪽 번호로 주소를 만든다. */
  hrefFor: (page: number) => string;
}

/** 처음, 끝, 현재 쪽 앞뒤만 남기고 나머지는 줄임표로 묶는다. */
export function visiblePages(page: number, last: number): (number | "gap")[] {
  const pages = [...new Set([1, page - 1, page, page + 1, last])]
    .filter((p) => p >= 1 && p <= last)
    .sort((a, b) => a - b);
  return pages.flatMap((p, index) => {
    const previous = pages[index - 1];
    return previous !== undefined && p - previous > 1 ? (["gap", p] as const) : ([p] as const);
  });
}

export function Pagination({ page, pageSize, total, hrefFor }: PaginationProps) {
  const last = Math.ceil(total / pageSize);
  if (last <= 1) return null;

  return (
    <nav aria-label="쪽 이동">
      <ul className={styles.list}>
        {visiblePages(page, last).map((value, index) => (
          <li key={value === "gap" ? `gap-${index}` : value}>
            {value === "gap" ? (
              <span className={styles.gap}>…</span>
            ) : (
              <Link
                className={styles.link}
                href={hrefFor(value)}
                aria-label={`${value}쪽`}
                aria-current={value === page ? "page" : undefined}
              >
                {value}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
