import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === "development";

// script-src의 'unsafe-inline'은 테마를 첫 화면 전에 적용하는 인라인 스크립트와 Next의 스트리밍 스크립트에 필요하다.
// nonce 방식은 Partial Prefetching과 함께 쓸 수 없다.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const headers = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // 도커 이미지를 만들 때만 standalone으로 빌드한다. next start와 함께 쓸 수 없다.
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const, outputFileTracingRoot: new URL("../..", import.meta.url).pathname }
    : {}),
  poweredByHeader: false,
  reactCompiler: true,
  cacheComponents: true,
  partialPrefetching: true,
  headers: async () => [{ source: "/(.*)", headers }],
};

export default nextConfig;
