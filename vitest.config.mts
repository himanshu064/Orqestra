import { fileURLToPath } from "node:url";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` throws under Node (no react-server condition); stub it for tests/scripts.
      "server-only": fileURLToPath(new URL("./vitest.empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000, // integration tests hit the Neon DB
  },
});
