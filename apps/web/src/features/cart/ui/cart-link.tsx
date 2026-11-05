"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CART_QUERY_KEY } from "@/entities/cart";

export function CartLink({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/cart");
      if (!response.ok) throw new Error("장바구니를 불러오지 못했습니다.");
      return (await response.json()) as { count: number };
    },
  });
  const count = data?.count ?? 0;
  return (
    <Link href="/cart" className={className} aria-label={count > 0 ? `장바구니 ${count}개` : "장바구니"}>
      장바구니{count > 0 && ` ${count}`}
    </Link>
  );
}
