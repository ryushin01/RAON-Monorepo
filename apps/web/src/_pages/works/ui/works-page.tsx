import { GENRE_LABEL, GENRES, genreSchema, type WorkQuery, workSortSchema } from "@raon/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WorkCard } from "@/entities/work";
import { getWorks } from "@/entities/work/index.server";
import { formatNumber } from "@/shared/lib";
import { Main, Pagination } from "@/shared/ui";
import styles from "./works.module.scss";

export const worksMetadata: Metadata = { title: "전체 작품" };

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function parse(params: SearchParams) {
  const status = one(params.status);
  const page = Number(one(params.page));
  return {
    genre: genreSchema.safeParse(one(params.genre)).data,
    status: status === "ONGOING" || status === "COMPLETED" ? status : undefined,
    sort: workSortSchema.safeParse(one(params.sort)).data ?? "popular",
    q: one(params.q)?.trim().slice(0, 50) || undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  } satisfies WorkQuery;
}

type Filters = ReturnType<typeof parse>;

function hrefOf(filters: Filters, change: Partial<Filters>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: undefined, ...change })) {
    if (value !== undefined && !(key === "sort" && value === "popular")) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/works?${query}` : "/works";
}

function FilterRow({
  label,
  options,
}: {
  label: string;
  options: { key: string; label: string; href: string; current: boolean }[];
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: 입력 요소가 아닌 링크 묶음이라 fieldset이 맞지 않는다.
    <div className={styles.filterRow} role="group" aria-label={label}>
      <span aria-hidden="true">{label}</span>
      {options.map((option) => (
        <Link key={option.key} href={option.href} aria-current={option.current ? "true" : undefined}>
          {option.label}
        </Link>
      ))}
    </div>
  );
}

async function WorksContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parse(await searchParams);
  const result = await getWorks({ ...filters, pageSize: 12 });

  return (
    <>
      <h1 className={styles.title}>{filters.q ? `‘${filters.q}’ 검색 결과` : "전체 작품"}</h1>
      <div className={styles.filters}>
        <FilterRow
          label="장르"
          options={[
            { key: "all", label: "전체", href: hrefOf(filters, { genre: undefined }), current: !filters.genre },
            ...GENRES.map((genre) => ({
              key: genre,
              label: GENRE_LABEL[genre],
              href: hrefOf(filters, { genre }),
              current: filters.genre === genre,
            })),
          ]}
        />
        <FilterRow
          label="상태"
          options={[
            { key: "all", label: "전체", href: hrefOf(filters, { status: undefined }), current: !filters.status },
            {
              key: "ONGOING",
              label: "연재 중",
              href: hrefOf(filters, { status: "ONGOING" }),
              current: filters.status === "ONGOING",
            },
            {
              key: "COMPLETED",
              label: "완결",
              href: hrefOf(filters, { status: "COMPLETED" }),
              current: filters.status === "COMPLETED",
            },
          ]}
        />
        <FilterRow
          label="정렬"
          options={[
            {
              key: "popular",
              label: "인기순",
              href: hrefOf(filters, { sort: "popular" }),
              current: filters.sort === "popular",
            },
            {
              key: "latest",
              label: "최신순",
              href: hrefOf(filters, { sort: "latest" }),
              current: filters.sort === "latest",
            },
          ]}
        />
      </div>
      <p className={styles.count} role="status">
        작품 {formatNumber(result.total)}개
      </p>
      {result.items.length === 0 ? (
        <p className={styles.empty}>조건에 맞는 작품이 없습니다. 검색어나 필터를 바꿔 보세요.</p>
      ) : (
        <ul className={styles.grid}>
          {result.items.map((work) => (
            <li key={work.id}>
              <WorkCard work={work} headingLevel={2} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefFor={(page) => hrefOf(filters, { page })}
      />
    </>
  );
}

export function WorksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Main className={`page ${styles.main}`}>
      <Suspense fallback={<div className={styles.skeleton} aria-busy="true" />}>
        <WorksContent searchParams={searchParams} />
      </Suspense>
    </Main>
  );
}
