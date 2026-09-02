import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

// next/jest wraps this to load Next.js's SWC config, CSS/asset mocks, etc.
// Plain .mjs (not .ts) so Jest doesn't need a ts-node dependency just to read
// its own config -- ts-node isn't in the Phase 2 approved package list.
export default createJestConfig(customConfig);
