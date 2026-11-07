import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { getCurrentUser } from "@/entities/session/index.server";
import { POLISH_STYLE_LABEL, polishRequestSchema } from "../model/polish";

const DEFAULT_MODEL = "claude-haiku-5-5";
/** 2,000자 단락의 JSON은 한글 3바이트를 쳐도 이보다 작다. 길이를 밝히지 않은 요청도 읽다가 멈춘다. */
const MAX_BODY_BYTES = 16_000;

/** 본문을 다 읽기 전에 크기를 확인해 큰 요청으로 서버 메모리를 쓰지 않게 한다. 넘으면 null이다. */
async function readCapped(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
/** 작가마다 1분에 몇 번까지 부르는지 센다. 서버를 여러 대 띄우면 공유 저장소로 옮겨야 한다. */
const recent = new Map<string, number[]>();

const text = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

function overLimit(userId: string, now = Date.now()) {
  const calls = (recent.get(userId) ?? []).filter((time) => now - time < WINDOW_MS);
  if (calls.length >= MAX_PER_WINDOW) {
    recent.set(userId, calls);
    return true;
  }
  recent.set(userId, [...calls, now]);
  return false;
}

/** 테스트에서 호출 수를 비운다. */
export function resetPolishLimit() {
  recent.clear();
}

const SYSTEM = [
  "당신은 한국어 웹소설 원고를 다듬는 교정자입니다.",
  "받은 단락의 뜻, 인물, 사건, 시점, 말투를 바꾸지 말고 문장만 다듬습니다.",
  "새로운 사실이나 설명을 덧붙이지 않습니다.",
  "결과는 다듬은 단락 하나만 씁니다. 따옴표로 감싸거나 설명, 머리말, 줄바꿈을 붙이지 않습니다.",
].join("\n");

/**
 * 작가가 고른 단락을 AI로 다듬어 글자 그대로 흘려보낸다. 키는 서버에만 두고 브라우저는 이 경로만 부른다.
 * 키가 없으면 기능을 끈 것으로 안내한다.
 */
export async function polishRouteHandler(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return text(503, "AI 키가 설정되지 않아 문단 다듬기를 쓸 수 없습니다.");

  const user = await getCurrentUser();
  if (!user) return text(401, "로그인이 필요합니다.");
  if (user.role !== "AUTHOR") return text(403, "작가만 쓸 수 있습니다.");

  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) return text(413, "요청이 너무 큽니다.");
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // 아래 검증이 형식 오류로 답한다.
  }
  const parsed = polishRequestSchema.safeParse(body);
  if (!parsed.success) return text(400, parsed.error.issues[0]?.message ?? "요청을 확인해 주세요.");
  if (overLimit(user.id)) return text(429, "잠시 뒤 다시 시도해 주세요. 1분에 10번까지 쓸 수 있습니다.");

  const anthropic = createAnthropic({ apiKey });
  const result = streamText({
    model: anthropic(process.env.RAON_AI_MODEL || DEFAULT_MODEL),
    system: SYSTEM,
    prompt: `문체: ${POLISH_STYLE_LABEL[parsed.data.style]}\n\n단락:\n${parsed.data.prompt}`,
    maxOutputTokens: 2000,
    // 작가가 멈추거나 화면을 떠나면 생성도 멈춰 비용을 아낀다.
    abortSignal: request.signal,
    onError: ({ error }) => console.error(error),
  });
  return result.toTextStreamResponse({ headers: { "Cache-Control": "no-store" } });
}
