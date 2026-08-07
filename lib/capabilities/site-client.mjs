import { listCapabilities } from "./registry.mjs";
import {
  getPublicGame,
  projectPublicGameCatalog
} from "./public-catalog-adapter.mjs";
import {
  getJapaneseSubtextStage as getJapaneseSubtextStageFromContent,
  listJapaneseSubtextLevels as listJapaneseSubtextLevelsFromContent,
  listJapaneseSubtextStages as listJapaneseSubtextStagesFromContent
} from "./japanese-subtext-adapter.mjs";
import {
  TransferRoomSecret,
  decryptTransferText,
  deriveTransferRoomSecret,
  encryptTransferText
} from "./transfer-crypto.mjs";

const DEFAULT_BASE_URL = "https://lusu575.com";
const DEFAULT_MAX_JSON_BYTES = 1024 * 1024;
const DEFAULT_MAX_WHITEBOARD_BYTES = 15 * 1024 * 1024;
const MAX_WHITEBOARD_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_JSON_BYTES = 64 * 1024;
const MAX_AGENT_ARTICLE_JSON_BYTES = 700 * 1024;
const MAX_JAPANESE_PROGRESS_BYTES = 256 * 1024;
const LANGUAGE_VALUES = new Set(["zh", "en", "ja"]);
const WHITEBOARD_ASSET_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export class SiteClientError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "SiteClientError";
    this.status = Number(options.status || 0);
    this.code = String(options.code || "SITE_CLIENT_ERROR");
    this.method = String(options.method || "");
    this.path = String(options.path || "");
    this.details = options.details && typeof options.details === "object"
      ? options.details
      : undefined;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      status: this.status,
      method: this.method,
      path: this.path
    };
  }
}

export class SiteClient {
  constructor(options = {}) {
    if (typeof (options.fetch || globalThis.fetch) !== "function") {
      throw new TypeError("SiteClient requires a fetch implementation.");
    }
    this.fetch = options.fetch || globalThis.fetch.bind(globalThis);
    this.baseUrl = normalizeBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
    this.accessToken = options.accessToken || "";
    this.maxJsonBytes = positiveInteger(options.maxJsonBytes, DEFAULT_MAX_JSON_BYTES);
    this.maxWhiteboardBytes = positiveInteger(options.maxWhiteboardBytes, DEFAULT_MAX_WHITEBOARD_BYTES);
  }

  setAccessToken(accessToken) {
    this.accessToken = accessToken || "";
    return this;
  }

  capabilities(filters = {}) {
    return listCapabilities(filters);
  }

  async listArticles(options = {}) {
    const query = new URLSearchParams({
      lang: normalizeLanguage(options.lang),
      limit: String(clampInteger(options.limit, 1, 500, 100))
    });
    if (options.category) query.set("category", String(options.category).trim());
    return this.requestJson(`/api/articles?${query}`);
  }

  async getArticle(slug, options = {}) {
    const normalizedSlug = requiredText(slug, "Article slug is required.");
    const query = new URLSearchParams({ lang: normalizeLanguage(options.lang) });
    return this.requestJson(`/api/articles/${encodeURIComponent(normalizedSlug)}?${query}`);
  }

