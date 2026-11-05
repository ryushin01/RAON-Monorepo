import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  type AuthResult,
  type Cart,
  docFromText,
  type EpisodeView,
  type StudioWorkDetail,
  type WorkDetail,
} from "@raon/contracts";
import { eq } from "drizzle-orm";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { type Database, type DatabaseHandle, openDatabase } from "../src/db/database.js";
import { DATABASE_HANDLE } from "../src/db/database.module.js";
import { users } from "../src/db/schema.js";

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
    app = moduleRef.createNestApplication();
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
