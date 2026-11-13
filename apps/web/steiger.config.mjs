import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

/** FSD 구조 검사 (yarn lint가 함께 돌립니다) */
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Next.js의 app·pages 폴더와 겹치지 않도록 계층 이름을 _app, _pages로 씁니다.
    rules: { "fsd/typo-in-layer-name": "off" },
  },
  {
    // Next.js 라우트 폴더(src/app)는 FSD 계층이 아니라 _pages·_app을 다시 내보내기만 합니다.
    ignores: ["./src/app/**"],
  },
]);
