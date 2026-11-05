import "server-only";

import type { ApiErrorBody } from "@raon/contracts";
import type { ActionResult } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
}

/** NestJS API를 부른다. 브라우저는 API를 직접 부르지 않고 항상 Next 서버를 거친다. */
export async function apiFetch<T>(path: string, { method = "GET", body, token }: ApiOptions = {}): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined || isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as Partial<ApiErrorBody> | null;
    throw new ApiError(response.status, error?.message ?? "요청을 처리하지 못했습니다.", error?.fieldErrors);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

/** 이미지처럼 JSON이 아닌 응답을 그대로 받는다. */
export function apiRaw(path: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, { cache: "no-store" });
}

/** 서버 액션에서 API 호출을 감싸 화면에 보여 줄 수 있는 결과로 바꾼다. */
export async function toActionResult<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
    }
    console.error(error);
    return { ok: false, message: "서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}
