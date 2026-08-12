import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";

const MAX_RESPONSE_BYTES = 128 * 1024;

export class SiteClientError extends Error {
  constructor(message, { status = 0, code = "H3_SITE_REQUEST_FAILED" } = {}) {
    super(message);
    this.name = "SiteClientError";
    this.status = status;
    this.code = code;
    this.uncertain = status === 0 || status >= 500;
  }
}

export function createSiteClient(config, token) {
  const baseUrl = new URL(config.baseUrl);
  if (baseUrl.protocol !== "https:" || baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) {
    throw new Error("Runner baseUrl must be an HTTPS origin without a path or query.");
  }
  if (!/^lusu_agent_[A-Za-z0-9_-]{40,180}$/u.test(token)) {
    throw new Error("Runner Agent token is missing or has an invalid format.");
  }

  const dispatcher = new EnvHttpProxyAgent({
    httpProxy: firstEnvironmentValue(["HTTP_PROXY", "http_proxy"]),
    httpsProxy: firstEnvironmentValue(["HTTPS_PROXY", "https_proxy"]),
    noProxy: firstEnvironmentValue(["NO_PROXY", "no_proxy"])
  });
  let closed = false;

  return {
    async request(path, { method = "GET", body = undefined, signal } = {}) {
      if (closed) throw new Error("Runner site client is closed.");
      if (!path.startsWith("/api/agent/minimax-h3/")) throw new Error("Runner site path is outside the H3 Agent API.");
      const response = await undiciFetch(new URL(path, baseUrl), {
        method,
        dispatcher,
        signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json; charset=utf-8" })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (response.status === 204) return null;
      const raw = await readBoundedText(response);
      let payload = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        throw new SiteClientError("H3 site returned invalid JSON.", { status: response.status, code: "H3_SITE_INVALID_JSON" });
      }
      if (!response.ok) {
        throw new SiteClientError("H3 site request was rejected.", {
          status: response.status,
          code: typeof payload?.code === "string" ? payload.code : "H3_SITE_REQUEST_REJECTED"
        });
      }
      return payload;
    },
    async close() {
      if (closed) return;
      closed = true;
      await dispatcher.close();
    }
  };
}

function firstEnvironmentValue(names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return undefined;
}

async function readBoundedText(response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new SiteClientError("H3 site response is too large.", { status: response.status, code: "H3_SITE_RESPONSE_TOO_LARGE" });
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new SiteClientError("H3 site response is too large.", { status: response.status, code: "H3_SITE_RESPONSE_TOO_LARGE" });
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
