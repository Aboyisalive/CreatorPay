import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests read the real local dev database; load .env the same
// way the Next.js runtime does so DATABASE_URL/AUTH_SECRET are available.
try {
  process.loadEnvFile();
} catch {
  // .env is optional — pure unit tests still run without it.
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // DB-backed tests create and clean up real rows; allow them time.
    testTimeout: 20_000,
    // Files share one database (and ledger balances), so run them one at a time.
    fileParallelism: false,
  },
});
