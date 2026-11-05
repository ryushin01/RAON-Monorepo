"use client";

import { type ChargeInput, COIN_PACKAGES } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { formatCoins } from "@/shared/lib";
import { Button, Notice } from "@/shared/ui";
import { chargeCoins } from "../api/actions";
import styles from "./charge-coins.module.scss";

export function ChargeCoins() {
  const router = useRouter();
  const charge = useMutation({
    mutationFn: async (input: ChargeInput) => {
      const result = await chargeCoins(input);
      if (!result.ok) throw new Error(result.message);
      return input.amount;
    },
    onSuccess: () => router.refresh(),
  });

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>실제 결제는 일어나지 않는 가상 충전입니다.</p>
      <div className={styles.grid}>
        {COIN_PACKAGES.map((amount) => (
          <Button
            key={amount}
            variant="secondary"
            disabled={charge.isPending}
            onClick={() => charge.mutate({ amount, idempotencyKey: crypto.randomUUID() })}
          >
            {formatCoins(amount)} 충전
          </Button>
        ))}
      </div>
      {charge.error && <Notice tone="error">{charge.error.message}</Notice>}
      {charge.isSuccess && <Notice>{formatCoins(charge.data)}을 충전했습니다.</Notice>}
    </div>
  );
}
