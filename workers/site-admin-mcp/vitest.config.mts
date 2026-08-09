import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

process.env.ANALYTICS_IP_HASH_SALT ??= "site-admin-mcp-test-only-hmac-key";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "src/index.ts",
      wrangler: {
        configPath: "wrangler.jsonc"
      },
      miniflare: {
        // Production uses 2026-08-07. The pinned local workerd currently
        // supports compatibility dates through 2026-07-29.
        compatibilityDate: "2026-07-29",
        bindings: {
          ANALYTICS_IP_HASH_SALT: "site-admin-mcp-test-only-hmac-key"
        }
      }
    })
  ],
  test: {
    include: ["test/**/*.test.ts"]
  }
});
