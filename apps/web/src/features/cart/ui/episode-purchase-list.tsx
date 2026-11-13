"use client";

import { EPISODE_TYPE_LABEL, type Role, type WorkAccess, type WorkDetail } from "@raon/contracts";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CART_QUERY_KEY } from "@/entities/cart";
import { formatCoins, formatDate, formatNumber, useLockedMutation } from "@/shared/lib";
import { Badge, Button, ButtonLink, Notice } from "@/shared/ui";
import { addToCart } from "../api/actions";
import styles from "./purchase-panel.module.scss";

interface Props {
  work: WorkDetail;
  access: WorkAccess | null;
  /** 로그인하지 않았으면 null */
  role: Role | null;
}

type Add = Parameters<typeof addToCart>[0];

export function EpisodePurchaseList({ work, access, role }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  const add = useLockedMutation({
    mutationFn: async (input: Add) => {
      const result = await addToCart(input);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      setSelected(new Set());
      setNotice({ tone: "info", text: "장바구니에 담았습니다." });
      // 누른 버튼이 사라질 수 있으므로 초점을 회차 목록 영역으로 옮긴다.
      wrapRef.current?.focus({ preventScroll: true });
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      router.refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: error.message }),
  });

  // 로그인했다면 이미 산 회차 금액을 뺀 가격을 보여 준다.
  const wholePrice = access?.wholePriceForUser ?? work.wholePrice;
  const ownsWork = access?.ownsWork ?? false;
  const owned = new Set(access?.ownedEpisodeIds);
  const inCart = new Set(access?.cartEpisodeIds);
  const workInCart = access?.workInCart ?? false;
  const canBuy = role === "READER" && !ownsWork;
  const isSelectable = (id: string, isFree: boolean) =>
    canBuy && !isFree && !owned.has(id) && !inCart.has(id) && !workInCart;
  const selectable = work.episodes.filter((episode) => isSelectable(episode.id, episode.isFree));
  const allSelected = selectable.length > 0 && selectable.every((episode) => selected.has(episode.id));

  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div ref={wrapRef} className={styles.wrap} tabIndex={-1}>
      {wholePrice !== null && !ownsWork && (role === "READER" || role === null) && (
        <div className={styles.whole}>
          <p>
            작품 전체 {formatCoins(wholePrice)}
            <small>
              {wholePrice === 0
                ? "이미 산 회차 금액이 작품 가격을 넘어 추가 비용 없이 전체를 받을 수 있습니다."
                : wholePrice !== work.wholePrice
                  ? "이미 산 회차 금액을 뺀 가격입니다."
                  : `회차별로 사면 ${formatCoins(work.episodes.filter((e) => !e.isFree).length * work.episodePrice)}입니다.`}
            </small>
          </p>
          {role === null ? (
            <ButtonLink variant="secondary" href={`/login?next=${encodeURIComponent(`/works/${work.id}`)}`}>
              로그인하고 구매하기
            </ButtonLink>
          ) : workInCart ? (
            <ButtonLink variant="secondary" href="/cart">
              장바구니에 담겨 있음
            </ButtonLink>
          ) : (
            <Button
              variant="secondary"
              disabled={add.isPending}
              onClick={() => add.run({ kind: "WORK", workId: work.id })}
            >
              작품 전체 담기
            </Button>
          )}
        </div>
      )}

      <ol className={styles.list}>
        {work.episodes.map((episode) => {
          const isOwned = ownsWork || owned.has(episode.id);
          const label = episode.isFree
            ? "무료"
            : isOwned
              ? "구매함"
              : inCart.has(episode.id) || workInCart
                ? "담김"
                : formatCoins(work.episodePrice);
          return (
            <li key={episode.id} className={styles.row}>
              {isSelectable(episode.id, episode.isFree) ? (
                <label className={styles.check}>
                  <input type="checkbox" checked={selected.has(episode.id)} onChange={() => toggle(episode.id)} />
                  <span className="visually-hidden">
                    {episode.number}화 {episode.title} 선택
                  </span>
                </label>
              ) : (
                <span className={canBuy ? styles.check : styles.spacer} />
              )}
              <Link href={`/works/${work.id}/episodes/${episode.number}`} className={styles.link}>
                <strong>
                  {episode.number}화. {episode.title}
                </strong>
                <span className={styles.meta}>
                  {episode.episodeType !== "REGULAR" && `${EPISODE_TYPE_LABEL[episode.episodeType]} · `}
                  {formatDate(episode.publishedAt)}
                  {work.format === "NOVEL" && ` · ${formatNumber(episode.charCount)}자`}
                </span>
              </Link>
              <span className={styles.price}>
                <Badge solid={episode.isFree || isOwned}>{label}</Badge>
              </span>
            </li>
          );
        })}
      </ol>

      {notice && (
        <Notice tone={notice.tone}>
          {notice.text}
          {notice.tone === "info" && (
            <>
              {" "}
              <Link href="/cart">장바구니로 가기</Link>
            </>
          )}
        </Notice>
      )}

      {canBuy && selectable.length > 0 && (
        <div className={styles.toolbar}>
          <p className={styles.summary}>
            {selected.size}화 선택 · {formatCoins(selected.size * work.episodePrice)}
          </p>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => setSelected(allSelected ? new Set() : new Set(selectable.map((episode) => episode.id)))}
            >
              {allSelected ? "선택 해제" : "유료 회차 모두 선택"}
            </Button>
            <Button
              disabled={selected.size === 0 || add.isPending}
              onClick={() => add.run({ kind: "EPISODES", workId: work.id, episodeIds: [...selected] })}
            >
              {add.isPending ? "담는 중…" : "장바구니 담기"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
