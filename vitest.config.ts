import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside of React Server Components — stub it for tests.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The db Pool is created at import time but never connects (no queries run in tests).
    env: {
      DATABASE_URL: "postgres://test:test@127.0.0.1:5432/test?sslmode=disable",
      AUTH_SECRET: "test-secret-at-least-16-chars-long",
      NODE_ENV: "test",
    },
  },
});