  async searchArticles(options = {}) {
    const queryText = String(options.query || "").normalize("NFKC").trim().toLocaleLowerCase();
    const payload = await this.listArticles({
      lang: options.lang,
      category: options.category,
      limit: options.scanLimit || 500
    });
    const terms = queryText.split(/\s+/u).filter(Boolean);
    const matches = (payload.articles || []).filter((article) => {
      if (!terms.length) return true;
      const haystack = [article.title, article.summary, article.slug, ...(article.tags || [])]
        .join("\n")
        .normalize("NFKC")
        .toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).slice(0, clampInteger(options.limit, 1, 100, 20));
    return { articles: matches, lang: payload.lang || normalizeLanguage(options.lang), query: queryText };
  }

  async getDailyNews(options = {}) {
    const date = normalizeOptionalDate(options.date);
    const listing = await this.listArticles({
      lang: options.lang,
      category: "daily-ai-news",
      limit: options.scanLimit || 200
    });
    const match = (listing.articles || []).find((article) => !date || articleMatchesDate(article, date));
    if (!match) {
      throw new SiteClientError(
        date ? `No Daily AI News issue was found for ${date}.` : "No Daily AI News issue was found.",
        { status: 404, code: "DAILY_AI_NEWS_NOT_FOUND", method: "GET", path: "/api/articles" }
      );
    }
    return this.getArticle(match.slug, { lang: options.lang });
  }

  async listManagedArticles(options = {}) {
    const query = new URLSearchParams({
      limit: String(clampInteger(options.limit, 1, 200, 50))
    });
    if (options.status) query.set("status", String(options.status).trim());
    if (options.category) query.set("category", String(options.category).trim());
    return this.requestJson(`/api/agent/articles?${query}`);
  }

  async getManagedArticle(articleId) {
    const normalizedArticleId = stableRecordId(
      articleId,
      "Article id is invalid.",
      "ARTICLE_ID_INVALID"
    );
    return this.requestJson(`/api/agent/articles/${encodeURIComponent(normalizedArticleId)}`);
  }

  async publishArticle(payload) {
    return this.requestJson("/api/agent/articles/publish", {
      method: "POST",
      json: requiredObject(payload, "Article publish payload is required.", "ARTICLE_PAYLOAD_REQUIRED"),
      maxRequestJsonBytes: MAX_AGENT_ARTICLE_JSON_BYTES
    });
  }

  async updateArticle(articleId, payload) {
    const normalizedArticleId = stableRecordId(
      articleId,
      "Article id is invalid.",
      "ARTICLE_ID_INVALID"
    );
    return this.requestJson(`/api/agent/articles/${encodeURIComponent(normalizedArticleId)}`, {
      method: "PUT",
      json: requiredObject(payload, "Article update payload is required.", "ARTICLE_PAYLOAD_REQUIRED"),
      maxRequestJsonBytes: MAX_AGENT_ARTICLE_JSON_BYTES
    });
  }

  async deleteArticle(articleId, payload) {
    const normalizedArticleId = stableRecordId(
      articleId,
      "Article id is invalid.",
      "ARTICLE_ID_INVALID"
    );
    return this.requestJson(`/api/agent/articles/${encodeURIComponent(normalizedArticleId)}`, {
      method: "DELETE",
      json: requiredObject(payload, "Article delete payload is required.", "ARTICLE_PAYLOAD_REQUIRED"),
      maxRequestJsonBytes: MAX_AGENT_ARTICLE_JSON_BYTES
    });
  }

  async listVideos(options = {}) {
    const query = new URLSearchParams({ lang: normalizeLanguage(options.lang) });
    const payload = await this.requestJson(`/api/videos?${query}`);
    const search = String(options.query || "").normalize("NFKC").trim().toLocaleLowerCase();
    const categories = new Set(toStringArray(options.categories));
    const videos = (payload.videos || []).filter((video) => {
      if (search) {
        const haystack = [video.title, video.description, video.author_name, video.platform]
          .join("\n").normalize("NFKC").toLocaleLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (categories.size && !(video.categories || []).some((category) => categories.has(category.id || category))) {
        return false;
      }
      return true;
    }).slice(0, clampInteger(options.limit, 1, 80, 80));
    return { ...payload, videos };
  }

  async getVideo(videoId) {
    const normalizedVideoId = stableRecordId(videoId, "Video id is invalid.", "VIDEO_ID_INVALID");
    return this.requestJson(`/api/videos/${encodeURIComponent(normalizedVideoId)}`);
  }

  async listGames({ lang = "zh", agentOnly = false } = {}) {
    const payload = await this.requestJson("/games/catalog.json", { maxResponseBytes: 64 * 1024 });
    return projectPublicGameCatalog(payload, { lang, agentOnly });
  }

  async getGame(gameId, { lang = "zh" } = {}) {
    const payload = await this.requestJson("/games/catalog.json", { maxResponseBytes: 64 * 1024 });
    return getPublicGame(payload, gameId, { lang });
  }

  async listJapaneseSubtextLevels({ lang = "zh" } = {}) {
    return listJapaneseSubtextLevelsFromContent(this, { lang });
  }

  async listJapaneseSubtextStages({ level, query, limit = 50, lang = "zh" } = {}) {
    return listJapaneseSubtextStagesFromContent(this, { level, query, limit, lang });
  }

  async getJapaneseSubtextStage(stageId, { lang = "zh" } = {}) {
    return getJapaneseSubtextStageFromContent(this, stageId, { lang });
  }

  async getJapaneseSubtextProgress(options = {}) {
    const query = new URLSearchParams();
    if (options.stageId !== undefined) {
      query.set("stageId", japaneseStageId(options.stageId));
    }
    if (options.days !== undefined) {
      query.set("days", String(boundedInteger(
        options.days,
        1,
        90,
        "Japanese Subtext progress days must be an integer from 1 to 90.",
        "JAPANESE_SUBTEXT_PROGRESS_DAYS_INVALID"
      )));
    }
    const suffix = query.size ? `?${query}` : "";
    return this.requestJson(`/api/tools/japanese-subtext/agent-progress${suffix}`, {
      maxResponseBytes: MAX_JAPANESE_PROGRESS_BYTES
    });
  }

  async submitJapaneseSubtextAttempt(input) {
    return this.requestJson("/api/tools/japanese-subtext/attempts", {
      method: "POST",
      json: normalizeJapaneseSubtextAttempt(input),
      maxResponseBytes: MAX_JAPANESE_PROGRESS_BYTES
    });
  }

  async startDeviceAuthorization(options = {}) {
    return this.requestJson("/api/agent-auth/device/start", {
      method: "POST",
      json: options
    });
  }

  async pollDeviceAuthorization(deviceCode, options = {}) {
    return this.requestJson("/api/agent-auth/device/token", {
      method: "POST",
      json: { deviceCode: requiredText(deviceCode, "Device code is required.") },
      signal: options.signal
    });
  }

  async getAgentIdentity() {
    return this.requestJson("/api/agent-auth/me");
  }

  async revokeAgentToken() {
    return this.requestJson("/api/agent-auth/tokens/current", { method: "DELETE" });
  }

  async getTransferConfig() {
    return this.requestJson("/api/transfer/config");
  }

  async joinTransferRoom(secretOrRoomKey) {
    const roomKey = transferRoomKey(secretOrRoomKey);
    return this.requestJson("/api/transfer/room/join", {
      method: "POST",
      json: { roomKey }
    });
  }

  async joinTransferPassphrase(passphrase, options = {}) {
    const secret = await deriveTransferRoomSecret(passphrase, options);
    const result = await this.joinTransferRoom(secret);
    return { room: result.room, secret };
  }

  async listTransferItems(secretOrRoomKey, options = {}) {
    const roomKey = transferRoomKey(secretOrRoomKey);
    const query = new URLSearchParams({
      room: roomKey,
      limit: String(clampInteger(options.limit, 1, 100, 100))
    });
    if (options.cursor) query.set("cursor", String(options.cursor));
    const payload = await this.requestJson(`/api/transfer/room/items?${query}`, { signal: options.signal });
    if (!(secretOrRoomKey instanceof TransferRoomSecret)) return payload;
    const items = await Promise.all((payload.items || []).map(async (item) => {
      if (item.type !== "text" || !item.encryptedContent) return item;
      try {
        return { ...item, text: await decryptTransferText(item.encryptedContent, secretOrRoomKey) };
      } catch (error) {
        return { ...item, decryptionError: error.code || "TRANSFER_DECRYPT_FAILED" };
      }
    }));
    return { ...payload, items };
  }

  async sendTransferText(secret, text, options = {}) {
    if (!(secret instanceof TransferRoomSecret)) {
      throw new TypeError("sendTransferText requires a TransferRoomSecret.");
    }
    const value = String(text ?? "").trim();
    if (!value) {
      throw new SiteClientError("Transfer text cannot be empty.", { code: "TRANSFER_TEXT_EMPTY" });
    }
    const encryptedContent = await encryptTransferText(value, secret);
    return this.requestJson("/api/transfer/text", {
      method: "POST",
      json: {
        roomKey: secret.roomKey,
        encryptedContent,
        idempotencyKey: options.idempotencyKey || randomIdempotencyKey()
      },
      signal: options.signal
    });
  }

  async uploadTransferFile(secretOrRoomKey, file, options = {}) {
    const roomKey = transferRoomKey(secretOrRoomKey);
    const filename = requiredText(file?.filename, "Upload filename is required.");
    const sizeBytes = Number(file?.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || !file?.body) {
      throw new SiteClientError("Upload body and an exact positive size are required.", {
        code: "TRANSFER_UPLOAD_INPUT_INVALID"
      });
    }
    const mimeType = String(file.mimeType || "application/octet-stream").trim();
    const query = new URLSearchParams({
      room: roomKey,
      filename,
      mime: mimeType,
      size: String(sizeBytes)
    });
    return this.requestJson(`/api/transfer/upload/simple?${query}`, {
      method: "POST",
      body: file.body,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(sizeBytes),
        "Idempotency-Key": options.idempotencyKey || randomIdempotencyKey()
      },
      duplex: needsFetchDuplex(file.body) ? "half" : undefined,
      signal: options.signal
    });
  }

  async downloadTransferFile(secretOrRoomKey, itemId, writable, options = {}) {
    const roomKey = transferRoomKey(secretOrRoomKey);
    if (!writable) throw new TypeError("A writable destination is required.");
    const query = new URLSearchParams({ room: roomKey, download: "1" });
    const response = await this.requestResponse(
      `/api/transfer/file/${encodeURIComponent(requiredText(itemId, "Transfer item id is required."))}?${query}`,
      { signal: options.signal }
    );
    const metadata = {
      status: response.status,
      contentType: response.headers.get("Content-Type") || "application/octet-stream",
      contentLength: numberHeader(response.headers.get("Content-Length")),
      contentDisposition: response.headers.get("Content-Disposition") || "",
      bytesWritten: 0
    };
    try {
      metadata.bytesWritten = await streamToWritable(response.body, writable, options.signal);
      if (metadata.contentLength !== null && metadata.bytesWritten !== metadata.contentLength) {
        throw new SiteClientError("The transfer download ended before its declared length.", {
          code: "TRANSFER_DOWNLOAD_LENGTH_MISMATCH",
          path: "/api/transfer/file"
        });
      }
      if (options.close !== false) await closeWritable(writable);
      return metadata;
    } catch (error) {
      await abortWritable(writable, error);
      if (error instanceof SiteClientError) throw error;
      throw new SiteClientError("The transfer download could not be written.", {
        code: "TRANSFER_DOWNLOAD_WRITE_FAILED",
        path: "/api/transfer/file",
        cause: error
      });
    }
  }

  async deleteTransferItem(secretOrRoomKey, itemId) {
    const roomKey = transferRoomKey(secretOrRoomKey);
    const query = new URLSearchParams({ room: roomKey });
    return this.requestJson(
      `/api/transfer/item/${encodeURIComponent(requiredText(itemId, "Transfer item id is required."))}?${query}`,
      { method: "DELETE" }
    );
  }

  async joinWhiteboardRoom(options = {}) {
    const type = options.type === "private" ? "private" : "public";
    const payload = { type };
    if (type === "private") payload.password = normalizeWhiteboardPassword(options.password);
    return this.requestJson("/api/whiteboard/agent/rooms/join", {
      method: "POST",
      json: payload,
      signal: options.signal
    });
  }

  async getWhiteboardScene(accessToken, options = {}) {
    const response = await this.requestResponse("/api/whiteboard/agent/scene", {
      headers: {
        Accept: "application/vnd.yjs",
        "X-Whiteboard-Access-Token": whiteboardAccessToken(accessToken)
      },
      signal: options.signal
    });
    const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
    if (!contentType.startsWith("application/vnd.yjs")) {
      throw new SiteClientError("The whiteboard scene response has an unexpected media type.", {
        code: "WHITEBOARD_SCENE_MEDIA_TYPE_INVALID",
        status: response.status,
        method: "GET",
        path: "/api/whiteboard/agent/scene"
      });
    }
    const updateBytes = await readBoundedBody(response.body, this.maxWhiteboardBytes, response);
    return {
      updateBytes,
      documentVersion: nonNegativeIntegerHeader(response.headers.get("X-Whiteboard-Document-Version")),
      locked: response.headers.get("X-Whiteboard-Locked") === "1"
    };
  }

  async applyWhiteboardUpdate(accessToken, update, options = {}) {
    const bytes = update instanceof Uint8Array
      ? update
      : update instanceof ArrayBuffer
        ? new Uint8Array(update)
        : null;
    if (!bytes?.byteLength || bytes.byteLength > 256 * 1024) {
      throw new SiteClientError("The whiteboard update must contain 1-262144 bytes.", {
        code: "WHITEBOARD_UPDATE_SIZE_INVALID"
      });
    }
    const operationId = String(options.operationId || "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/.test(operationId)) {
      throw new SiteClientError("A valid whiteboard operationId is required.", {
        code: "WHITEBOARD_OPERATION_ID_INVALID"
      });
    }
    return this.requestJson("/api/whiteboard/agent/scene", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/vnd.yjs-update",
        "X-Whiteboard-Access-Token": whiteboardAccessToken(accessToken),
        "X-Whiteboard-Operation-Id": operationId
      },
      body: bytes,
      signal: options.signal
    });
  }

  async uploadWhiteboardAsset(accessToken, file, options = {}) {
    const sizeBytes = Number(file?.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_WHITEBOARD_ASSET_BYTES || !file?.body) {
      throw new SiteClientError("A whiteboard image must contain 1-5242880 bytes.", {
        code: "WHITEBOARD_ASSET_SIZE_INVALID"
      });
    }
    const bodyLength = bodyByteLength(file.body);
    if (bodyLength !== null && bodyLength !== sizeBytes) {
      throw new SiteClientError("The whiteboard image size does not match its body.", {
        code: "WHITEBOARD_ASSET_LENGTH_MISMATCH"
      });
    }
    const contentType = whiteboardAssetContentType(file.contentType);
    const operationId = whiteboardOperationId(options.operationId);
    return this.requestJson("/api/whiteboard/agent/assets", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": contentType,
        "Content-Length": String(sizeBytes),
        "X-Whiteboard-Access-Token": whiteboardAccessToken(accessToken),
        "X-Whiteboard-Operation-Id": operationId
      },
      body: file.body,
      duplex: needsFetchDuplex(file.body) ? "half" : undefined,
      signal: options.signal
    });
  }

  async getWhiteboardAsset(accessToken, assetId, options = {}) {
    const normalizedAssetId = whiteboardAssetId(assetId);
    const path = `/api/whiteboard/agent/assets/${encodeURIComponent(normalizedAssetId)}`;
    const response = await this.requestResponse(path, {
      headers: {
        Accept: "image/png,image/jpeg,image/webp",
        "X-Whiteboard-Access-Token": whiteboardAccessToken(accessToken)
      },
      signal: options.signal
    });
    return readWhiteboardAssetResponse(response, normalizedAssetId, path);
  }

  async downloadWhiteboardAsset(accessToken, assetId, writable, options = {}) {
    if (!writable) throw new TypeError("A writable destination is required.");
    const asset = await this.getWhiteboardAsset(accessToken, assetId, options);
    try {
      await writeBytesToWritable(writable, asset.bytes);
      if (options.close !== false) await closeWritable(writable);
      const { bytes: _bytes, ...metadata } = asset;
      return { ...metadata, bytesWritten: asset.bytes.byteLength };
    } catch (error) {
      await abortWritable(writable, error);
      if (error instanceof SiteClientError) throw error;
      throw new SiteClientError("The whiteboard image could not be written.", {
        code: "WHITEBOARD_ASSET_WRITE_FAILED",
        path: "/api/whiteboard/agent/assets",
        cause: error
      });
    }
  }

  async requestJson(path, options = {}) {
    const response = await this.requestResponse(path, options);
    const requestedMaxBytes = positiveInteger(options.maxResponseBytes, this.maxJsonBytes);
    return readBoundedJson(response, Math.min(this.maxJsonBytes, requestedMaxBytes), {
      method: String(options.method || "GET").toUpperCase(),
      path: safePath(response.url || new URL(path, this.baseUrl).pathname)
    });
  }

  async requestResponse(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const url = new URL(path, this.baseUrl);
    if (url.origin !== new URL(this.baseUrl).origin) {
      throw new SiteClientError("Cross-origin site client requests are not allowed.", {
        code: "SITE_CROSS_ORIGIN_REJECTED",
        method,
        path: url.pathname
      });
    }
    const headers = new Headers(options.headers || {});
    const token = await resolveAccessToken(this.accessToken);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let body = options.body;
    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      const maxRequestJsonBytes = Math.min(
        MAX_AGENT_ARTICLE_JSON_BYTES,
        positiveInteger(options.maxRequestJsonBytes, MAX_REQUEST_JSON_BYTES)
      );
      if (new TextEncoder().encode(body).byteLength > maxRequestJsonBytes) {
        throw new SiteClientError("The JSON request is too large.", {
          code: "SITE_REQUEST_JSON_TOO_LARGE",
          method,
          path: url.pathname
        });
      }
      headers.set("Content-Type", "application/json");
    }
    if (method !== "GET" && method !== "HEAD") headers.set("Origin", url.origin);
    let response;
    try {
      const fetchOptions = {
        method,
        headers,
        body,
        signal: options.signal,
        credentials: "omit",
        redirect: "error"
      };
      if (options.duplex) fetchOptions.duplex = options.duplex;
      response = await this.fetch(url, fetchOptions);
    } catch (error) {
      throw new SiteClientError("The site request failed before receiving a response.", {
        code: error?.name === "AbortError" ? "SITE_REQUEST_ABORTED" : "SITE_NETWORK_ERROR",
        method,
        path: url.pathname,
        cause: error
      });
    }
    if (!response?.ok) {
      const details = await readErrorPayload(response, Math.min(this.maxJsonBytes, 64 * 1024));
      throw new SiteClientError(
        typeof details?.error === "string" && details.error ? details.error : `HTTP ${response?.status || 0}`,
        {
          status: response?.status || 0,
          code: details?.code || "SITE_HTTP_ERROR",
          method,
          path: url.pathname,
          details
        }
      );
    }
    return response;
  }
}

