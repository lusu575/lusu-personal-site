import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const workerRoot = "workers/whiteboard/";
const workerPool = {
  main: `${workerRoot}src/index.ts`,
  wrangler: {
    configPath: `${workerRoot}wrangler.jsonc`
  },
  miniflare: {
    bindings: {
      WHITEBOARD_INTERNAL_SECRET:
        "test-only-whiteboard-internal-secret-000000000000"
    }
  }
};

export default defineConfig({
  plugins: [cloudflareTest(workerPool)],
  test: {
    include: [`${workerRoot}test/**/*.test.ts`]
  }
});
