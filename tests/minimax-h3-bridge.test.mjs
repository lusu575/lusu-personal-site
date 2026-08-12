import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createLoopbackBridge } from "../agents/minimax-h3-runner/src/bridge.mjs";

test("H3 Bridge exchanges one ticket and streams exact HEAD, full, and single-range results", async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), "h3-bridge-"));
  const jobId = "job_12345678";
  const bytes = Buffer.from("MiniMax H3 bridge range test result\n", "utf8");
  const resultSha256 = createHash("sha256").update(bytes).digest("hex");
  await mkdir(join(stateRoot, "results", jobId), { recursive: true });
  await writeFile(join(stateRoot, "results", jobId, "result.mp4"), bytes);

  let introspectionCalls = 0;
  const site = {
    async request(path, { body } = {}) {
      assert.equal(path, "/api/agent/minimax-h3/transfers/introspect");
      introspectionCalls += 1;
      assert.equal(body.runnerId, "runner_12345678");
      return {
        ticketId: body.ticketId,
        jobId,
        direction: "download",
        allowedMethods: ["GET", "HEAD"],
        maxBytes: bytes.length,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        result: { name: "result.mp4", mime: "video/mp4", bytes: bytes.length, sha256: resultSha256 }
      };
    }
  };
  const bridge = createLoopbackBridge({
    host: "127.0.0.1",
    port: 0,
    config: { baseUrl: "https://lusu575.com", stateRoot },
    site,
    getRunnerId: () => "runner_12345678"
  });
  await bridge.listen();
  const address = bridge.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const origin = "https://lusu575.com";

  try {
    const denied = await fetch(`${baseUrl}/v1/session/exchange`, {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: "ticket_12345678", secret: "h3t_12345678901234567890" })
    });
    assert.equal(denied.status, 403);

    const exchanged = await fetch(`${baseUrl}/v1/session/exchange`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: "ticket_12345678", secret: "h3t_12345678901234567890" })
    });
    assert.equal(exchanged.status, 200);
    assert.equal(exchanged.headers.get("access-control-allow-origin"), origin);
    const session = await exchanged.json();
    const cookie = exchanged.headers.get("set-cookie").split(";", 1)[0];
    assert.match(session.csrfToken, /^h3c_/u);
    assert.equal(introspectionCalls, 1);

    const full = await fetch(`${baseUrl}/v1/jobs/${jobId}/result`, { headers: { Cookie: cookie } });
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("cache-control"), "private, no-store, no-transform");
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.equal(full.headers.get("etag"), `"sha256-${resultSha256}"`);
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);

    const range = await fetch(`${baseUrl}/v1/jobs/${jobId}/result`, {
      headers: { Cookie: cookie, Range: "bytes=2-7" }
    });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 2-7/${bytes.length}`);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(2, 8));

    const head = await fetch(`${baseUrl}/v1/jobs/${jobId}/result`, {
      method: "HEAD",
      headers: { Cookie: cookie }
    });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), String(bytes.length));
    assert.equal((await head.arrayBuffer()).byteLength, 0);

    const invalidRange = await fetch(`${baseUrl}/v1/jobs/${jobId}/result`, {
      headers: { Cookie: cookie, Range: `bytes=${bytes.length}-` }
    });
    assert.equal(invalidRange.status, 416);
    assert.equal(invalidRange.headers.get("content-range"), `bytes */${bytes.length}`);

    const noSession = await fetch(`${baseUrl}/v1/jobs/${jobId}/result`);
    assert.equal(noSession.status, 401);
  } finally {
    await bridge.close();
    await rm(stateRoot, { recursive: true, force: true });
  }
});
