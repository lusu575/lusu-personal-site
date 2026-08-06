import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "src/index.ts",
      wrangler: {
        configPath: "wrangler.jsonc"
      },
      miniflare: {
        // The pinned local workerd currently tops out here; production keeps
        // the explicitly requested 2026-08-06 compatibility date.
        compatibilityDate: "2026-07-29"
      }
    })
  ],
  test: {
    include: ["test/**/*.test.ts"]
  }
});
