import { defineConfig, devices } from "@playwright/test";

const API_PORT = 4177;
const WEB_PORT = 3177;

/** 프로덕션 빌드와 빈 DB(가상 데이터)로 검사한다. 먼저 yarn build가 필요하다. */
export default defineConfig({
  testDir: process.env.SCREENSHOTS ? "./screenshots" : "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  outputDir: "./test-results",
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure", locale: "ko-KR" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node -e \"require('fs').rmSync('.data/e2e',{recursive:true,force:true})\" && node dist/main.js",
      cwd: "../api",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      // 테스트마다 같은 계정으로 로그인하므로 시도 제한을 늘린다. 제한 자체는 API 테스트가 검사한다.
      env: { PORT: String(API_PORT), PGLITE_DATA_DIR: ".data/e2e", NODE_ENV: "test", LOGIN_RATE_LIMIT: "1000" },
    },
    {
      command: `next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      env: { API_URL: `http://localhost:${API_PORT}`, NODE_ENV: "production" },
    },
  ],
});
