import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@cluvvi/application": fileURLToPath(
        new URL("./packages/application/src/index.ts", import.meta.url),
      ),
      "@cluvvi/config": fileURLToPath(new URL("./packages/config/src/index.ts", import.meta.url)),
      "@cluvvi/core/hiring-validation": fileURLToPath(
        new URL("./packages/core/src/local/hiring/validators.ts", import.meta.url),
      ),
      "@cluvvi/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@cluvvi/database": fileURLToPath(
        new URL("./packages/database/src/index.ts", import.meta.url),
      ),
      "@cluvvi/engine": fileURLToPath(new URL("./packages/engine/src/index.ts", import.meta.url)),
      "@cluvvi/storage": fileURLToPath(new URL("./packages/storage/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.cluvvi/**",
      "**/.cluvvi-test/**",
      "**/supabase/.temp/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["packages/*/src/**/*.ts", "apps/cli/src/**/*.ts", "apps/worker/src/**/*.ts"],
      exclude: ["**/index.ts", "**/*.d.ts"],
    },
  },
});
