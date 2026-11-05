import Link from "next/link";
import styles from "./pagination.module.scss";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** 쪽 번호로 주소를 만든다. */
  hrefFor: (page: number) => string;
}

export function Pagination({ page, pageSize, total, hrefFor }: PaginationProps) {
  const last = Math.ceil(total / pageSize);
  if (last <= 1) return null;

  return (
    <nav aria-label="쪽 이동">
      <ul className={styles.list}>
        {Array.from({ length: last }, (_, index) => index + 1).map((value) => (
          <li key={value}>
            <Link
              className={styles.link}
              href={hrefFor(value)}
              aria-label={`${value}쪽`}
              aria-current={value === page ? "page" : undefined}
            >
              {value}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
