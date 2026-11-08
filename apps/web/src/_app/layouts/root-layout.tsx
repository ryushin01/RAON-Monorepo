import "../styles/global.scss";

import type { Metadata } from "next";
import { Geist, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import type { ReactNode } from "react";
import { PREFERENCES_SCRIPT } from "@/shared/config";
import { QueryProvider } from "../providers/query-provider";

// 글꼴은 Geist 하나로 굵기만 달리한다. 한글이 없어 한글은 Noto로 이어진다.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const sans = Noto_Sans_KR({ variable: "--font-noto-sans", subsets: ["latin"], preload: false, display: "swap" });
const serif = Noto_Serif_KR({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  preload: false,
  display: "swap",
});

export const rootMetadata: Metadata = {
  title: { default: "RAON 라온", template: "%s | RAON 라온" },
  description: "웹툰과 웹소설을 연재하고 감상하는 플랫폼",
};

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    // 저장된 테마를 스크립트가 html 속성으로 먼저 적용하므로 이 속성의 불일치는 의도한 것이다.
    <html lang="ko" className={`${geist.variable} ${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <body>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: 코드에 고정한 문자열이며 사용자 입력이 들어가지 않는다. */}
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
        <a href="#main" className="skip-link">
          본문 바로가기
        </a>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
