import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "src/index.ts",
      wrangler: { configPath: "wrangler.jsonc" },
      miniflare: {
        compatibilityDate: "2026-07-29",
        bindings: {
          TEAM_DOMAIN: "https://unit-test.cloudflareaccess.com",
          POLICY_AUD: "unit-test-audience",
          OWNER_EMAIL: "owner@example.com",
          MCP_HOSTNAME: "daily-ai-news-mcp.test"
        }
      }
    })
  ],
  test: {
    include: ["test/**/*.test.ts"],
    fakeTimers: { toFake: ["Date"] }
  }
});
