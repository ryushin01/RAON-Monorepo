import type { Metadata } from "next";
import { Suspense } from "react";
import { getCart } from "@/entities/cart/index.server";
import { requireUser } from "@/entities/session/index.server";
import { CartView } from "@/features/cart";
import { Main } from "@/shared/ui";
import styles from "./cart-page.module.scss";

export const cartMetadata: Metadata = { title: "장바구니" };

async function CartContent() {
  const { token } = await requireUser("READER", "/cart");
  return <CartView cart={await getCart(token)} />;
}

export function CartPage() {
  return (
    <Main className={`page ${styles.main}`}>
      <h1 className={styles.title}>장바구니</h1>
      <Suspense fallback={<p aria-busy="true">장바구니를 불러오는 중입니다.</p>}>
        <CartContent />
      </Suspense>
    </Main>
  );
}
