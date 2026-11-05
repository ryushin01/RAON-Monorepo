/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json", useESM: true }] },
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts", "!src/db/seed-data.ts", "!src/db/migrations/**"],
  testTimeout: 30000,
};
