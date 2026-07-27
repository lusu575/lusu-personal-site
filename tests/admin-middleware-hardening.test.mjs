import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/admin/_middleware.js";

function adminDb(row = null) {
  return {
    prepare() {
      return {
        bind() {
          return {
            first: async () => row
          };
        }
      };
    }
  };
}

function assertAdminSecurityHeaders(response) {
  const csp = response.headers.get("Content-Security-Policy") || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "same-origin");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  const permissions = response.headers.get("Permissions-Policy") || "";
  for (const feature of ["camera=()", "geolocation=()", "microphone=()", "payment=()", "usb=()"]) {
    assert.match(permissions, new RegExp(feature.replace(/[()]/g, "\\$&")));
  }
}

test("admin login is non-embeddable and keeps coarse/narrow controls at least 44px", async () => {
  const response = await onRequest({
    request: new Request("https://example.test/admin/", {
      headers: { Accept: "text/html" }
    }),
    env: { DB: adminDb() },
    next: async () => {
      throw new Error("unauthenticated requests must not reach the admin asset");
    }
  });

  assert.equal(response.status, 401);
  assertAdminSecurityHeaders(response);
  const html = await response.text();
  assert.match(html, /input\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/);
  assert.match(html, /button\s*\{[^}]*min-height:\s*44px;/);
  assert.match(html, /@media \(pointer:\s*coarse\)\s*\{[\s\S]*?min-height:\s*44px;/);
});

test("authenticated admin assets receive the same hardening headers", async () => {
  const response = await onRequest({
    request: new Request("https://example.test/admin/index.html", {
      headers: {
        Accept: "text/html",
        Cookie: "lusu_session=admin-session"
      }
    }),
    env: {
      DB: adminDb({
        id: "admin-1",
        email: "admin@example.test",
        role: "admin"
      })
    },
    next: async () => new Response("admin asset", {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    })
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "admin asset");
  assertAdminSecurityHeaders(response);
});
