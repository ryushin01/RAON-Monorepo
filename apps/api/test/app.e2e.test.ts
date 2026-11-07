import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import {
  type AuthResult,
  type Cart,
  countChars,
  docFromText,
  type EpisodeView,
  type StudioWorkDetail,
  type WorkDetail,
} from "@raon/contracts";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/configure-app.js";
import { type Database, type DatabaseHandle, openDatabase } from "../src/db/database.js";
import { DATABASE_HANDLE } from "../src/db/database.module.js";
import {
  comments as commentsTable,
  episodes as episodesTable,
  episodeVersions as episodeVersionsTable,
  favorites as favoritesTable,
  orderItems as orderItemsTable,
  orders as ordersTable,
  users,
  users as usersTable,
  workNotes as workNotesTable,
  works as worksTable,
} from "../src/db/schema.js";
import { seedDemoData } from "../src/db/seed.js";
import { DEMO_COMMENTS, DEMO_FAVORITES, DEMO_PURCHASES, DEMO_USERS } from "../src/db/seed-data.js";
import { StudioService } from "../src/studio/studio.service.js";

const doc = docFromText("본문 첫 문단입니다.\n\n둘째 문단입니다.");
const PAID_MARKER = "둘째 문단입니다.";

describe("RAON API", () => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let db: Database;
  let seq = 0;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function signup(role: "READER" | "AUTHOR", coins = 0): Promise<AuthResult> {
    seq += 1;
    const res = await http()
      .post("/auth/signup")
      .send({ email: `user${seq}@raon.test`, password: "password1", nickname: `사용자${seq}`, role })
      .expect(201);
    const body = res.body as AuthResult;
    if (coins) await db.update(users).set({ coinBalance: coins }).where(eq(users.id, body.user.id));
    return body;
  }

  /** 무료 1화, 유료 2·3화가 공개된 작품을 만든다. */
  async function publishWork(token: string, { complete = false } = {}) {
    const work = (
      await http()
        .post("/studio/works")
        .set(bearer(token))
        .send({
          title: "테스트 작품",
          synopsis: "열 글자가 넘는 작품 소개입니다.",
          genre: "SF",
          episodePrice: 100,
          wholePrice: 250,
          tags: [],
        })
        .expect(201)
    ).body as StudioWorkDetail;
    for (const [index, isFree] of [true, false, false].entries()) {
      const episode = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(bearer(token))
        .send({ title: `${index + 1}화`, content: doc, authorNote: "작가의 말", isFree })
        .expect(201);
      await http().post(`/studio/episodes/${episode.body.id}/publish`).set(bearer(token)).expect(200);
    }
    if (complete) {
      await http().post(`/studio/works/${work.id}/status`).set(bearer(token)).send({ status: "COMPLETED" }).expect(200);
    }
    return (await http().get(`/works/${work.id}`).expect(200)).body as WorkDetail;
  }

  beforeAll(async () => {
    handle = await openDatabase({});
    db = handle.db;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_HANDLE)
      .useValue(handle)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("인증", () => {
    it("회원 유형이 다르면 로그인을 막는다", async () => {
      const { user } = await signup("AUTHOR");
      const payload = { email: user.email, password: "password1" };
      await http()
        .post("/auth/login")
        .send({ ...payload, role: "AUTHOR" })
        .expect(200);
      const res = await http()
        .post("/auth/login")
        .send({ ...payload, role: "READER" })
        .expect(401);
      expect(res.body.message).toContain("작가 계정");
    });

    it("틀린 비밀번호와 없는 계정의 안내가 같다", async () => {
      const { user } = await signup("READER");
      const wrong = await http()
        .post("/auth/login")
        .send({ email: user.email, password: "wrong", role: "READER" })
        .expect(401);
      const none = await http()
        .post("/auth/login")
        .send({ email: "none@raon.test", password: "wrong", role: "READER" })
        .expect(401);
      expect(wrong.body.message).toBe(none.body.message);
    });

    it("로그인을 너무 많이 시도하면 막는다", async () => {
      const payload = { email: "bruteforce@raon.test", password: "wrong", role: "READER" };
      for (let i = 0; i < 10; i += 1) await http().post("/auth/login").send(payload).expect(401);
      await http().post("/auth/login").send(payload).expect(429);
    });

    it("중복 이메일은 필드 오류로 알려 준다", async () => {
      const { user } = await signup("READER");
      const res = await http()
        .post("/auth/signup")
        .send({ email: user.email, password: "password1", nickname: "새닉네임", role: "READER" })
        .expect(409);
      expect(res.body.fieldErrors.email).toBeDefined();
    });
  });

  describe("권한", () => {
    it("일반 회원은 스튜디오를, 작가는 장바구니를 쓸 수 없다", async () => {
      const reader = await signup("READER");
      const author = await signup("AUTHOR");
      await http().get("/studio/works").set(bearer(reader.accessToken)).expect(403);
      await http().get("/cart").set(bearer(author.accessToken)).expect(403);
      await http().get("/cart").expect(401);
    });

    it("다른 작가의 작품과 회차는 없는 것처럼 다룬다", async () => {
      const owner = await signup("AUTHOR");
      const other = await signup("AUTHOR");
      const work = await publishWork(owner.accessToken);
      await http().get(`/studio/works/${work.id}`).set(bearer(other.accessToken)).expect(404);
      await http()
        .put(`/studio/episodes/${work.episodes[0]!.id}`)
        .set(bearer(other.accessToken))
        .send({ title: "탈취", content: doc, authorNote: null, isFree: true })
        .expect(404);
    });
  });

  describe("뷰어 접근", () => {
    it("무료 회차는 누구나 읽고, 유료 회차 본문은 내려가지 않는다", async () => {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);

      const free = (await http().get(`/works/${work.id}/episodes/1`).expect(200)).body as EpisodeView;
      expect(free.accessible).toBe(true);
      expect(free.next?.number).toBe(2);

      const res = await http().get(`/works/${work.id}/episodes/2`).expect(200);
      expect(res.body.accessible).toBe(false);
      expect(res.body.content).toBeNull();
      expect(res.body.authorNote).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain(PAID_MARKER);
    });

    it("작가는 자기 유료 회차를 읽을 수 있다", async () => {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);
      const res = await http().get(`/works/${work.id}/episodes/2`).set(bearer(author.accessToken)).expect(200);
      expect(res.body.accessible).toBe(true);
    });

    it("공개하지 않은 회차와 작품은 찾을 수 없다", async () => {
      const author = await signup("AUTHOR");
      const work = (
        await http().post("/studio/works").set(bearer(author.accessToken)).send({
          title: "비공개",
          synopsis: "열 글자가 넘는 작품 소개입니다.",
          genre: "SF",
          episodePrice: 100,
          wholePrice: null,
          tags: [],
        })
      ).body as StudioWorkDetail;
      await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(bearer(author.accessToken))
        .send({ title: "초안", content: doc, authorNote: null, isFree: true })
        .expect(201);
      await http().get(`/works/${work.id}`).expect(404);
      await http().get(`/works/${work.id}/episodes/1`).expect(404);
    });
  });

  describe("구매", () => {
    it("회차를 담아 결제하면 코인이 빠지고 본문을 읽을 수 있다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const work = await publishWork(author.accessToken);
      const paid = work.episodes[1]!;

      const cart = (
        await http()
          .post("/cart/items")
          .set(bearer(reader.accessToken))
          .send({ kind: "EPISODES", workId: work.id, episodeIds: [paid.id] })
          .expect(201)
      ).body as Cart;
      expect(cart.total).toBe(100);

      const order = await http()
        .post("/orders")
        .set(bearer(reader.accessToken))
        .send({ idempotencyKey: randomUUID() })
        .expect(200);
      expect(order.body.coinBalance).toBe(400);

      const res = await http().get(`/works/${work.id}/episodes/2`).set(bearer(reader.accessToken)).expect(200);
      expect(res.body.accessible).toBe(true);
      expect(JSON.stringify(res.body)).toContain(PAID_MARKER);
      const locked = await http().get(`/works/${work.id}/episodes/3`).set(bearer(reader.accessToken)).expect(200);
      expect(locked.body.accessible).toBe(false);

      expect(((await http().get("/cart").set(bearer(reader.accessToken))).body as Cart).items).toHaveLength(0);
    });

    it("같은 멱등 키로 다시 결제해도 코인은 한 번만 빠진다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const work = await publishWork(author.accessToken);
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "EPISODES", workId: work.id, episodeIds: [work.episodes[1]!.id] });

      const key = randomUUID();
      const [a, b] = await Promise.all(
        [1, 2].map(() => http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: key })),
      );
      expect(a!.body.orderId).toBe(b!.body.orderId);
      const wallet = await http().get("/wallet").set(bearer(reader.accessToken));
      expect(wallet.body.coinBalance).toBe(400);
    });

    it("코인이 모자라면 결제되지 않고 장바구니가 남는다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 50);
      const work = await publishWork(author.accessToken);
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "EPISODES", workId: work.id, episodeIds: [work.episodes[1]!.id] });

      const res = await http()
        .post("/orders")
        .set(bearer(reader.accessToken))
        .send({ idempotencyKey: randomUUID() })
        .expect(409);
      expect(res.body.message).toContain("50개 부족");
      expect(((await http().get("/cart").set(bearer(reader.accessToken))).body as Cart).items).toHaveLength(1);
    });

    it("무료 회차만 담으려 하면 거절하고, 이미 산 회차는 다시 담지 않는다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const work = await publishWork(author.accessToken);
      const add = (episodeIds: string[]) =>
        http()
          .post("/cart/items")
          .set(bearer(reader.accessToken))
          .send({ kind: "EPISODES", workId: work.id, episodeIds });

      await add([work.episodes[0]!.id]).expect(400);
      await add([work.episodes[1]!.id]).expect(201);
      await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() }).expect(200);
      await add([work.episodes[1]!.id]).expect(400);
    });

    it("작품 전체 구매는 완결 작품만 되고, 담으면 같은 작품의 회차 항목을 대신한다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const ongoing = await publishWork(author.accessToken);
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "WORK", workId: ongoing.id })
        .expect(400);

      const done = await publishWork(author.accessToken, { complete: true });
      expect(done.wholePrice).toBe(250);
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "EPISODES", workId: done.id, episodeIds: [done.episodes[1]!.id] })
        .expect(201);
      const cart = (
        await http()
          .post("/cart/items")
          .set(bearer(reader.accessToken))
          .send({ kind: "WORK", workId: done.id })
          .expect(201)
      ).body as Cart;
      expect(cart.items).toHaveLength(1);
      expect(cart.total).toBe(250);

      await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() }).expect(200);
      for (const number of [2, 3]) {
        const res = await http().get(`/works/${done.id}/episodes/${number}`).set(bearer(reader.accessToken));
        expect(res.body.accessible).toBe(true);
      }
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "WORK", workId: done.id })
        .expect(409);
    });

    it("다른 사람의 장바구니 항목은 지우지 못한다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER");
      const other = await signup("READER");
      const work = await publishWork(author.accessToken);
      const cart = (
        await http()
          .post("/cart/items")
          .set(bearer(reader.accessToken))
          .send({ kind: "EPISODES", workId: work.id, episodeIds: [work.episodes[1]!.id] })
      ).body as Cart;
      await http().delete(`/cart/items/${cart.items[0]!.id}`).set(bearer(other.accessToken)).expect(200);
      expect(((await http().get("/cart").set(bearer(reader.accessToken))).body as Cart).items).toHaveLength(1);
    });

    it("코인 충전은 정해진 묶음만 되고 같은 키는 한 번만 반영한다", async () => {
      const reader = await signup("READER");
      const key = randomUUID();
      await http()
        .post("/wallet/charge")
        .set(bearer(reader.accessToken))
        .send({ amount: 777, idempotencyKey: key })
        .expect(400);
      for (let i = 0; i < 2; i += 1) {
        const res = await http()
          .post("/wallet/charge")
          .set(bearer(reader.accessToken))
          .send({ amount: 1000, idempotencyKey: key })
          .expect(200);
        expect(res.body.coinBalance).toBe(1000);
      }
    });
  });

  describe("작가 스튜디오", () => {
    it("초안을 저장하고 공개하면 작품이 연재 중이 된다", async () => {
      const author = await signup("AUTHOR");
      const work = (
        await http().post("/studio/works").set(bearer(author.accessToken)).send({
          title: "새 작품",
          synopsis: "열 글자가 넘는 작품 소개입니다.",
          genre: "FANTASY",
          episodePrice: 100,
          wholePrice: null,
          tags: [],
        })
      ).body as StudioWorkDetail;
      expect(work.status).toBe("DRAFT");

      const empty = { type: "doc", content: [{ type: "paragraph" }] };
      const episode = (
        await http()
          .post(`/studio/works/${work.id}/episodes`)
          .set(bearer(author.accessToken))
          .send({ title: "1화", content: empty, authorNote: null, isFree: true })
          .expect(201)
      ).body;
      await http().post(`/studio/episodes/${episode.id}/publish`).set(bearer(author.accessToken)).expect(400);

      const saved = await http()
        .put(`/studio/episodes/${episode.id}`)
        .set(bearer(author.accessToken))
        .send({ title: "1화", content: doc, authorNote: null, isFree: true })
        .expect(200);
      expect(saved.body.charCount).toBeGreaterThan(0);
      await http().post(`/studio/episodes/${episode.id}/publish`).set(bearer(author.accessToken)).expect(200);
      expect((await http().get(`/works/${work.id}`).expect(200)).body.status).toBe("ONGOING");
    });

    it("허용하지 않은 본문 형식은 저장하지 않는다", async () => {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);
      await http()
        .put(`/studio/episodes/${work.episodes[0]!.id}`)
        .set(bearer(author.accessToken))
        .send({
          title: "악성",
          isFree: true,
          authorNote: null,
          content: { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] },
        })
        .expect(400);
    });

    it("판매한 회차는 비공개로 돌릴 수 없다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const work = await publishWork(author.accessToken);
      const paid = work.episodes[1]!;
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "EPISODES", workId: work.id, episodeIds: [paid.id] });
      await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() });
      await http().post(`/studio/episodes/${paid.id}/unpublish`).set(bearer(author.accessToken)).expect(409);
      await http()
        .post(`/studio/episodes/${work.episodes[2]!.id}/unpublish`)
        .set(bearer(author.accessToken))
        .expect(200);
    });
  });

  describe("회귀", () => {
    it("같은 이메일로 동시에 가입해도 500이 나지 않는다", async () => {
      seq += 1;
      const body = { email: `race${seq}@raon.test`, password: "password1", role: "READER" };
      const results = await Promise.all(
        [1, 2].map((n) =>
          http()
            .post("/auth/signup")
            .send({ ...body, nickname: `경합${seq}-${n}` }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    });

    it("조회수는 기록 요청으로만 늘고, 작가 본인과 읽을 수 없는 회차는 세지 않는다", async () => {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);
      const viewCount = async () => (await http().get(`/works/${work.id}`)).body.viewCount;

      await http().get(`/works/${work.id}/episodes/1`).expect(200);
      expect(await viewCount()).toBe(0);

      await http().post(`/works/${work.id}/episodes/1/view`).set(bearer(author.accessToken)).expect(204);
      await http().post(`/works/${work.id}/episodes/2/view`).expect(204);
      expect(await viewCount()).toBe(0);

      await http().post(`/works/${work.id}/episodes/1/view`).expect(204);
      expect(await viewCount()).toBe(1);
      await http().post(`/works/${work.id}/episodes/99/view`).expect(404);
    });

    it("전체 구매자가 있으면 공개했던 회차를 내리거나 지울 수 없다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const token = bearer(author.accessToken);
      const work = await publishWork(author.accessToken, { complete: true });
      const target = work.episodes[2]!;
      await http().post("/cart/items").set(bearer(reader.accessToken)).send({ kind: "WORK", workId: work.id });
      await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() }).expect(200);

      await http().post(`/studio/episodes/${target.id}/unpublish`).set(token).expect(409);
      expect((await http().get(`/works/${work.id}/episodes/3`).set(bearer(reader.accessToken))).body.accessible).toBe(
        true,
      );

      // 공개한 적 없는 새 초안은 지울 수 있다.
      const draft = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(token)
        .send({ title: "새 초안", content: doc, authorNote: null, isFree: false });
      await http().delete(`/studio/episodes/${draft.body.id}`).set(token).expect(204);
    });

    it("읽던 회차를 내리면 이어 보기에서 빠진다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER");
      const work = await publishWork(author.accessToken);
      await http().get(`/works/${work.id}/episodes/1`).set(bearer(reader.accessToken)).expect(200);
      expect((await http().get("/reading").set(bearer(reader.accessToken))).body).toHaveLength(1);
      await http()
        .post(`/studio/episodes/${work.episodes[0]!.id}/unpublish`)
        .set(bearer(author.accessToken))
        .expect(200);
      expect((await http().get("/reading").set(bearer(reader.accessToken))).body).toHaveLength(0);
    });

    it("1화를 내려도 첫 공개 회차 번호를 알려 준다", async () => {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);
      expect(work.firstEpisodeNumber).toBe(1);
      await http()
        .post(`/studio/episodes/${work.episodes[0]!.id}/unpublish`)
        .set(bearer(author.accessToken))
        .expect(200);
      expect((await http().get(`/works/${work.id}`)).body.firstEpisodeNumber).toBe(2);
    });
  });

  describe("작품 전체 구매 차감", () => {
    it("이미 산 회차 금액을 빼고 계산한다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const work = await publishWork(author.accessToken, { complete: true });
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "EPISODES", workId: work.id, episodeIds: [work.episodes[1]!.id] });
      await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() }).expect(200);

      const access = await http().get(`/works/${work.id}/access`).set(bearer(reader.accessToken));
      expect(access.body.wholePriceForUser).toBe(150);
      const cart = await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "WORK", workId: work.id });
      expect(cart.body.total).toBe(150);
      const order = await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() });
      expect(order.body.coinBalance).toBe(250);
    });
  });

  describe("선호작과 이어 보기", () => {
    it("선호작을 추가하고 빼며, 읽은 회차를 기억한다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER");
      const work = await publishWork(author.accessToken);
      const token = bearer(reader.accessToken);

      await http().put(`/works/${work.id}/favorite`).expect(401);
      await http().put(`/works/${work.id}/favorite`).set(token).expect(204);
      await http().put(`/works/${work.id}/favorite`).set(token).expect(204);
      await http().get(`/works/${work.id}/episodes/1`).set(token).expect(200);

      const favorites = await http().get("/favorites").set(token).expect(200);
      expect(favorites.body).toHaveLength(1);
      expect(favorites.body[0].lastReadNumber).toBe(1);
      expect((await http().get(`/works/${work.id}/access`).set(token)).body).toMatchObject({
        isFavorite: true,
        lastReadNumber: 1,
      });
      expect((await http().get("/studio/works").set(bearer(author.accessToken))).body[0].favoriteCount).toBe(1);

      expect((await http().get("/reading").set(token)).body[0].lastReadNumber).toBe(1);

      await http().delete(`/works/${work.id}/favorite`).set(token).expect(204);
      expect((await http().get("/favorites").set(token)).body).toHaveLength(0);
    });

    it("잠긴 회차를 열어 본 것은 읽은 기록으로 남기지 않는다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER");
      const work = await publishWork(author.accessToken);
      await http().get(`/works/${work.id}/episodes/2`).set(bearer(reader.accessToken)).expect(200);
      expect(
        (await http().get(`/works/${work.id}/access`).set(bearer(reader.accessToken))).body.lastReadNumber,
      ).toBeNull();
    });
  });

  describe("댓글", () => {
    it("읽을 수 있는 사람만 보고 쓰며, 쓴 사람과 작가만 지운다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER");
      const other = await signup("READER");
      const work = await publishWork(author.accessToken);
      const [free, paid] = work.episodes;
      const token = bearer(reader.accessToken);

      await http().post(`/episodes/${free!.id}/comments`).send({ body: "비회원" }).expect(401);
      await http().post(`/episodes/${free!.id}/comments`).set(token).send({ body: "   " }).expect(400);
      await http().post(`/episodes/${free!.id}/comments`).set(token).send({ body: "재미있어요" }).expect(204);

      await http().get(`/episodes/${paid!.id}/comments`).expect(403);
      await http().post(`/episodes/${paid!.id}/comments`).set(token).send({ body: "안 산 회차" }).expect(403);

      const guestView = await http().get(`/episodes/${free!.id}/comments`).expect(200);
      expect(guestView.body.items[0]).toMatchObject({ body: "재미있어요", canDelete: false });
      const mine = await http().get(`/episodes/${free!.id}/comments`).set(token);
      expect(mine.body.items[0].canDelete).toBe(true);

      const id = mine.body.items[0].id;
      await http().delete(`/comments/${id}`).set(bearer(other.accessToken)).expect(403);
      await http().delete(`/comments/${id}`).set(bearer(author.accessToken)).expect(204);
      expect((await http().get(`/episodes/${free!.id}/comments`)).body).toEqual({ items: [], total: 0 });
    });
  });

  describe("삭제와 판매 통계", () => {
    it("초안만 지울 수 있고 판매한 작품은 지울 수 없으며, 판매 수를 보여 준다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const work = await publishWork(author.accessToken);
      const token = bearer(author.accessToken);

      await http().delete(`/studio/episodes/${work.episodes[1]!.id}`).set(token).expect(409);
      await http().post(`/studio/episodes/${work.episodes[2]!.id}/unpublish`).set(token).expect(200);
      const stranger = await signup("AUTHOR");
      await http().delete(`/studio/episodes/${work.episodes[2]!.id}`).set(bearer(stranger.accessToken)).expect(404);
      await http().delete(`/studio/episodes/${work.episodes[2]!.id}`).set(token).expect(204);

      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "EPISODES", workId: work.id, episodeIds: [work.episodes[1]!.id] });
      await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() }).expect(200);

      const studio = await http().get(`/studio/works/${work.id}`).set(token);
      expect(studio.body).toMatchObject({ salesCount: 1, salesCoins: 100 });
      await http().delete(`/studio/works/${work.id}`).set(token).expect(409);

      const unsold = await publishWork(author.accessToken);
      await http().delete(`/studio/works/${unsold.id}`).set(token).expect(204);
      await http().get(`/works/${unsold.id}`).expect(404);
    });
  });

  describe("별점", () => {
    it("일반 회원이 1~5점을 주고 고칠 수 있으며 평균을 보여 준다", async () => {
      const author = await signup("AUTHOR");
      const a = await signup("READER");
      const b = await signup("READER");
      const work = await publishWork(author.accessToken);

      await http().put(`/works/${work.id}/rating`).send({ score: 5 }).expect(401);
      await http().put(`/works/${work.id}/rating`).set(bearer(author.accessToken)).send({ score: 5 }).expect(403);
      await http().put(`/works/${work.id}/rating`).set(bearer(a.accessToken)).send({ score: 6 }).expect(400);

      await http().put(`/works/${work.id}/rating`).set(bearer(a.accessToken)).send({ score: 5 }).expect(204);
      await http().put(`/works/${work.id}/rating`).set(bearer(a.accessToken)).send({ score: 4 }).expect(204);
      await http().put(`/works/${work.id}/rating`).set(bearer(b.accessToken)).send({ score: 1 }).expect(204);
      expect((await http().get(`/works/${work.id}`)).body).toMatchObject({ ratingAverage: 2.5, ratingCount: 2 });
      expect((await http().get(`/works/${work.id}/access`).set(bearer(a.accessToken))).body.myRating).toBe(4);

      await http().delete(`/works/${work.id}/rating`).set(bearer(a.accessToken)).expect(204);
      expect((await http().get(`/works/${work.id}`)).body).toMatchObject({ ratingAverage: 1, ratingCount: 1 });
    });
  });

  describe("태그", () => {
    it("중복을 없애 저장하고 태그로 찾으며, 너무 많으면 거절한다", async () => {
      const author = await signup("AUTHOR");
      const token = bearer(author.accessToken);
      const base = {
        title: "태그 작품",
        synopsis: "열 글자가 넘는 작품 소개입니다.",
        genre: "SF",
        episodePrice: 100,
        wholePrice: null,
      };
      const tag = `태그${seq}`;
      const work = (
        await http()
          .post("/studio/works")
          .set(token)
          .send({ ...base, tags: [tag, tag, "우주"] })
          .expect(201)
      ).body as StudioWorkDetail;
      expect(work.tags).toEqual([tag, "우주"]);
      await http()
        .post("/studio/works")
        .set(token)
        .send({ ...base, tags: ["1", "2", "3", "4", "5", "6"] })
        .expect(400);

      const episode = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(token)
        .send({ title: "1화", content: doc, authorNote: null, isFree: true });
      await http().post(`/studio/episodes/${episode.body.id}/publish`).set(token).expect(200);

      const found = await http().get("/works").query({ tag }).expect(200);
      expect(found.body.items.map((item: { id: string }) => item.id)).toEqual([work.id]);
      expect((await http().get("/works").query({ tag: "없는태그" })).body.total).toBe(0);
    });
  });

  describe("예약 공개", () => {
    const inHours = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();

    it("시각이 되기 전에는 독자에게 보이지 않고, 살 수도 없다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const token = bearer(author.accessToken);
      const work = await publishWork(author.accessToken);
      const created = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(token)
        .send({ title: "예약 회차", content: doc, authorNote: null, isFree: false });
      const id = created.body.id;
      const publish = (body: object) => http().post(`/studio/episodes/${id}/publish`).set(token).send(body);

      await publish({ publishAt: inHours(-1) }).expect(400);
      expect((await publish({ publishAt: inHours(24) }).expect(200)).body.status).toBe("PUBLISHED");

      const detail = (await http().get(`/works/${work.id}`)).body as WorkDetail;
      expect(detail.episodes.map((e) => e.id)).not.toContain(id);
      expect(detail.episodeCount).toBe(3);
      await http().get(`/works/${work.id}/episodes/4`).expect(404);
      await http().get(`/works/${work.id}/episodes/4`).set(token).expect(404);
      expect((await http().get(`/works/${work.id}/episodes/3`)).body.next).toBeNull();
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "EPISODES", workId: work.id, episodeIds: [id] })
        .expect(400);

      // 바로 공개로 바꾸면 곧 보인다.
      await publish({}).expect(200);
      await http().get(`/works/${work.id}/episodes/4`).expect(200);
      // 이미 공개한 회차는 다시 예약할 수 없다.
      await publish({ publishAt: inHours(1) }).expect(409);
    });

    it("예약을 취소하면 초안으로 돌아가고 예약 시각이 지워진다", async () => {
      const author = await signup("AUTHOR");
      const token = bearer(author.accessToken);
      const work = await publishWork(author.accessToken);
      const { body } = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(token)
        .send({ title: "취소", content: doc, authorNote: null, isFree: true });
      await http()
        .post(`/studio/episodes/${body.id}/publish`)
        .set(token)
        .send({ publishAt: inHours(5) })
        .expect(200);
      const canceled = await http().post(`/studio/episodes/${body.id}/unpublish`).set(token).expect(200);
      expect(canceled.body).toMatchObject({ status: "DRAFT", publishedAt: null });
    });

    it("보이는 회차가 없는 작품은 목록에 나오지 않는다", async () => {
      const author = await signup("AUTHOR");
      const token = bearer(author.accessToken);
      const title = `예약만 ${seq}`;
      const work = (
        await http().post("/studio/works").set(token).send({
          title,
          synopsis: "열 글자가 넘는 작품 소개입니다.",
          genre: "SF",
          episodePrice: 100,
          wholePrice: null,
          tags: [],
        })
      ).body as StudioWorkDetail;
      const { body } = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(token)
        .send({ title: "1화", content: doc, authorNote: null, isFree: true });
      await http()
        .post(`/studio/episodes/${body.id}/publish`)
        .set(token)
        .send({ publishAt: inHours(5) })
        .expect(200);
      expect((await http().get("/works").query({ q: title })).body.total).toBe(0);
    });
  });

  describe("회차 순서", () => {
    it("번호를 맞바꾸고, 구매와 소유권은 그대로이며, 끝에서는 더 못 옮긴다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const stranger = await signup("AUTHOR");
      const token = bearer(author.accessToken);
      const work = await publishWork(author.accessToken);
      const [first, second] = work.episodes;
      await http()
        .post("/cart/items")
        .set(bearer(reader.accessToken))
        .send({ kind: "EPISODES", workId: work.id, episodeIds: [second!.id] });
      await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() }).expect(200);
      const move = (id: string, direction: string, as = token) =>
        http().post(`/studio/episodes/${id}/move`).set(as).send({ direction });

      await move(first!.id, "up").expect(400);
      await move(second!.id, "up").expect(204);
      await move(first!.id, "up", bearer(stranger.accessToken)).expect(404);

      const after = (await http().get(`/works/${work.id}`)).body as WorkDetail;
      expect(after.episodes.map((e) => e.id).slice(0, 2)).toEqual([second!.id, first!.id]);
      // 산 회차는 번호가 1로 바뀌어도 읽을 수 있다.
      const moved = await http().get(`/works/${work.id}/episodes/1`).set(bearer(reader.accessToken));
      expect(moved.body).toMatchObject({ id: second!.id, accessible: true });
    });
  });

  describe("표지", () => {
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

    it("이미지만 받고, 내용으로 형식을 판별하며, 소유자만 바꾼다", async () => {
      const author = await signup("AUTHOR");
      const stranger = await signup("AUTHOR");
      const token = bearer(author.accessToken);
      const work = await publishWork(author.accessToken);
      const upload = (buffer: Buffer, filename: string, as = token) =>
        http().put(`/studio/works/${work.id}/cover`).set(as).attach("file", buffer, filename);

      expect(work.coverUpdatedAt).toBeNull();
      await upload(Buffer.from("<svg onload=alert(1)>"), "cover.png").expect(400);
      await upload(PNG, "cover.png", bearer(stranger.accessToken)).expect(404);
      await upload(Buffer.alloc(2 * 1024 * 1024 + 1, 0xff), "big.jpg").expect(413);

      const saved = await upload(PNG, "cover.bin").expect(200);
      expect(saved.body.coverUpdatedAt).not.toBeNull();

      const image = await http().get(`/works/${work.id}/cover`).expect(200);
      expect(image.headers["content-type"]).toContain("image/png");
      expect(Buffer.compare(image.body, PNG)).toBe(0);

      expect((await http().get(`/works/${work.id}`)).body.coverUpdatedAt).not.toBeNull();
      await http().delete(`/studio/works/${work.id}/cover`).set(token).expect(200);
      await http().get(`/works/${work.id}/cover`).expect(404);
    });
  });

  describe("뱃지", () => {
    it("새 작품은 신작과 새 회차, 조회수가 많으면 인기를 붙인다", async () => {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);
      expect(work.badges).toEqual(["NEW", "UP"]);
      await db.update(worksTable).set({ viewCount: 30000 }).where(eq(worksTable.id, work.id));
      expect((await http().get(`/works/${work.id}`)).body.badges).toEqual(["HOT", "NEW", "UP"]);
    });
  });

  describe("예약과 판매", () => {
    const inHours = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();

    async function scheduledOnlyWork(token: { Authorization: string }) {
      const work = (
        await http().post("/studio/works").set(token).send({
          title: "예약만 있는 작품",
          synopsis: "열 글자가 넘는 작품 소개입니다.",
          genre: "SF",
          episodePrice: 100,
          wholePrice: 250,
          tags: [],
        })
      ).body as StudioWorkDetail;
      const { body } = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(token)
        .send({ title: "1화", content: doc, authorNote: null, isFree: false });
      await http()
        .post(`/studio/episodes/${body.id}/publish`)
        .set(token)
        .send({ publishAt: inHours(5) })
        .expect(200);
      return work.id;
    }

    it("예약만 걸린 작품은 완결로 바꿀 수 없고, 독자에게 없는 작품이며, 팔 수 없다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const token = bearer(author.accessToken);
      const workId = await scheduledOnlyWork(token);

      await http().post(`/studio/works/${workId}/status`).set(token).send({ status: "COMPLETED" }).expect(400);
      await http().get(`/works/${workId}`).expect(404);
      await http().put(`/works/${workId}/favorite`).set(bearer(reader.accessToken)).expect(404);
      await http().put(`/works/${workId}/rating`).set(bearer(reader.accessToken)).send({ score: 5 }).expect(404);

      // 이미 완결이어도(공개 뒤 내린 경우 등) 보이는 회차가 없으면 팔지 않는다.
      await db.update(worksTable).set({ status: "COMPLETED" }).where(eq(worksTable.id, workId));
      await http().post("/cart/items").set(bearer(reader.accessToken)).send({ kind: "WORK", workId }).expect(400);
    });

    it("전체 구매자가 있어도 아직 공개하지 않은 예약 회차는 취소할 수 있다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER", 500);
      const token = bearer(author.accessToken);
      const work = await publishWork(author.accessToken, { complete: true });
      await http().post("/cart/items").set(bearer(reader.accessToken)).send({ kind: "WORK", workId: work.id });
      await http().post("/orders").set(bearer(reader.accessToken)).send({ idempotencyKey: randomUUID() }).expect(200);

      const { body } = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(token)
        .send({ title: "예약", content: doc, authorNote: null, isFree: false });
      await http()
        .post(`/studio/episodes/${body.id}/publish`)
        .set(token)
        .send({ publishAt: inHours(5) })
        .expect(200);
      await http().post(`/studio/episodes/${body.id}/unpublish`).set(token).expect(200);
      await http().delete(`/studio/episodes/${body.id}`).set(token).expect(204);
    });
  });

  describe("선호작과 공개 상태", () => {
    it("보이는 회차가 없어지면 선호작에서 빠지고, 다시 공개하면 돌아온다", async () => {
      const author = await signup("AUTHOR");
      const reader = await signup("READER");
      const token = bearer(author.accessToken);
      const work = (
        await http().post("/studio/works").set(token).send({
          title: "내렸다 올리는 작품",
          synopsis: "열 글자가 넘는 작품 소개입니다.",
          genre: "SF",
          episodePrice: 100,
          wholePrice: null,
          tags: [],
        })
      ).body as StudioWorkDetail;
      const { body } = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(token)
        .send({ title: "1화", content: doc, authorNote: null, isFree: true });
      await http().post(`/studio/episodes/${body.id}/publish`).set(token).expect(200);
      await http().put(`/works/${work.id}/favorite`).set(bearer(reader.accessToken)).expect(204);
      const favorites = async () => (await http().get("/favorites").set(bearer(reader.accessToken))).body;
      expect(await favorites()).toHaveLength(1);

      await http().post(`/studio/episodes/${body.id}/unpublish`).set(token).expect(200);
      expect(await favorites()).toHaveLength(0);

      await http().post(`/studio/episodes/${body.id}/publish`).set(token).expect(200);
      expect(await favorites()).toHaveLength(1);
    });
  });

  describe("회차 버전", () => {
    const save = (token: string, id: string, text: string) =>
      http()
        .put(`/studio/episodes/${id}`)
        .set(bearer(token))
        .send({ title: "제목", content: docFromText(text), authorNote: null, isFree: false })
        .expect(200);

    async function draft(token: string) {
      const work = (
        await http()
          .post("/studio/works")
          .set(bearer(token))
          .send({
            title: "버전 작품",
            synopsis: "열 글자가 넘는 작품 소개입니다.",
            genre: "SF",
            episodePrice: 100,
            wholePrice: null,
            tags: [],
          })
          .expect(201)
      ).body as StudioWorkDetail;
      const episode = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(bearer(token))
        .send({
          title: "제목",
          content: { type: "doc", content: [{ type: "paragraph" }] },
          authorNote: null,
          isFree: false,
        })
        .expect(201);
      return episode.body.id as string;
    }

    const versions = async (token: string, id: string) =>
      (await http().get(`/studio/episodes/${id}/versions`).set(bearer(token)).expect(200)).body as {
        id: string;
        kind: string;
        label: string | null;
        charCount: number;
      }[];

    it("빈 원고나 바뀌지 않은 저장은 남기지 않고, 자동 버전은 간격마다 하나만 남긴다", async () => {
      const { accessToken: token } = await signup("AUTHOR");
      const id = await draft(token);
      await save(token, id, "첫 원고입니다.");
      expect(await versions(token, id)).toHaveLength(0);

      await save(token, id, "첫 원고입니다.");
      expect(await versions(token, id)).toHaveLength(0);

      await save(token, id, "고친 원고입니다.");
      const [first] = await versions(token, id);
      expect(first).toMatchObject({ kind: "AUTO", charCount: countChars(docFromText("첫 원고입니다.")) });

      await save(token, id, "다시 고친 원고입니다.");
      expect(await versions(token, id)).toHaveLength(1);

      await db
        .update(episodeVersionsTable)
        .set({ createdAt: new Date(Date.now() - 11 * 60 * 1000) })
        .where(eq(episodeVersionsTable.episodeId, id));
      await save(token, id, "또 고친 원고입니다.");
      expect(await versions(token, id)).toHaveLength(2);
    });

    it("동시에 저장해도 먼저 저장한 원고를 버전으로 남긴다", async () => {
      const { accessToken: token } = await signup("AUTHOR");
      const id = await draft(token);
      await Promise.all([save(token, id, "먼저 도착한 원고"), save(token, id, "나중에 도착한 원고")]);
      const list = await versions(token, id);
      expect(list).toHaveLength(1);
      const detail = await http().get(`/studio/episodes/${id}/versions/${list[0]?.id}`).set(bearer(token)).expect(200);
      const episode = await http().get(`/studio/episodes/${id}`).set(bearer(token)).expect(200);
      // 어느 쪽이 먼저든 지금 본문과 버전이 서로 다른 원고여야 잃어버린 글이 없다.
      expect(detail.body.content).not.toEqual(episode.body.content);
    });

    it("복원을 거듭해도 자동 버전은 제한을 넘지 않고, 복원 전 내용은 남는다", async () => {
      const { accessToken: token } = await signup("AUTHOR");
      const id = await draft(token);
      await save(token, id, "지금 원고입니다.");
      const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db.insert(episodeVersionsTable).values(
        Array.from({ length: 30 }, () => ({
          episodeId: id,
          kind: "AUTO" as const,
          title: "옛 제목",
          content: docFromText("옛 원고"),
          charCount: 2,
          createdAt: old,
        })),
      );
      const [target] = await versions(token, id);
      await http().post(`/studio/episodes/${id}/versions/${target?.id}/restore`).set(bearer(token)).expect(200);
      const list = await versions(token, id);
      expect(list.filter((version) => version.kind === "AUTO")).toHaveLength(30);
      expect(list[0]?.label).toBe("복원 전");
    });

    it("자동 버전은 개수를 제한하지만 직접 남긴 버전은 지우지 않는다", async () => {
      const { accessToken: token } = await signup("AUTHOR");
      const id = await draft(token);
      await save(token, id, "원고입니다.");
      await http().post(`/studio/episodes/${id}/versions`).set(bearer(token)).send({ label: "남길 버전" }).expect(201);
      const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db.insert(episodeVersionsTable).values(
        Array.from({ length: 30 }, () => ({
          episodeId: id,
          kind: "AUTO" as const,
          title: "옛 제목",
          content: docFromText("옛 원고"),
          charCount: 3,
          createdAt: old,
        })),
      );
      await save(token, id, "새 원고입니다.");
      const list = await versions(token, id);
      expect(list.filter((version) => version.kind === "AUTO")).toHaveLength(30);
      expect(list.some((version) => version.label === "남길 버전")).toBe(true);
    });

    it("이름을 붙여 남기고, 복원하면 지금 내용을 먼저 남기며 판매 설정은 바꾸지 않는다", async () => {
      const { accessToken: token } = await signup("AUTHOR");
      const id = await draft(token);
      await http()
        .put(`/studio/episodes/${id}`)
        .set(bearer(token))
        .send({ title: "처음 제목", content: docFromText("처음 원고"), authorNote: "처음 말", isFree: true })
        .expect(200);
      const created = await http()
        .post(`/studio/episodes/${id}/versions`)
        .set(bearer(token))
        .send({ label: "  초고  " })
        .expect(201);
      expect(created.body).toMatchObject({ kind: "MANUAL", label: "초고", title: "처음 제목" });
      expect(created.body).not.toHaveProperty("content");

      await http()
        .put(`/studio/episodes/${id}`)
        .set(bearer(token))
        .send({ title: "나중 제목", content: docFromText("나중 원고"), authorNote: null, isFree: false })
        .expect(200);

      const detail = await http()
        .get(`/studio/episodes/${id}/versions/${created.body.id}`)
        .set(bearer(token))
        .expect(200);
      expect(detail.body.content).toEqual(docFromText("처음 원고"));

      const restored = await http()
        .post(`/studio/episodes/${id}/versions/${created.body.id}/restore`)
        .set(bearer(token))
        .expect(200);
      expect(restored.body).toMatchObject({
        title: "처음 제목",
        authorNote: "처음 말",
        isFree: false,
        charCount: countChars(docFromText("처음 원고")),
      });
      expect((await versions(token, id)).map((version) => version.label)).toContain("복원 전");
    });

    it("공개한 회차는 빈 버전으로 되돌릴 수 없다", async () => {
      const { accessToken: token } = await signup("AUTHOR");
      const id = await draft(token);
      const [empty] = await db
        .insert(episodeVersionsTable)
        .values({ episodeId: id, kind: "MANUAL", title: "빈", content: { type: "doc", content: [] }, charCount: 0 })
        .returning();
      await save(token, id, "공개할 원고입니다.");
      await http().post(`/studio/episodes/${id}/publish`).set(bearer(token)).send({}).expect(200);
      await http().post(`/studio/episodes/${id}/versions/${empty?.id}/restore`).set(bearer(token)).expect(400);
    });

    it("직접 남긴 버전 수를 제한하고, 지울 수 있다", async () => {
      const { accessToken: token } = await signup("AUTHOR");
      const id = await draft(token);
      await db.insert(episodeVersionsTable).values(
        Array.from({ length: 50 }, () => ({
          episodeId: id,
          kind: "MANUAL" as const,
          title: "제목",
          content: docFromText("원고"),
          charCount: 2,
        })),
      );
      await http().post(`/studio/episodes/${id}/versions`).set(bearer(token)).send({ label: null }).expect(409);
      const [first] = await versions(token, id);
      await http().delete(`/studio/episodes/${id}/versions/${first?.id}`).set(bearer(token)).expect(204);
      await http().post(`/studio/episodes/${id}/versions`).set(bearer(token)).send({ label: null }).expect(201);
    });

    it("다른 작가의 회차와 다른 회차의 버전은 다룰 수 없고, 독자는 쓸 수 없다", async () => {
      const owner = await signup("AUTHOR");
      const other = await signup("AUTHOR");
      const reader = await signup("READER");
      const id = await draft(owner.accessToken);
      const otherId = await draft(owner.accessToken);
      const created = await http()
        .post(`/studio/episodes/${id}/versions`)
        .set(bearer(owner.accessToken))
        .send({ label: null })
        .expect(201);
      const version = created.body.id as string;

      await http().get(`/studio/episodes/${id}/versions`).set(bearer(other.accessToken)).expect(404);
      await http().get(`/studio/episodes/${id}/versions/${version}`).set(bearer(other.accessToken)).expect(404);
      await http()
        .post(`/studio/episodes/${id}/versions/${version}/restore`)
        .set(bearer(other.accessToken))
        .expect(404);
      await http().delete(`/studio/episodes/${id}/versions/${version}`).set(bearer(other.accessToken)).expect(404);
      await http().get(`/studio/episodes/${otherId}/versions/${version}`).set(bearer(owner.accessToken)).expect(404);
      await http()
        .post(`/studio/episodes/${otherId}/versions/${version}/restore`)
        .set(bearer(owner.accessToken))
        .expect(404);
      await http().get(`/studio/episodes/${id}/versions`).set(bearer(reader.accessToken)).expect(403);
      await http()
        .post(`/studio/episodes/${id}/versions`)
        .set(bearer(owner.accessToken))
        .send({ label: "가".repeat(41) })
        .expect(400);
    });
  });

  describe("회차 휴지통", () => {
    // 단언이 실패해도 다음 테스트로 대역이 넘어가지 않게 한다.
    afterEach(() => {
      jest.restoreAllMocks();
    });

    async function setup() {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);
      const auth = bearer(author.accessToken);
      const create = async (title: string) =>
        (
          await http()
            .post(`/studio/works/${work.id}/episodes`)
            .set(auth)
            .send({ title, content: doc, authorNote: null, isFree: false })
            .expect(201)
        ).body as { id: string; number: number };
      const detail = async () =>
        (await http().get(`/studio/works/${work.id}`).set(auth).expect(200)).body as StudioWorkDetail;
      return { auth, work, create, detail };
    }

    it("지운 초안은 목록과 수치, 내보내기, 검색에서 빠지고 다룰 수 없으며, 복원하면 원래 번호로 돌아온다", async () => {
      const { auth, work, create, detail } = await setup();
      const draft = await create("휴지통 초안");
      expect((await detail()).draftEpisodeCount).toBe(1);

      await http().delete(`/studio/episodes/${draft.id}`).set(auth).expect(204);
      const trashed = await detail();
      expect(trashed.episodes.map((episode) => episode.id)).not.toContain(draft.id);
      expect(trashed.trash).toEqual([expect.objectContaining({ id: draft.id, number: 4, title: "휴지통 초안" })]);
      expect(trashed.draftEpisodeCount).toBe(0);

      const exported = await http().get(`/studio/works/${work.id}/export`).set(auth).expect(200);
      expect(exported.body.episodes.map((episode: { title: string }) => episode.title)).not.toContain("휴지통 초안");
      const found = await http()
        .get(`/studio/works/${work.id}/search`)
        .query({ q: "휴지통 초안" })
        .set(auth)
        .expect(200);
      expect(found.body.episodes).toEqual([]);

      // 휴지통에 있는 동안은 원고를 고치거나 공개할 수 없다.
      await http().get(`/studio/episodes/${draft.id}`).set(auth).expect(404);
      await http()
        .put(`/studio/episodes/${draft.id}`)
        .set(auth)
        .send({ title: "수정", content: doc, authorNote: null, isFree: false })
        .expect(404);
      await http().post(`/studio/episodes/${draft.id}/publish`).set(auth).expect(404);
      await http().delete(`/studio/episodes/${draft.id}`).set(auth).expect(404);

      // 번호를 다른 회차가 가져가지 않으므로 복원해도 겹치지 않는다.
      const next = await create("다음 초안");
      expect(next.number).toBe(5);
      const restored = await http().post(`/studio/episodes/${draft.id}/restore`).set(auth).expect(200);
      expect(restored.body).toMatchObject({ number: 4, status: "DRAFT", title: "휴지통 초안" });
      const after = await detail();
      expect(after.trash).toEqual([]);
      expect(after.episodes.map((episode) => episode.number)).toEqual([1, 2, 3, 4, 5]);
      await http().post(`/studio/episodes/${draft.id}/restore`).set(auth).expect(404);
    });

    it("회차를 옮길 때 휴지통의 회차를 건너뛴다", async () => {
      const { auth, create, detail } = await setup();
      const first = await create("넷째");
      const second = await create("다섯째");
      const third = await create("여섯째");
      await http().delete(`/studio/episodes/${second.id}`).set(auth).expect(204);

      await http().post(`/studio/episodes/${third.id}/move`).set(auth).send({ direction: "up" }).expect(204);
      const moved = await detail();
      expect(moved.episodes.slice(-2).map(({ id, number }) => [id, number])).toEqual([
        [third.id, 4],
        [first.id, 6],
      ]);
      expect(moved.trash[0]?.number).toBe(5);
    });

    it("완전히 지우기는 휴지통에 있는 회차만 되고, 그사이 판매했다면 지울 수 없다", async () => {
      const { auth, work, create, detail } = await setup();
      const draft = await create("지울 초안");
      await http().delete(`/studio/episodes/${draft.id}/permanent`).set(auth).expect(404);
      await http().delete(`/studio/episodes/${draft.id}`).set(auth).expect(204);

      const stranger = await signup("AUTHOR");
      await http().delete(`/studio/episodes/${draft.id}/permanent`).set(bearer(stranger.accessToken)).expect(404);
      await http().post(`/studio/episodes/${draft.id}/restore`).set(bearer(stranger.accessToken)).expect(404);

      await http().delete(`/studio/episodes/${draft.id}/permanent`).set(auth).expect(204);
      expect((await detail()).trash).toEqual([]);

      // 공개했던 회차가 휴지통에 있는 동안 작품 전체가 팔린 경우다.
      const published = await create("공개했던 회차");
      await http().post(`/studio/episodes/${published.id}/publish`).set(auth).expect(200);
      await http().post(`/studio/episodes/${published.id}/unpublish`).set(auth).expect(200);
      await http().delete(`/studio/episodes/${published.id}`).set(auth).expect(204);
      const buyer = await signup("READER");
      const [workRow] = await db.select().from(worksTable).where(eq(worksTable.id, work.id));
      const [order] = await db
        .insert(ordersTable)
        .values({ userId: buyer.user.id, idempotencyKey: randomUUID(), total: 0 })
        .returning();
      await db.insert(orderItemsTable).values({
        orderId: order!.id,
        userId: buyer.user.id,
        workId: work.id,
        episodeId: null,
        price: workRow!.wholePrice ?? 0,
      });
      await http().delete(`/studio/episodes/${published.id}/permanent`).set(auth).expect(409);

      // 판매 확인을 지나 삭제 직전에 회차 구매가 끝나면 외래 키가 막는다.
      // 전체 구매가 있으면 앞 단계에서 막히므로 먼저 지운다.
      await db.delete(orderItemsTable).where(eq(orderItemsTable.workId, work.id));
      const raced = await create("겹친 결제");
      await http().post(`/studio/episodes/${raced.id}/publish`).set(auth).expect(200);
      await http().post(`/studio/episodes/${raced.id}/unpublish`).set(auth).expect(200);
      await http().delete(`/studio/episodes/${raced.id}`).set(auth).expect(204);
      const service = app.get(StudioService) as unknown as { assertNotSold: () => Promise<void> };
      jest.spyOn(service, "assertNotSold").mockImplementation(async () => {
        await db.insert(orderItemsTable).values({
          orderId: order!.id,
          userId: buyer.user.id,
          workId: work.id,
          episodeId: raced.id,
          price: 100,
        });
      });
      await http().delete(`/studio/episodes/${raced.id}/permanent`).set(auth).expect(409);
    });

    it("확인과 처리 사이에 상태가 바뀌어도 복원한 회차를 지우거나 없는 회차로 500을 내지 않는다", async () => {
      const { auth, create, detail } = await setup();
      const draft = await create("겹친 요청");
      await http().delete(`/studio/episodes/${draft.id}`).set(auth).expect(204);
      const service = app.get(StudioService) as unknown as { trashedEpisode: () => Promise<unknown> };
      const original = service.trashedEpisode.bind(service);

      // 완전히 지우기가 확인을 지난 뒤에 복원된 경우
      const spy = jest.spyOn(service, "trashedEpisode");
      spy.mockImplementationOnce(async (...args: []) => {
        const row = await original(...args);
        await db.update(episodesTable).set({ deletedAt: null }).where(eq(episodesTable.id, draft.id));
        return row;
      });
      await http().delete(`/studio/episodes/${draft.id}/permanent`).set(auth).expect(404);
      expect((await detail()).episodes.map((episode) => episode.id)).toContain(draft.id);

      // 복원이 확인을 지난 뒤에 다른 요청이 복원한 경우
      await http().delete(`/studio/episodes/${draft.id}`).set(auth).expect(204);
      spy.mockImplementationOnce(async (...args: []) => {
        const row = await original(...args);
        await db.update(episodesTable).set({ deletedAt: null }).where(eq(episodesTable.id, draft.id));
        return row;
      });
      await http().post(`/studio/episodes/${draft.id}/restore`).set(auth).expect(404);
    });
  });

  describe("긴 회차", () => {
    it("기본 한도(100KB)를 넘는 본문도 저장하고, 지나치게 큰 요청은 거부한다", async () => {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);
      const long = docFromText("가".repeat(100_000));
      const created = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(bearer(author.accessToken))
        .send({ title: "긴 회차", content: long, authorNote: null, isFree: false })
        .expect(201);
      expect(created.body.charCount).toBe(100_000);

      await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(bearer(author.accessToken))
        .send({ title: "너무 긴 회차", content: docFromText("가".repeat(1_500_000)), authorNote: null, isFree: false })
        .expect(413);
    });
  });

  describe("작품 내보내기", () => {
    it("초안까지 회차 순서대로 돌려주고, 작가 본인만 받는다", async () => {
      const author = await signup("AUTHOR");
      const other = await signup("AUTHOR");
      const reader = await signup("READER");
      const work = await publishWork(author.accessToken);
      await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(bearer(author.accessToken))
        .send({ title: "초안 회차", content: doc, authorNote: "말", isFree: false })
        .expect(201);

      const res = await http().get(`/studio/works/${work.id}/export`).set(bearer(author.accessToken)).expect(200);
      expect(res.body.title).toBe("테스트 작품");
      expect(res.body.episodes.map((episode: { number: number }) => episode.number)).toEqual([1, 2, 3, 4]);
      expect(res.body.episodes[3]).toMatchObject({ status: "DRAFT", authorNote: "말", content: doc });

      await http().get(`/studio/works/${work.id}/export`).set(bearer(other.accessToken)).expect(404);
      await http().get(`/studio/works/${work.id}/export`).set(bearer(reader.accessToken)).expect(403);
      await http().get(`/studio/works/${work.id}/export`).expect(401);
    });
  });

  describe("설정집과 메모", () => {
    const note = (overrides = {}) => ({
      kind: "SETTING",
      category: " 인물 ",
      title: "이안",
      aliases: ["등대지기", "등대지기", "막내"],
      body: "소금 사막의 등대를 지키는 사람.",
      episodeId: null,
      ...overrides,
    });

    async function setup() {
      const author = await signup("AUTHOR");
      const work = await publishWork(author.accessToken);
      return { token: author.accessToken, work };
    }

    it("문서를 만들고 고치고 지우며, 값을 정리해 저장한다", async () => {
      const { token, work } = await setup();
      const created = await http().post(`/studio/works/${work.id}/notes`).set(bearer(token)).send(note()).expect(201);
      expect(created.body).toMatchObject({ category: "인물", aliases: ["등대지기", "막내"], episodeId: null });

      const updated = await http()
        .put(`/studio/notes/${created.body.id}`)
        .set(bearer(token))
        .send(note({ title: "고친 이름" }))
        .expect(200);
      expect(updated.body.title).toBe("고친 이름");

      const list = await http().get(`/studio/works/${work.id}/notes`).set(bearer(token)).expect(200);
      expect(list.body.map((item: { id: string }) => item.id)).toEqual([created.body.id]);

      await http().delete(`/studio/notes/${created.body.id}`).set(bearer(token)).expect(204);
      await http().put(`/studio/notes/${created.body.id}`).set(bearer(token)).send(note()).expect(404);
    });

    it("입력을 검사한다", async () => {
      const { token, work } = await setup();
      const res = await http()
        .post(`/studio/works/${work.id}/notes`)
        .set(bearer(token))
        .send(note({ title: "  " }))
        .expect(400);
      expect(res.body.fieldErrors.title).toBeDefined();
      await http()
        .post(`/studio/works/${work.id}/notes`)
        .set(bearer(token))
        .send(note({ aliases: Array.from({ length: 11 }, (_, index) => `이름${index}`) }))
        .expect(400);
    });

    it("회차 메모는 메모 종류이고 그 작품의 회차에만 달 수 있으며, 회차를 지우면 함께 사라진다", async () => {
      const { token, work } = await setup();
      const other = await setup();
      const detail = (await http().get(`/studio/works/${work.id}`).set(bearer(token)).expect(200))
        .body as StudioWorkDetail;
      const episode = detail.episodes[0]?.id as string;
      const foreign = (await http().get(`/studio/works/${other.work.id}`).set(bearer(other.token)).expect(200))
        .body as StudioWorkDetail;

      await http()
        .post(`/studio/works/${work.id}/notes`)
        .set(bearer(token))
        .send(note({ episodeId: episode }))
        .expect(400);
      await http()
        .post(`/studio/works/${work.id}/notes`)
        .set(bearer(token))
        .send(note({ kind: "MEMO", episodeId: foreign.episodes[0]?.id }))
        .expect(400);
      await http()
        .post(`/studio/works/${work.id}/notes`)
        .set(bearer(token))
        .send(note({ kind: "MEMO", episodeId: episode }))
        .expect(201);

      const draft = await http()
        .post(`/studio/works/${work.id}/episodes`)
        .set(bearer(token))
        .send({ title: "초안", content: doc, authorNote: null, isFree: false })
        .expect(201);
      await http()
        .post(`/studio/works/${work.id}/notes`)
        .set(bearer(token))
        .send(note({ kind: "MEMO", title: "초안 메모", episodeId: draft.body.id }))
        .expect(201);
      await http().delete(`/studio/episodes/${draft.body.id}`).set(bearer(token)).expect(204);
      // 휴지통에 있는 동안은 메모도 남아 있고, 완전히 지워야 함께 사라진다.
      const kept = await http().get(`/studio/works/${work.id}/notes`).set(bearer(token)).expect(200);
      expect(kept.body).toHaveLength(2);
      await http().delete(`/studio/episodes/${draft.body.id}/permanent`).set(bearer(token)).expect(204);
      const list = await http().get(`/studio/works/${work.id}/notes`).set(bearer(token)).expect(200);
      expect(list.body.map((item: { title: string }) => item.title)).toEqual(["이안"]);
    });

    it("회차 메모는 회차마다 하나이고, 다시 만들면 고치며, 연결은 바꿀 수 없다", async () => {
      const { token, work } = await setup();
      const detail = (await http().get(`/studio/works/${work.id}`).set(bearer(token)).expect(200))
        .body as StudioWorkDetail;
      const [first, second] = detail.episodes.map((episode) => episode.id);
      const memo = (episodeId: string | undefined, body: string) =>
        note({ kind: "MEMO", title: "회차 메모", body, episodeId, aliases: [] });
      const post = (body: object) => http().post(`/studio/works/${work.id}/notes`).set(bearer(token)).send(body);

      const created = await post(memo(first, "처음")).expect(201);
      const again = await post(memo(first, "다시")).expect(201);
      expect(again.body.id).toBe(created.body.id);
      expect(again.body.body).toBe("다시");
      await Promise.all([post(memo(second, "동시 1")).expect(201), post(memo(second, "동시 2")).expect(201)]);
      const list = await http().get(`/studio/works/${work.id}/notes`).set(bearer(token)).expect(200);
      expect(list.body).toHaveLength(2);

      await http().put(`/studio/notes/${created.body.id}`).set(bearer(token)).send(memo(second, "옮기기")).expect(400);
    });

    it("다른 작가의 문서는 다룰 수 없고, 독자는 쓸 수 없다", async () => {
      const { token, work } = await setup();
      const other = await signup("AUTHOR");
      const reader = await signup("READER");
      const created = await http().post(`/studio/works/${work.id}/notes`).set(bearer(token)).send(note()).expect(201);
      const id = created.body.id as string;
      await http().get(`/studio/works/${work.id}/notes`).set(bearer(other.accessToken)).expect(404);
      await http().post(`/studio/works/${work.id}/notes`).set(bearer(other.accessToken)).send(note()).expect(404);
      await http().put(`/studio/notes/${id}`).set(bearer(other.accessToken)).send(note()).expect(404);
      await http().delete(`/studio/notes/${id}`).set(bearer(other.accessToken)).expect(404);
      await http()
        .get(`/studio/works/${work.id}/search`)
        .query({ q: "이안" })
        .set(bearer(other.accessToken))
        .expect(404);
      await http().get(`/studio/works/${work.id}/notes`).set(bearer(reader.accessToken)).expect(403);
    });

    it("문서 수를 제한한다", async () => {
      const { token, work } = await setup();
      await db.insert(workNotesTable).values(
        Array.from({ length: 500 }, (_, index) => ({
          workId: work.id,
          kind: "SETTING" as const,
          title: `문서${index}`,
        })),
      );
      await http().post(`/studio/works/${work.id}/notes`).set(bearer(token)).send(note()).expect(409);
    });

    it("가득 찬 작품에는 새 회차 메모를 만들 수 없지만 있는 메모는 고칠 수 있다", async () => {
      const { token, work } = await setup();
      const detail = (await http().get(`/studio/works/${work.id}`).set(bearer(token)).expect(200))
        .body as StudioWorkDetail;
      const [first, second] = detail.episodes.map((episode) => episode.id);
      const memo = (episodeId: string | undefined, body: string) =>
        note({ kind: "MEMO", title: "회차 메모", body, episodeId, aliases: [] });
      const post = (body: object) => http().post(`/studio/works/${work.id}/notes`).set(bearer(token)).send(body);
      await post(memo(first, "처음")).expect(201);
      await db.insert(workNotesTable).values(
        Array.from({ length: 499 }, (_, index) => ({
          workId: work.id,
          kind: "SETTING" as const,
          title: `문서${index}`,
        })),
      );
      await post(memo(second, "새 메모")).expect(409);
      const updated = await post(memo(first, "고친 메모")).expect(201);
      expect(updated.body.body).toBe("고친 메모");
    });

    it("회차와 문서를 함께 검색하고, 대소문자와 다른 이름도 찾으며, 앞뒤 글자를 보여 준다", async () => {
      const { token, work } = await setup();
      await http()
        .post(`/studio/works/${work.id}/notes`)
        .set(bearer(token))
        .send(note({ title: "Raon 기록", aliases: ["둘째 문단"], body: "" }))
        .expect(201);

      const found = await http()
        .get(`/studio/works/${work.id}/search`)
        .query({ q: "둘째 문단" })
        .set(bearer(token))
        .expect(200);
      expect(found.body.episodes).toHaveLength(3);
      expect(found.body.episodes[0]).toMatchObject({ number: 1, matches: 1 });
      expect(found.body.episodes[0].snippet).toContain("둘째 문단");
      expect(found.body.notes[0]).toMatchObject({ title: "Raon 기록", kind: "SETTING" });

      const upper = await http()
        .get(`/studio/works/${work.id}/search`)
        .query({ q: "RAON" })
        .set(bearer(token))
        .expect(200);
      expect(upper.body.notes).toHaveLength(1);

      // 특수문자는 일반 글자로 찾는다.
      const none = await http().get(`/studio/works/${work.id}/search`).query({ q: "%" }).set(bearer(token)).expect(200);
      expect(none.body).toEqual({ episodes: [], notes: [] });
      await http().get(`/studio/works/${work.id}/search`).query({ q: " " }).set(bearer(token)).expect(400);
    });
  });

  describe("가상 데이터", () => {
    it("빈 DB에 넣으면 내 서재와 작가 통계가 채워지고, 다시 실행해도 늘지 않는다", async () => {
      const fresh = await openDatabase({});
      await seedDemoData(fresh.db);
      await seedDemoData(fresh.db);

      const count = async (
        table: typeof usersTable | typeof commentsTable | typeof favoritesTable | typeof orderItemsTable,
      ) => (await fresh.db.select({ n: sql<number>`count(*)::int` }).from(table))[0]?.n;
      expect(await count(usersTable)).toBe(DEMO_USERS.length);
      expect(await count(commentsTable)).toBe(DEMO_COMMENTS.length);
      expect(await count(favoritesTable)).toBe(DEMO_FAVORITES.length);
      expect(await count(orderItemsTable)).toBe(DEMO_PURCHASES.length);

      // 잔액은 구매 뒤 값이고 0 아래로 내려가지 않는다.
      const [buyer] = await fresh.db.select().from(usersTable).where(eq(usersTable.email, "reader2@raon.test"));
      expect(buyer?.coinBalance).toBe(800);
      await fresh.close();
    });
  });

  describe("목록", () => {
    it("검색어의 특수문자를 일반 글자로 찾고, 공개 작품만 보여 준다", async () => {
      const author = await signup("AUTHOR");
      await publishWork(author.accessToken);
      const all = await http().get("/works").query({ q: "테스트" }).expect(200);
      expect(all.body.total).toBeGreaterThan(0);
      const none = await http().get("/works").query({ q: "%" }).expect(200);
      expect(none.body.total).toBe(0);
      await http().get("/works").query({ genre: "없는장르" }).expect(400);
    });
  });
});
