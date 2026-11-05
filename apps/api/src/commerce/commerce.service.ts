import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AddCartItemInput,
  Cart,
  CartItem,
  ChargeInput,
  CoinEntry,
  LibraryItem,
  OrderResult,
  Wallet,
} from "@raon/contracts";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { isUniqueViolation } from "../common/db-errors.js";
import type { Database, Transaction } from "../db/database.js";
import { DB } from "../db/database.module.js";
import { cartItems, coinLedger, episodes, orderItems, orders, users, works } from "../db/schema.js";

@Injectable()
export class CommerceService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getCart(userId: string): Promise<Cart> {
    return this.readCart(this.db, userId);
  }

  async addToCart(userId: string, input: AddCartItemInput): Promise<Cart> {
    const [work] = await this.db.select().from(works).where(eq(works.id, input.workId));
    if (!work || work.status === "DRAFT") throw new NotFoundException("작품을 찾을 수 없습니다.");

    const owned = await this.db
      .select({ episodeId: orderItems.episodeId })
      .from(orderItems)
      .where(and(eq(orderItems.userId, userId), eq(orderItems.workId, input.workId)));
    if (owned.some((o) => o.episodeId === null)) throw new ConflictException("이미 구매한 작품입니다.");

    if (input.kind === "WORK") {
      if (work.status !== "COMPLETED" || work.wholePrice === null) {
        throw new BadRequestException("이 작품은 전체 구매를 지원하지 않습니다.");
      }
      await this.db.transaction(async (tx) => {
        // 작품 전체에는 모든 회차가 포함되므로 같은 작품의 회차 항목은 뺀다.
        await tx.delete(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.workId, input.workId)));
        await tx.insert(cartItems).values({ userId, workId: input.workId, episodeId: null });
      });
      return this.getCart(userId);
    }

    const [workInCart] = await this.db
      .select({ id: cartItems.id })
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.workId, input.workId), isNull(cartItems.episodeId)));
    if (workInCart) throw new ConflictException("작품 전체가 이미 장바구니에 있습니다.");

    const ownedIds = new Set(owned.map((o) => o.episodeId));
    const buyable = await this.db
      .select({ id: episodes.id, isFree: episodes.isFree })
      .from(episodes)
      .where(
        and(
          eq(episodes.workId, input.workId),
          eq(episodes.status, "PUBLISHED"),
          lte(episodes.publishedAt, sql`now()`),
          inArray(episodes.id, input.episodeIds),
        ),
      );
    const targets = buyable.filter((e) => !e.isFree && !ownedIds.has(e.id));
    if (targets.length === 0) throw new BadRequestException("담을 수 있는 유료 회차가 없습니다.");

    await this.db
      .insert(cartItems)
      .values(targets.map((e) => ({ userId, workId: input.workId, episodeId: e.id })))
      .onConflictDoNothing();
    return this.getCart(userId);
  }

  async removeFromCart(userId: string, itemId: string): Promise<Cart> {
    await this.db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.userId, userId)));
    return this.getCart(userId);
  }

  /**
   * 장바구니 전체를 코인으로 결제한다. 금액은 항상 서버의 현재 가격으로 다시 계산한다.
   * 사용자 행을 잠가 동시 결제에서 잔액이 이중으로 빠지지 않게 하고,
   * 같은 멱등 키로 다시 오면 (더블클릭, 재시도) 처음 주문을 돌려준다.
   */
  async checkout(userId: string, idempotencyKey: string): Promise<OrderResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
        if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다.");

        const [previous] = await tx.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey));
        if (previous) {
          if (previous.userId !== userId) throw new ConflictException("잘못된 주문 요청입니다.");
          return { orderId: previous.id, total: previous.total, coinBalance: user.coinBalance };
        }

        const cart = await this.readCart(tx, userId);
        if (cart.items.length === 0) throw new BadRequestException("장바구니가 비어 있습니다.");
        const unavailable = cart.items.find((item) => item.unavailableReason);
        if (unavailable) throw new ConflictException(`결제할 수 없는 항목이 있습니다: ${unavailable.workTitle}`);
        if (user.coinBalance < cart.total) {
          throw new ConflictException(
            `코인이 ${(cart.total - user.coinBalance).toLocaleString("ko-KR")}개 부족합니다.`,
          );
        }

        const [order] = await tx.insert(orders).values({ userId, idempotencyKey, total: cart.total }).returning();
        await tx.insert(orderItems).values(
          cart.items.map((item) => ({
            orderId: order!.id,
            userId,
            workId: item.workId,
            episodeId: item.episodeId,
            price: item.price,
          })),
        );
        const coinBalance = user.coinBalance - cart.total;
        await tx.update(users).set({ coinBalance, updatedAt: new Date() }).where(eq(users.id, userId));
        await tx.insert(coinLedger).values({ userId, amount: -cart.total, reason: "PURCHASE" });
        await tx.delete(cartItems).where(eq(cartItems.userId, userId));
        return { orderId: order!.id, total: cart.total, coinBalance };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("이미 처리한 주문입니다. 내 서재를 확인해 주세요.");
      throw error;
    }
  }

  /** 실제 결제 없이 코인을 넣는 가상 결제다. PG를 붙일 때 이 메서드를 결제 승인 뒤에 호출한다. */
  async charge(userId: string, input: ChargeInput): Promise<Wallet> {
    await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(coinLedger)
        .values({ userId, amount: input.amount, reason: "CHARGE", idempotencyKey: input.idempotencyKey })
        .onConflictDoNothing({ target: coinLedger.idempotencyKey })
        .returning({ id: coinLedger.id });
      if (inserted.length === 0) return;
      await tx
        .update(users)
        .set({ coinBalance: sql`${users.coinBalance} + ${input.amount}`, updatedAt: new Date() })
        .where(eq(users.id, userId));
    });
    return this.getWallet(userId);
  }

  async getWallet(userId: string): Promise<Wallet> {
    const [[user], rows] = await Promise.all([
      this.db.select({ coinBalance: users.coinBalance }).from(users).where(eq(users.id, userId)),
      this.db
        .select()
        .from(coinLedger)
        .where(eq(coinLedger.userId, userId))
        .orderBy(desc(coinLedger.createdAt))
        .limit(30),
    ]);
    return {
      coinBalance: user?.coinBalance ?? 0,
      entries: rows.map(
        (row): CoinEntry => ({
          id: row.id,
          amount: row.amount,
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
        }),
      ),
    };
  }

  async getLibrary(userId: string): Promise<LibraryItem[]> {
    const rows = await this.db
      .select({
        orderItemId: orderItems.id,
        workId: orderItems.workId,
        workTitle: works.title,
        episodeId: orderItems.episodeId,
        episodeNumber: episodes.number,
        episodeTitle: episodes.title,
        price: orderItems.price,
        createdAt: orderItems.createdAt,
      })
      .from(orderItems)
      .innerJoin(works, eq(orderItems.workId, works.id))
      .leftJoin(episodes, eq(orderItems.episodeId, episodes.id))
      .where(eq(orderItems.userId, userId))
      .orderBy(desc(orderItems.createdAt), episodes.number);
    return rows.map((row) => ({
      orderItemId: row.orderItemId,
      kind: row.episodeId ? "EPISODE" : "WORK",
      workId: row.workId,
      workTitle: row.workTitle,
      episodeNumber: row.episodeNumber,
      episodeTitle: row.episodeTitle,
      price: row.price,
      purchasedAt: row.createdAt.toISOString(),
    }));
  }

  private async readCart(db: Database | Transaction, userId: string): Promise<Cart> {
    const rows = await db
      .select({
        id: cartItems.id,
        workId: cartItems.workId,
        episodeId: cartItems.episodeId,
        workTitle: works.title,
        workStatus: works.status,
        episodePrice: works.episodePrice,
        wholePrice: works.wholePrice,
        episodeNumber: episodes.number,
        episodeTitle: episodes.title,
        episodeIsFree: episodes.isFree,
        episodeStatus: episodes.status,
        episodePublishedAt: episodes.publishedAt,
      })
      .from(cartItems)
      .innerJoin(works, eq(cartItems.workId, works.id))
      .leftJoin(episodes, eq(cartItems.episodeId, episodes.id))
      .where(eq(cartItems.userId, userId))
      .orderBy(works.title, episodes.number);

    const workIds = [...new Set(rows.map((r) => r.workId))];
    const owned = workIds.length
      ? await db
          .select({ workId: orderItems.workId, episodeId: orderItems.episodeId, price: orderItems.price })
          .from(orderItems)
          .where(and(eq(orderItems.userId, userId), or(...workIds.map((id) => eq(orderItems.workId, id)))))
      : [];
    const ownedWorks = new Set(owned.filter((o) => o.episodeId === null).map((o) => o.workId));
    const ownedEpisodes = new Set(owned.map((o) => o.episodeId));

    const items = rows.map((row): CartItem => {
      const isWork = row.episodeId === null;
      let unavailableReason: string | null = null;
      if (ownedWorks.has(row.workId)) unavailableReason = "이미 구매한 작품입니다.";
      else if (row.episodeId && ownedEpisodes.has(row.episodeId)) unavailableReason = "이미 구매한 회차입니다.";
      else if (isWork && (row.workStatus !== "COMPLETED" || row.wholePrice === null))
        unavailableReason = "전체 구매 판매가 끝났습니다.";
      else if (
        !isWork &&
        (row.episodeStatus !== "PUBLISHED" || !row.episodePublishedAt || row.episodePublishedAt > new Date())
      )
        unavailableReason = "비공개로 바뀐 회차입니다.";
      else if (!isWork && row.episodeIsFree) unavailableReason = "무료로 바뀐 회차입니다.";

      return {
        id: row.id,
        kind: isWork ? "WORK" : "EPISODE",
        workId: row.workId,
        workTitle: row.workTitle,
        episodeId: row.episodeId,
        episodeNumber: row.episodeNumber,
        episodeTitle: row.episodeTitle,
        // 작품 전체 가격에서 이 작품에 이미 쓴 코인을 뺀다.
        price: isWork
          ? Math.max(
              0,
              (row.wholePrice ?? 0) - owned.filter((o) => o.workId === row.workId).reduce((sum, o) => sum + o.price, 0),
            )
          : row.episodePrice,
        unavailableReason,
      };
    });

    const [user] = await db.select({ coinBalance: users.coinBalance }).from(users).where(eq(users.id, userId));
    return {
      items,
      total: items.filter((item) => !item.unavailableReason).reduce((sum, item) => sum + item.price, 0),
      coinBalance: user?.coinBalance ?? 0,
    };
  }
}
