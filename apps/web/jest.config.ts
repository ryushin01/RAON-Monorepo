import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ["/node_modules/", "/e2e/", "/screenshots/", "/.next/"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/app/**", "!src/**/*.stories.tsx", "!src/**/index*.ts"],
};

// @raon/contracts는 ESM으로 빌드하므로 변환 대상에 넣는다.
export default async () => {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    transformIgnorePatterns: ["/node_modules/(?!(@raon|zod)/)", "^.+\\.module\\.(css|sass|scss)$"],
  };
};
