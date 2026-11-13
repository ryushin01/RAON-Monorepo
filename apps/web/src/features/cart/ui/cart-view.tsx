"use client";

import type { Cart } from "@raon/contracts";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CART_QUERY_KEY } from "@/entities/cart";
import { formatCoins, useLockedMutation } from "@/shared/lib";
import { Button, ButtonLink, Notice } from "@/shared/ui";
import { checkout, removeFromCart } from "../api/actions";
import styles from "./cart-view.module.scss";

export function CartView({ cart }: { cart: Cart }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // 더블클릭과 재시도에도 한 번만 결제되게 하는 키. 결제가 끝나면 다음 주문을 위해 새로 만든다.
  const [orderKey, setOrderKey] = useState(() => crypto.randomUUID());

  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    router.refresh();
  };

  const remove = useLockedMutation({
    mutationFn: async (itemId: string) => {
      const result = await removeFromCart(itemId);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      // 누른 버튼이 사라지므로 초점을 장바구니 영역으로 옮긴다.
      rootRef.current?.focus({ preventScroll: true });
      refresh();
    },
  });

  const pay = useLockedMutation(
    {
      mutationFn: async (idempotencyKey: string) => {
        const result = await checkout(idempotencyKey);
        if (!result.ok) throw new Error(result.message);
      },
      onSuccess: () => {
        setOrderKey(crypto.randomUUID());
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        router.push("/my?purchased=1");
      },
    },
    { keepLockedOnSuccess: true },
  );

  if (cart.items.length === 0) {
    return (
      <div ref={rootRef} className={styles.empty} tabIndex={-1}>
        <p>장바구니가 비어 있습니다.</p>
        <ButtonLink href="/works">작품 둘러보기</ButtonLink>
      </div>
    );
  }

  const shortage = cart.total - cart.coinBalance;
  const blocked = cart.items.some((item) => item.unavailableReason);

  return (
    <div ref={rootRef} className={styles.layout} tabIndex={-1}>
      <ul className={styles.list} aria-label="장바구니 항목">
        {cart.items.map((item) => {
          const name = item.kind === "WORK" ? "작품 전체" : `${item.episodeNumber}화. ${item.episodeTitle}`;
          return (
            <li key={item.id} className={styles.item}>
              <div className={styles.name}>
                <Link href={`/works/${item.workId}`}>{item.workTitle}</Link>
                <small>{name}</small>
                {item.unavailableReason && <em>{item.unavailableReason} 빼고 결제해 주세요.</em>}
              </div>
              <span className={styles.price}>{formatCoins(item.price)}</span>
              <Button
                variant="secondary"
                small
                disabled={remove.isPending}
                onClick={() => remove.run(item.id)}
                aria-label={`빼기: ${item.workTitle} ${name}`}
              >
                빼기
              </Button>
            </li>
          );
        })}
      </ul>

      <section className={styles.summary} aria-label="결제 정보">
        <h2 className="visually-hidden">결제 정보</h2>
        <dl>
          <div>
            <dt>보유 코인</dt>
            <dd>{formatCoins(cart.coinBalance)}</dd>
          </div>
          <div className={styles.total}>
            <dt>결제 코인</dt>
            <dd>{formatCoins(cart.total)}</dd>
          </div>
        </dl>
        {shortage > 0 && (
          <p>
            코인이 {formatCoins(shortage)} 부족합니다. <Link href="/my#charge">코인 충전하기</Link>
          </p>
        )}
        {(pay.error ?? remove.error) && <Notice tone="error">{(pay.error ?? remove.error)?.message}</Notice>}
        <Button block disabled={pay.isPending || shortage > 0 || blocked} onClick={() => pay.run(orderKey)}>
          {pay.isPending ? "결제 중…" : `${formatCoins(cart.total)} 결제하기`}
        </Button>
      </section>
    </div>
  );
}
