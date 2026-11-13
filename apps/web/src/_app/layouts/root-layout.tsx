import "../styles/global.scss";

import type { Metadata } from "next";
import { Do_Hyeon, Gowun_Batang, Nanum_Gothic, Nanum_Myeongjo } from "next/font/google";
import type { ReactNode } from "react";
import { PREFERENCES_SCRIPT } from "@/shared/config";
import { QueryProvider } from "../query-client/query-provider";

// 작품 제목은 웹툰 말풍선 같은 도현, 소설 본문은 오래 읽어도 편한 나눔명조, 화면 글과 코인·연재 정보는 나눔고딕.
// 한글 글꼴은 글자 묶음별 조각 파일이라 미리 받지 않고(preload: false) 화면에 쓰인 조각만 받는다.
const display = Do_Hyeon({
  variable: "--font-do-hyeon",
  subsets: ["latin"],
  weight: "400",
  preload: false,
  display: "swap",
});
const sans = Nanum_Gothic({
  variable: "--font-nanum-gothic",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  preload: false,
  display: "swap",
});
const serif = Nanum_Myeongjo({
  variable: "--font-nanum-myeongjo",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  preload: false,
  display: "swap",
});

// 뷰어 글꼴 선택지인 고운바탕. 글꼴 선언만 두고, 뷰어에서 고른 독자의 화면에서만 파일을 받는다.
const batang = Gowun_Batang({
  variable: "--font-gowun-batang",
  subsets: ["latin"],
  weight: ["400", "700"],
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
    <html
      lang="ko"
      className={`${display.variable} ${sans.variable} ${serif.variable} ${batang.variable}`}
      suppressHydrationWarning
    >
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
