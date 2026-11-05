import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getLibrary, getWallet } from "@/entities/cart/index.server";
import { requireUser } from "@/entities/session/index.server";
import { ChargeCoins } from "@/features/wallet";
import { formatCoins, formatDate } from "@/shared/lib";
import { Notice } from "@/shared/ui";
import styles from "./my.module.scss";

export const myMetadata: Metadata = { title: "내 서재" };

type SearchParams = Promise<{ purchased?: string }>;

const REASON_LABEL = { CHARGE: "충전", PURCHASE: "구매" } as const;

async function MyContent({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await requireUser("READER", "/my");
  const [wallet, library, { purchased }] = await Promise.all([getWallet(token), getLibrary(token), searchParams]);

  return (
    <>
      {purchased && <Notice>결제를 마쳤습니다. 구매한 회차를 바로 읽을 수 있습니다.</Notice>}

      <section aria-labelledby="library-heading">
        <h2 id="library-heading" className={styles.h2}>
          구매한 작품
        </h2>
        {library.length === 0 ? (
          <p>
            아직 구매한 작품이 없습니다. <Link href="/works">작품 둘러보기</Link>
          </p>
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <caption className="visually-hidden">구매한 작품과 회차 목록</caption>
              <thead>
                <tr>
                  <th scope="col">작품</th>
                  <th scope="col">범위</th>
                  <th scope="col">코인</th>
                  <th scope="col">구매일</th>
                </tr>
              </thead>
              <tbody>
                {library.map((item) => (
                  <tr key={item.orderItemId}>
                    <td>
                      <Link href={`/works/${item.workId}`}>{item.workTitle}</Link>
                    </td>
                    <td>
                      {item.kind === "WORK" ? (
                        "작품 전체"
                      ) : (
                        <Link href={`/works/${item.workId}/episodes/${item.episodeNumber}`}>
                          {item.episodeNumber}화. {item.episodeTitle}
                        </Link>
                      )}
                    </td>
                    <td>{item.price.toLocaleString("ko-KR")}</td>
                    <td>{formatDate(item.purchasedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="charge">
        <h2 id="charge" className={styles.h2}>
          코인
        </h2>
        <p className={styles.balance}>보유 {formatCoins(wallet.coinBalance)}</p>
        <ChargeCoins />
      </section>

      {wallet.entries.length > 0 && (
        <section aria-labelledby="ledger-heading">
          <h2 id="ledger-heading" className={styles.h2}>
            코인 내역
          </h2>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <caption className="visually-hidden">최근 코인 충전과 사용 내역</caption>
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">내용</th>
                  <th scope="col">코인</th>
                </tr>
              </thead>
              <tbody>
                {wallet.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>{REASON_LABEL[entry.reason]}</td>
                    <td>
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount.toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export function MyPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main id="main" className={`page ${styles.main}`}>
      <h1 className={styles.title}>내 서재</h1>
      <Suspense fallback={<p aria-busy="true">내 서재를 불러오는 중입니다.</p>}>
        <MyContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