export function createSiteClient(options = {}) {
  return new SiteClient(options);
}

async function readBoundedJson(response, maxBytes, request) {
  const declaredLength = numberHeader(response.headers?.get?.("Content-Length"));
  if (declaredLength !== null && declaredLength > maxBytes) {
    throw new SiteClientError("The site JSON response exceeded the configured limit.", {
      code: "SITE_RESPONSE_TOO_LARGE",
      status: response.status,
      ...request
    });
  }
  const bytes = await readBoundedBody(response.body, maxBytes, response);
  if (!bytes.byteLength) return {};
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new SiteClientError("The site returned invalid JSON.", {
      code: "SITE_RESPONSE_INVALID_JSON",
      status: response.status,
      ...request,
      cause: error
    });
  }
}

async function readErrorPayload(response, maxBytes) {
  if (!response) return {};
  try {
    const bytes = await readBoundedBody(response.body, maxBytes, response);
    if (!bytes.byteLength) return {};
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function readWhiteboardAssetResponse(response, assetId, path) {
  const contentType = String(response.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!WHITEBOARD_ASSET_CONTENT_TYPES.has(contentType)) {
    throw new SiteClientError("The whiteboard image response has an unexpected media type.", {
      code: "WHITEBOARD_ASSET_MEDIA_TYPE_INVALID",
      status: response.status,
      method: "GET",
      path
    });
  }
  const contentLength = numberHeader(response.headers.get("Content-Length"));
  if (contentLength !== null && (contentLength < 1 || contentLength > MAX_WHITEBOARD_ASSET_BYTES)) {
    throw new SiteClientError("The whiteboard image response exceeded the 5 MiB limit.", {
      code: "WHITEBOARD_ASSET_SIZE_INVALID",
      status: response.status,
      method: "GET",
      path
    });
  }
  let bytes;
  try {
    bytes = await readBoundedBody(response.body, MAX_WHITEBOARD_ASSET_BYTES, response);
  } catch (error) {
    if (!(error instanceof SiteClientError) || error.code !== "SITE_RESPONSE_TOO_LARGE") throw error;
    throw new SiteClientError("The whiteboard image response exceeded the 5 MiB limit.", {
      code: "WHITEBOARD_ASSET_SIZE_INVALID",
      status: response.status,
      method: "GET",
      path,
      cause: error
    });
  }
  if (!bytes.byteLength || (contentLength !== null && bytes.byteLength !== contentLength)) {
    throw new SiteClientError("The whiteboard image response length is invalid.", {
      code: "WHITEBOARD_ASSET_LENGTH_MISMATCH",
      status: response.status,
      method: "GET",
      path
    });
  }
  if (!whiteboardAssetSignatureMatches(bytes, contentType)) {
    throw new SiteClientError("The whiteboard image bytes do not match their declared media type.", {
      code: "WHITEBOARD_ASSET_SIGNATURE_INVALID",
      status: response.status,
      method: "GET",
      path
    });
  }
  return {
    assetId,
    contentType,
    byteLength: bytes.byteLength,
    bytes
  };
}

async function readBoundedBody(body, maxBytes, response) {
  if (!body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new SiteClientError("The site JSON response exceeded the configured limit.", {
        code: "SITE_RESPONSE_TOO_LARGE",
        status: response.status
      });
    }
    return bytes;
  }
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response too large");
        throw new SiteClientError("The site JSON response exceeded the configured limit.", {
          code: "SITE_RESPONSE_TOO_LARGE",
          status: response.status
        });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function streamToWritable(body, writable, signal) {
  if (!body?.getReader) {
    throw new SiteClientError("The transfer response did not include a readable body.", {
      code: "TRANSFER_DOWNLOAD_BODY_MISSING"
    });
  }
  const reader = body.getReader();
  const writer = typeof writable.getWriter === "function" ? writable.getWriter() : null;
  let total = 0;
  try {
    while (true) {
      if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      if (writer) await writer.write(value);
      else await writeNodeStyle(writable, value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock?.();
    writer?.releaseLock?.();
  }
  return total;
}

async function writeNodeStyle(writable, chunk) {
  if (typeof writable.write !== "function") throw new TypeError("Unsupported writable destination.");
  const accepted = writable.write(chunk);
  if (accepted && typeof accepted.then === "function") await accepted;
  else if (accepted === false) await new Promise((resolve, reject) => {
    writable.once("drain", resolve);
    writable.once("error", reject);
  });
}

async function writeBytesToWritable(writable, bytes) {
  if (typeof writable.getWriter === "function") {
    const writer = writable.getWriter();
    try { await writer.write(bytes); } finally { writer.releaseLock?.(); }
    return;
  }
  await writeNodeStyle(writable, bytes);
}

async function closeWritable(writable) {
  if (typeof writable.getWriter === "function") {
    const writer = writable.getWriter();
    try { await writer.close(); } finally { writer.releaseLock?.(); }
  } else if (typeof writable.close === "function") {
    await writable.close();
  } else if (typeof writable.end === "function") {
    await new Promise((resolve, reject) => writable.end((error) => error ? reject(error) : resolve()));
  }
}

async function abortWritable(writable, error) {
  try {
    if (typeof writable.getWriter === "function") {
      const writer = writable.getWriter();
      try { await writer.abort(error); } finally { writer.releaseLock?.(); }
    } else if (typeof writable.abort === "function") {
      await writable.abort(error);
    } else if (typeof writable.destroy === "function") {
      writable.destroy(error);
    }
  } catch {
    // Preserve the original transfer error.
  }
}

function normalizeBaseUrl(value) {
  const url = new URL(String(value));
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new TypeError("SiteClient baseUrl must be an HTTP(S) origin without credentials.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function normalizeLanguage(value) {
  const lang = String(value || "zh").trim().toLowerCase();
  return LANGUAGE_VALUES.has(lang) ? lang : "zh";
}

function normalizeOptionalDate(value) {
  const date = String(value || "").trim();
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new SiteClientError("Date must use YYYY-MM-DD.", { code: "DATE_INVALID" });
  }
  return date;
}

function articleMatchesDate(article, date) {
  if (String(article.slug || "").includes(date)) return true;
  return [article.published_at, article.created_at, article.updated_at]
    .some((value) => String(value || "").slice(0, 10) === date);
}

function transferRoomKey(value) {
  const roomKey = value instanceof TransferRoomSecret ? value.roomKey : String(value || "").trim();
  if (!/^transfer_[A-Za-z0-9_-]{32,80}$/.test(roomKey)) {
    throw new SiteClientError("A valid Quick Transfer room secret is required.", {
      code: "TRANSFER_ROOM_SECRET_REQUIRED"
    });
  }
  return roomKey;
}

function normalizeWhiteboardPassword(value) {
  const password = String(value ?? "").normalize("NFKC").trim();
  const length = Array.from(password).length;
  if (length < 4 || length > 128 || /\p{Cc}/u.test(password)) {
    throw new SiteClientError("A private whiteboard password must contain 4-128 valid characters.", {
      code: "WHITEBOARD_PASSWORD_INVALID"
    });
  }
  return password;
}

function whiteboardAccessToken(value) {
  const token = String(value || "").trim();
  if (!/^wbt1\.[!#$%&'*+\-.^_`|~0-9A-Za-z]{20,4090}$/.test(token)) {
    throw new SiteClientError("A valid whiteboard access token is required.", {
      code: "WHITEBOARD_ACCESS_TOKEN_INVALID"
    });
  }
  return token;
}

function whiteboardOperationId(value) {
  const operationId = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/.test(operationId)) {
    throw new SiteClientError("A valid whiteboard operationId is required.", {
      code: "WHITEBOARD_OPERATION_ID_INVALID"
    });
  }
  return operationId;
}

function whiteboardAssetId(value) {
  const assetId = String(value || "").trim();
  if (!/^[a-f0-9]{32}$/.test(assetId)) {
    throw new SiteClientError("A valid whiteboard asset id is required.", {
      code: "WHITEBOARD_ASSET_ID_INVALID"
    });
  }
  return assetId;
}

function whiteboardAssetContentType(value) {
  const contentType = String(value || "").trim().toLowerCase();
  if (!WHITEBOARD_ASSET_CONTENT_TYPES.has(contentType)) {
    throw new SiteClientError("Whiteboard assets must be PNG, JPEG, or WebP images.", {
      code: "WHITEBOARD_ASSET_MEDIA_TYPE_INVALID"
    });
  }
  return contentType;
}

function whiteboardAssetSignatureMatches(bytes, contentType) {
  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.byteLength >= signature.length
      && signature.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/jpeg") {
    return bytes.byteLength >= 4
      && bytes[0] === 0xff
      && bytes[1] === 0xd8
      && bytes[bytes.byteLength - 2] === 0xff
      && bytes[bytes.byteLength - 1] === 0xd9;
  }
  return bytes.byteLength >= 12
    && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
}

function requiredText(value, message) {
  const text = String(value || "").trim();
  if (!text) throw new SiteClientError(message, { code: "SITE_INPUT_REQUIRED" });
  return text;
}

function requiredObject(value, message, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SiteClientError(message, { code, status: 400 });
  }
  return value;
}

function stableRecordId(value, message, code) {
  const text = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/.test(text)) {
    throw new SiteClientError(message, { code, status: 400 });
  }
  return text;
}

function japaneseStageId(value) {
  const stageId = String(value || "").trim();
  if (!/^L[1-5]-(?:00[1-9]|0[1-4][0-9]|050)$/.test(stageId)) {
    throw new SiteClientError("A stage id from L1-001 through L5-050 is required.", {
      code: "JAPANESE_SUBTEXT_STAGE_ID_INVALID",
      status: 400
    });
  }
  return stageId;
}

function normalizeJapaneseSubtextAttempt(input) {
  assertExactObjectKeys(input, [
    "stageId",
    "stageRevision",
    "contentHash",
    "answers",
    "expectedRevision",
    "operationId"
  ], "JAPANESE_SUBTEXT_ATTEMPT_INVALID");
  const contentHash = String(input.contentHash || "").trim();
  if (!/^[a-f0-9]{64}$/.test(contentHash)) {
    throw new SiteClientError("Japanese Subtext contentHash must be a lowercase SHA-256 digest.", {
      code: "JAPANESE_SUBTEXT_CONTENT_HASH_INVALID",
      status: 400
    });
  }
  if (!Array.isArray(input.answers) || input.answers.length < 1 || input.answers.length > 5) {
    throw new SiteClientError("Japanese Subtext answers must contain 1-5 question answers.", {
      code: "JAPANESE_SUBTEXT_ANSWERS_INVALID",
      status: 400
    });
  }
  const questionIds = new Set();
  const answers = input.answers.map((answer) => {
    assertExactObjectKeys(answer, ["questionId", "optionIds"], "JAPANESE_SUBTEXT_ANSWER_INVALID");
    const questionId = String(answer.questionId || "").trim();
    if (!/^q[1-5]$/.test(questionId) || questionIds.has(questionId)) {
      throw new SiteClientError("Japanese Subtext questionId values must be unique q1-q5 ids.", {
        code: "JAPANESE_SUBTEXT_QUESTION_ID_INVALID",
        status: 400
      });
    }
    questionIds.add(questionId);
    if (!Array.isArray(answer.optionIds) || answer.optionIds.length < 1 || answer.optionIds.length > 6) {
      throw new SiteClientError("Each Japanese Subtext answer must contain 1-6 optionIds.", {
        code: "JAPANESE_SUBTEXT_OPTION_IDS_INVALID",
        status: 400
      });
    }
    const optionIds = answer.optionIds.map((optionId) => String(optionId || "").trim());
    if (optionIds.some((optionId) => !/^[a-f]$/.test(optionId)) || new Set(optionIds).size !== optionIds.length) {
      throw new SiteClientError("Japanese Subtext optionIds must be unique a-f ids.", {
        code: "JAPANESE_SUBTEXT_OPTION_IDS_INVALID",
        status: 400
      });
    }
    return { questionId, optionIds };
  });
  const operationId = String(input.operationId || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/.test(operationId)) {
    throw new SiteClientError("A valid Japanese Subtext operationId is required.", {
      code: "JAPANESE_SUBTEXT_OPERATION_ID_INVALID",
      status: 400
    });
  }
  if (!Number.isSafeInteger(input.stageRevision)) {
    throw new SiteClientError("Japanese Subtext stageRevision must be an integer from 1 to 1000000.", {
      code: "JAPANESE_SUBTEXT_STAGE_REVISION_INVALID",
      status: 400
    });
  }
  if (!Number.isSafeInteger(input.expectedRevision)) {
    throw new SiteClientError("Japanese Subtext expectedRevision must be an integer from 1 to 1000000.", {
      code: "JAPANESE_SUBTEXT_EXPECTED_REVISION_INVALID",
      status: 400
    });
  }
  return {
    stageId: japaneseStageId(input.stageId),
    stageRevision: boundedInteger(
      input.stageRevision,
      1,
      1_000_000,
      "Japanese Subtext stageRevision must be an integer from 1 to 1000000.",
      "JAPANESE_SUBTEXT_STAGE_REVISION_INVALID"
    ),
    contentHash,
    answers,
    expectedRevision: boundedInteger(
      input.expectedRevision,
      1,
      1_000_000,
      "Japanese Subtext expectedRevision must be an integer from 1 to 1000000.",
      "JAPANESE_SUBTEXT_EXPECTED_REVISION_INVALID"
    ),
    operationId
  };
}

function assertExactObjectKeys(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SiteClientError("The Japanese Subtext attempt payload is invalid.", { code, status: 400 });
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new SiteClientError("The Japanese Subtext attempt payload contains missing or unknown fields.", {
      code,
      status: 400
    });
  }
}

function boundedInteger(value, min, max, message, code) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new SiteClientError(message, { code, status: 400 });
  }
  return number;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function toStringArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function randomIdempotencyKey() {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return id.replace(/[^A-Za-z0-9_-]/g, "_").padEnd(16, "0").slice(0, 100);
}

function needsFetchDuplex(body) {
  return !((typeof Blob !== "undefined" && body instanceof Blob)
    || body instanceof ArrayBuffer
    || ArrayBuffer.isView(body));
}

function bodyByteLength(body) {
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.size;
  return null;
}

function numberHeader(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function nonNegativeIntegerHeader(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function safePath(value) {
  try { return new URL(value, "https://example.invalid").pathname; } catch { return ""; }
}

async function resolveAccessToken(value) {
  const resolved = typeof value === "function" ? await value() : value;
  const token = String(resolved || "").trim();
  if (!token) return "";
  if (/\s/.test(token) || token.length > 4096) {
    throw new SiteClientError("The access token format is invalid.", { code: "AUTH_TOKEN_INVALID" });
  }
  return token;
}
