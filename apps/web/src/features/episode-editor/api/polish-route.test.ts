/** @jest-environment node */
import { getCurrentUser } from "@/entities/session/index.server";
import { polishRouteHandler, resetPolishLimit } from "./polish-route";

jest.mock("server-only", () => ({}));
jest.mock("@/entities/session/index.server", () => ({ getCurrentUser: jest.fn() }));
const streamText = jest.fn();
jest.mock("ai", () => ({ streamText: (...args: unknown[]) => streamText(...args) }));
jest.mock("@ai-sdk/anthropic", () => ({ createAnthropic: () => (model: string) => ({ model }) }));

const request = (body: unknown) =>
  new Request("http://localhost/api/ai/polish", { method: "POST", body: JSON.stringify(body) });
const author = { id: "u1", role: "AUTHOR" };

beforeEach(() => {
  jest.resetAllMocks();
  resetPolishLimit();
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.RAON_AI_MODEL;
  (getCurrentUser as jest.Mock).mockResolvedValue(author);
  streamText.mockReturnValue({ toTextStreamResponse: () => new Response("다듬은 글") });
});

afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

it("키가 없으면 꺼진 것으로 안내하고 모델을 부르지 않는다", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const response = await polishRouteHandler(request({ prompt: "글", style: "natural" }));
  expect(response.status).toBe(503);
  expect(await response.text()).toContain("AI 키");
  expect(streamText).not.toHaveBeenCalled();
});

it("작가만 쓰고, 입력을 검사한다", async () => {
  (getCurrentUser as jest.Mock).mockResolvedValueOnce(null);
  expect((await polishRouteHandler(request({ prompt: "글", style: "natural" }))).status).toBe(401);
  (getCurrentUser as jest.Mock).mockResolvedValueOnce({ id: "r1", role: "READER" });
  expect((await polishRouteHandler(request({ prompt: "글", style: "natural" }))).status).toBe(403);
  expect((await polishRouteHandler(request({ prompt: " ", style: "natural" }))).status).toBe(400);
  expect(streamText).not.toHaveBeenCalled();
});

it("고른 문체와 단락으로 기본 모델을 부르고 글자를 흘려보낸다", async () => {
  const response = await polishRouteHandler(request({ prompt: "  등대가 빛났다.  ", style: "concise" }));
  expect(await response.text()).toBe("다듬은 글");
  const options = streamText.mock.calls[0]?.[0];
  expect(options.model).toEqual({ model: "claude-haiku-5-5" });
  expect(options.prompt).toContain("문체: 간결하게");
  expect(options.prompt).toContain("등대가 빛났다.");
  expect(options.abortSignal).toBeInstanceOf(AbortSignal);
});

it("환경 변수로 모델을 바꾸고, 1분에 10번을 넘으면 막는다", async () => {
  process.env.RAON_AI_MODEL = "claude-sonnet-5-5";
  for (let index = 0; index < 10; index += 1) {
    expect((await polishRouteHandler(request({ prompt: "글", style: "natural" }))).status).toBe(200);
  }
  expect(streamText.mock.calls[0]?.[0].model).toEqual({ model: "claude-sonnet-5-5" });
  const limited = await polishRouteHandler(request({ prompt: "글", style: "natural" }));
  expect(limited.status).toBe(429);
});
