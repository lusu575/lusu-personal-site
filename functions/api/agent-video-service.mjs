const MAX_TITLE_CHARS = 220;
const MAX_DESCRIPTION_CHARS = 2_000;
const MAX_AUTHOR_CHARS = 160;
const MAX_URL_CHARS = 800;
const MAX_METADATA_ERROR_CHARS = 500;
const MAX_PROVIDER_JSON_BYTES = 256 * 1024;
const MAX_PROVIDER_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CATEGORY_IDS = 12;
const MAX_RECEIPT_RESPONSE_BYTES = 16 * 1024;
const MAX_HOSTED_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const VIDEO_STATUSES = new Set(["draft", "published", "hidden"]);
const VIDEO_PLATFORMS = new Set(["youtube", "bilibili"]);
const VIDEO_UPLOAD_MIME_TYPES = new Map([
  ["video/mp4", new Set([".mp4"])],
  ["video/webm", new Set([".webm"])]
]);
const THUMBNAIL_HOSTS = new Set([
  "i.ytimg.com",
  "img.youtube.com",
  "i0.hdslb.com",
  "i1.hdslb.com",
  "i2.hdslb.com",
  "archive.biliimg.com"
]);
const YOUTUBE_METADATA_HEADERS = Object.freeze({
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.7",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
});
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/;
const UPLOAD_SESSION_ID_PATTERN = /^vup_[A-Za-z0-9_-]{24,96}$/;
const DEVICE_PRINCIPAL_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/;
const OAUTH_GRANT_REF_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const PRINCIPAL_SCOPE_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export async function assertAgentVideoAccess({ env, principal: principalValue, requiredScope }) {
  const principal = normalizeAgentVideoPrincipal(principalValue);
  if (!principal.effectiveScopes.includes(requiredScope)) {
    throw new AgentVideoServiceError(
      `Agent access is missing required scope: ${requiredScope}.`,
      403,
      "AGENT_SCOPE_REQUIRED"
    );
  }
  const row = await env.DB.prepare(
    "select role from users where id = ? limit 1"
  ).bind(principal.userId).first();
  if (String(row?.role || "").toLowerCase() !== "admin") {
    throw new AgentVideoServiceError(
      "The Agent token is no longer backed by a site administrator account.",
      403,
      "AGENT_ADMIN_REQUIRED"
    );
  }
  return principal;
}

export async function ensureAgentVideoSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists agent_video_receipts (
        receipt_id text primary key,
        user_id text not null,
        operation_id text not null,
        action text not null,
        payload_hash text not null,
        video_id text not null default '',
        response_json text not null,
        created_at text not null,
        unique(user_id, operation_id)
      )
    `),
    env.DB.prepare(`
      create table if not exists video_upload_sessions (
        upload_session_id text primary key,
        user_id text not null references users(id) on delete cascade,
        operation_id text not null,
        payload_hash text not null,
        video_id text not null default '',
        filename text not null,
        mime_type text not null,
        size_bytes integer not null,
        sha256 text not null,
        upload_token_hash text not null default '',
        object_key text not null default '',
        r2_upload_id text not null default '',
        part_size_bytes integer not null default 0,
        expected_parts integer not null default 0,
        uploaded_bytes integer not null default 0,
        status text not null default 'pending',
        expires_at text not null,
        created_at text not null,
        updated_at text not null,
        completed_at text not null default '',
        aborted_at text not null default '',
        last_error text not null default '',
        unique(user_id, operation_id)
      )
    `),
    env.DB.prepare(`
      create index if not exists agent_video_receipts_created_idx
      on agent_video_receipts(created_at)
    `),
    env.DB.prepare(`
      create index if not exists video_upload_sessions_user_status_idx
      on video_upload_sessions(user_id, status, updated_at)
    `),
    env.DB.prepare(`
      create index if not exists video_upload_sessions_status_expires_idx
      on video_upload_sessions(status, expires_at)
    `)
  ]);
}

export async function listAgentVideosService({ env, principal: principalValue, query: queryValue = {} }) {
  await assertAgentVideoAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  const query = normalizeAgentVideoListQuery(queryValue);
  const rows = (await env.DB.prepare(`
    select *
    from videos
    where (? = '' or status = ?)
      and (? = '' or platform = ?)
    order by
      pinned desc,
      case when pinned = 1 then pinned_sort_order else sort_order end desc,
      case when pinned = 1 then sort_order else 0 end desc,
      updated_at desc,
      video_id desc
    limit ?
  `).bind(
    query.status,
    query.status,
    query.platform,
    query.platform,
    query.limit
  ).all()).results || [];
  const relations = await videoRelations(env, rows.map((row) => row.video_id));
  return agentVideoResult({
    videos: rows.map((row) => toManagedVideo(row, relations.get(row.video_id) || [])),
    limit: query.limit
  });
}

export async function getAgentVideoService({ env, principal: principalValue, videoId: videoIdValue }) {
  await assertAgentVideoAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  const videoId = normalizeVideoId(videoIdValue);
  const row = await readVideo(env, videoId);
  if (!row) throw videoNotFoundError();
  const relations = await videoRelations(env, [videoId]);
  return agentVideoResult({
    video: toManagedVideo(row, relations.get(videoId) || [])
  });
}

export async function createAgentVideoService({ env, principal: principalValue, payload: body }) {
  const principal = await assertAgentVideoAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  await ensureAgentVideoSchema(env);
  const receiptInput = normalizeCreateReceiptInput(body);
  const payloadHash = `v2:${await hashCanonicalPayload({
    action: "create",
    payload: receiptInput.payload
  })}`;
  const legacyPayload = legacyCreateReceiptPayload(receiptInput.payload);
  const compatiblePayloadHashes = legacyPayload
    ? [await hashCanonicalPayload({ action: "create", payload: legacyPayload })]
    : [];
  const existingReceipt = await readAgentVideoReceipt(env, principal.userId, receiptInput.operationId);
  if (existingReceipt) {
    return replayAgentVideoReceipt(existingReceipt, "create", payloadHash, compatiblePayloadHashes);
  }
  const payload = await normalizeCreatePayload(body, env);

  const videoId = crypto.randomUUID();
  const receiptId = crypto.randomUUID();
  const now = new Date().toISOString();
  const responsePayload = {
    ok: true,
    duplicate: false,
    videoId,
    platform: payload.platform,
    externalId: payload.externalId,
    status: payload.status,
    updatedAt: now
  };
  const statements = [
    env.DB.prepare(`
      insert into videos (
        video_id, platform, original_url, external_id, embed_url, title, description,
        thumbnail_url, author_name, published_at, status, sort_order, pinned,
        pinned_sort_order, metadata_error, created_at, updated_at
      )
      select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      where not exists (
        select 1 from videos where platform = ? and external_id = ?
      )
    `).bind(
      videoId,
      payload.platform,
      payload.originalUrl,
      payload.externalId,
      payload.embedUrl,
      payload.title,
      payload.description,
      payload.thumbnailUrl,
      payload.authorName,
      payload.publishedAt,
      payload.status,
      payload.sortOrder,
      payload.pinned ? 1 : 0,
      payload.pinnedSortOrder,
      payload.metadataError,
      now,
      now,
      payload.platform,
      payload.externalId
    ),
    ...videoCategoryRelationStatements(env, videoId, payload.categoryIds, {
      conditionSql: "exists (select 1 from videos where video_id = ?)",
      conditionBindings: [videoId],
      createdAt: now
    }),
    conditionalAgentVideoReceiptStatement(env, {
      receiptId,
      userId: principal.userId,
      operationId: payload.operationId,
      action: "create",
      payloadHash,
      videoId,
      responseJson: JSON.stringify(responsePayload),
      createdAt: now,
      conditionSql: "exists (select 1 from videos where video_id = ?)",
      conditionBindings: [videoId]
    }),
    conditionalAgentVideoAuditStatement(env, principal, {
      receiptId,
      action: "agent-video-created",
      videoId,
      result: "created",
      createdAt: now
    })
  ];

  let batchResults;
  try {
    batchResults = await env.DB.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
      if (racedReceipt) {
        return replayAgentVideoReceipt(racedReceipt, "create", payloadHash, compatiblePayloadHashes);
      }
    }
    throw error;
  }
  if (Number(batchResults?.[0]?.meta?.changes || 0) !== 1) {
    const racedReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
    if (racedReceipt) {
      return replayAgentVideoReceipt(racedReceipt, "create", payloadHash, compatiblePayloadHashes);
    }
    if (await findVideoByProvider(env, payload.platform, payload.externalId)) {
      throw videoDuplicateError();
    }
    throw new AgentVideoServiceError(
      "The video could not be created atomically.",
      409,
      "VIDEO_CREATE_CONFLICT"
    );
  }
  return agentVideoResult(responsePayload, 201);
}

export async function updateAgentVideoService({
  env,
  principal: principalValue,
  videoId: videoIdValue,
  payload: body
}) {
  const principal = await assertAgentVideoAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  await ensureAgentVideoSchema(env);
  const videoId = normalizeVideoId(videoIdValue);
  const operationId = normalizeOperationId(body?.operationId);
  const expectedUpdatedAt = normalizeTimestamp(body?.expectedUpdatedAt, false);
  const payloadHash = await hashCanonicalPayload({
    action: "update",
    videoId,
    payload: strictPayloadForHash(body, [
      "operationId", "expectedUpdatedAt", "originalUrl", "title", "description",
      "thumbnailUrl", "authorName", "publishedAt", "status", "sortOrder",
      "pinned", "pinnedSortOrder", "categoryIds"
    ])
  });
  const existingReceipt = await readAgentVideoReceipt(env, principal.userId, operationId);
  if (existingReceipt) {
    return replayAgentVideoReceipt(existingReceipt, "update", payloadHash);
  }
  const existing = await readVideo(env, videoId);
  if (!existing) throw videoNotFoundError();
  if (existing.updated_at !== expectedUpdatedAt) {
    throw videoContentConflictError(existing.updated_at);
  }
  const payload = await normalizeUpdatePayload(body, existing, env);
  const receiptId = crypto.randomUUID();
  const updatedAt = nextMutationTimestamp(existing.updated_at);
  const responsePayload = { ok: true, duplicate: false, videoId, updatedAt };
  const receiptCondition = `
    exists (
      select 1 from videos
      where video_id = ? and updated_at = ?
    )
    and not exists (
      select 1 from videos
      where platform = ? and external_id = ? and video_id <> ?
    )
  `;
  const statements = [
    conditionalAgentVideoReceiptStatement(env, {
      receiptId,
      userId: principal.userId,
      operationId: payload.operationId,
      action: "update",
      payloadHash,
      videoId,
      responseJson: JSON.stringify(responsePayload),
      createdAt: updatedAt,
      conditionSql: receiptCondition,
      conditionBindings: [
        videoId,
        payload.expectedUpdatedAt,
        payload.platform,
        payload.externalId,
        videoId
      ]
    })
  ];
  if (payload.categoryIds !== undefined) {
    statements.push(env.DB.prepare(`
      delete from video_category_relations
      where video_id = ?
        and exists (select 1 from agent_video_receipts where receipt_id = ?)
    `).bind(videoId, receiptId));
    statements.push(...videoCategoryRelationStatements(env, videoId, payload.categoryIds, {
      conditionSql: "exists (select 1 from agent_video_receipts where receipt_id = ?)",
      conditionBindings: [receiptId],
      createdAt: updatedAt
    }));
  }
  const updateIndex = statements.length;
  statements.push(
    env.DB.prepare(`
      update videos
      set platform = ?, original_url = ?, external_id = ?, embed_url = ?,
          title = ?, description = ?, thumbnail_url = ?, author_name = ?,
          published_at = ?, status = ?, sort_order = ?, pinned = ?,
          pinned_sort_order = ?, metadata_error = ?, updated_at = ?
      where video_id = ? and updated_at = ?
        and exists (select 1 from agent_video_receipts where receipt_id = ?)
    `).bind(
      payload.platform,
      payload.originalUrl,
      payload.externalId,
      payload.embedUrl,
      payload.title,
      payload.description,
      payload.thumbnailUrl,
      payload.authorName,
      payload.publishedAt,
      payload.status,
      payload.sortOrder,
      payload.pinned ? 1 : 0,
      payload.pinnedSortOrder,
      payload.metadataError,
      updatedAt,
      videoId,
      payload.expectedUpdatedAt,
      receiptId
    ),
    conditionalAgentVideoAuditStatement(env, principal, {
      receiptId,
      action: "agent-video-updated",
      videoId,
      result: "updated",
      createdAt: updatedAt
    })
  );

  let batchResults;
  try {
    batchResults = await env.DB.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
      if (racedReceipt) return replayAgentVideoReceipt(racedReceipt, "update", payloadHash);
    }
    throw error;
  }
  if (Number(batchResults?.[0]?.meta?.changes || 0) !== 1
    || Number(batchResults?.[updateIndex]?.meta?.changes || 0) !== 1) {
    const racedReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
    if (racedReceipt) return replayAgentVideoReceipt(racedReceipt, "update", payloadHash);
    const duplicate = await findVideoByProvider(env, payload.platform, payload.externalId);
    if (duplicate && duplicate.video_id !== videoId) throw videoDuplicateError();
    const current = await readVideo(env, videoId);
    if (!current) throw videoNotFoundError();
    throw videoContentConflictError(current.updated_at);
  }
  return agentVideoResult(responsePayload);
}

export async function deleteAgentVideoService({
  env,
  principal: principalValue,
  videoId: videoIdValue,
  payload: body
}) {
  const principal = await assertAgentVideoAccess({
    env,
    principal: principalValue,
    requiredScope: "content:delete"
  });
  await ensureAgentVideoSchema(env);
  const videoId = normalizeVideoId(videoIdValue);
  const payload = normalizeDeletePayload(body);
  const payloadHash = await hashCanonicalPayload({
    action: "delete",
    videoId,
    payload: deletePayloadForHash(payload)
  });
  const existingReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
  if (existingReceipt) return replayAgentVideoReceipt(existingReceipt, "delete", payloadHash);
  const existing = await readVideo(env, videoId);
  if (!existing) throw videoNotFoundError();
  if (existing.updated_at !== payload.expectedUpdatedAt) {
    throw videoContentConflictError(existing.updated_at);
  }
  const receiptId = crypto.randomUUID();
  const deletedAt = new Date().toISOString();
  const responsePayload = { ok: true, duplicate: false, videoId, deleted: true };
  const statements = [
    conditionalAgentVideoReceiptStatement(env, {
      receiptId,
      userId: principal.userId,
      operationId: payload.operationId,
      action: "delete",
      payloadHash,
      videoId,
      responseJson: JSON.stringify(responsePayload),
      createdAt: deletedAt,
      conditionSql: "exists (select 1 from videos where video_id = ? and updated_at = ?)",
      conditionBindings: [videoId, payload.expectedUpdatedAt]
    }),
    conditionalAgentVideoAuditStatement(env, principal, {
      receiptId,
      action: "agent-video-deleted",
      videoId,
      result: "deleted",
      createdAt: deletedAt
    }),
    env.DB.prepare(`
      delete from videos
      where video_id = ? and updated_at = ?
        and exists (select 1 from agent_video_receipts where receipt_id = ?)
    `).bind(videoId, payload.expectedUpdatedAt, receiptId)
  ];
  let batchResults;
  try {
    batchResults = await env.DB.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
      if (racedReceipt) return replayAgentVideoReceipt(racedReceipt, "delete", payloadHash);
    }
    throw error;
  }
  if (Number(batchResults?.[0]?.meta?.changes || 0) !== 1
    || Number(batchResults?.[2]?.meta?.changes || 0) < 1) {
    const racedReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
    if (racedReceipt) return replayAgentVideoReceipt(racedReceipt, "delete", payloadHash);
    const current = await readVideo(env, videoId);
    if (!current) throw videoNotFoundError();
    throw videoContentConflictError(current.updated_at);
  }
  return agentVideoResult(responsePayload);
}

export async function refreshAgentVideoService({
  env,
  principal: principalValue,
  videoId: videoIdValue,
  payload: body
}) {
  const principal = await assertAgentVideoAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  await ensureAgentVideoSchema(env);
  const videoId = normalizeVideoId(videoIdValue);
  const payload = normalizeRefreshPayload(body);
  const payloadHash = await hashCanonicalPayload({
    action: "refresh",
    videoId,
    payload: refreshPayloadForHash(payload)
  });
  const existingReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
  if (existingReceipt) return replayAgentVideoReceipt(existingReceipt, "refresh", payloadHash);
  const existing = await readVideo(env, videoId);
  if (!existing) throw videoNotFoundError();
  if (existing.updated_at !== payload.expectedUpdatedAt) {
    throw videoContentConflictError(existing.updated_at);
  }
  const parsed = await parseManagedVideoUrl(existing.original_url, env);
  const metadata = await fetchManagedVideoMetadata(parsed, env);
  const updatedAt = nextMutationTimestamp(existing.updated_at);
  const receiptId = crypto.randomUUID();
  const responsePayload = {
    ok: true,
    duplicate: false,
    videoId,
    updatedAt,
    metadataUpdated: metadata.metadataError === "",
    metadataError: metadata.metadataError
  };
  const statements = [
    conditionalAgentVideoReceiptStatement(env, {
      receiptId,
      userId: principal.userId,
      operationId: payload.operationId,
      action: "refresh",
      payloadHash,
      videoId,
      responseJson: JSON.stringify(responsePayload),
      createdAt: updatedAt,
      conditionSql: "exists (select 1 from videos where video_id = ? and updated_at = ?)",
      conditionBindings: [videoId, payload.expectedUpdatedAt]
    }),
    env.DB.prepare(`
      update videos
      set platform = ?, original_url = ?, external_id = ?, embed_url = ?,
          title = ?, description = ?, thumbnail_url = ?, author_name = ?,
          published_at = ?, metadata_error = ?, updated_at = ?
      where video_id = ? and updated_at = ?
        and exists (select 1 from agent_video_receipts where receipt_id = ?)
    `).bind(
      parsed.platform,
      parsed.originalUrl,
      parsed.externalId,
      parsed.embedUrl,
      metadata.title || existing.title,
      metadata.description || existing.description,
      metadata.thumbnailUrl || existing.thumbnail_url,
      metadata.authorName || existing.author_name,
      metadata.publishedAt || existing.published_at || null,
      metadata.metadataError,
      updatedAt,
      videoId,
      payload.expectedUpdatedAt,
      receiptId
    ),
    conditionalAgentVideoAuditStatement(env, principal, {
      receiptId,
      action: "agent-video-metadata-refreshed",
      videoId,
      result: metadata.metadataError ? "metadata-unavailable" : "refreshed",
      createdAt: updatedAt
    })
  ];
  let batchResults;
  try {
    batchResults = await env.DB.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
      if (racedReceipt) return replayAgentVideoReceipt(racedReceipt, "refresh", payloadHash);
    }
    throw error;
  }
  if (Number(batchResults?.[0]?.meta?.changes || 0) !== 1
    || Number(batchResults?.[1]?.meta?.changes || 0) !== 1) {
    const racedReceipt = await readAgentVideoReceipt(env, principal.userId, payload.operationId);
    if (racedReceipt) return replayAgentVideoReceipt(racedReceipt, "refresh", payloadHash);
    const current = await readVideo(env, videoId);
    if (!current) throw videoNotFoundError();
    throw videoContentConflictError(current.updated_at);
  }
  return agentVideoResult(responsePayload);
}

export async function beginAgentVideoUploadService({ env, principal: principalValue, payload }) {
  await assertAgentVideoAccess({ env, principal: principalValue, requiredScope: "content:write" });
  await ensureAgentVideoSchema(env);
  normalizeUploadBeginPayload(payload);
  throw uploadNotConfiguredError();
}

export async function getAgentVideoUploadService({ env, principal: principalValue, uploadSessionId }) {
  await assertAgentVideoAccess({ env, principal: principalValue, requiredScope: "content:write" });
  await ensureAgentVideoSchema(env);
  normalizeUploadSessionId(uploadSessionId);
  throw uploadNotConfiguredError();
}

export async function abortAgentVideoUploadService({
  env,
  principal: principalValue,
  uploadSessionId,
  payload
}) {
  await assertAgentVideoAccess({ env, principal: principalValue, requiredScope: "content:write" });
  await ensureAgentVideoSchema(env);
  normalizeUploadSessionId(uploadSessionId);
  assertStrictObject(payload, ["operationId", "confirm"], "VIDEO_UPLOAD_PAYLOAD_INVALID");
  normalizeOperationId(payload.operationId);
  if (payload.confirm !== true) {
    throw new AgentVideoServiceError(
      "Upload abort requires confirm=true.",
      400,
      "VIDEO_UPLOAD_ABORT_CONFIRMATION_REQUIRED"
    );
  }
  throw uploadNotConfiguredError();
}

export async function commitAgentVideoUploadService({
  env,
  principal: principalValue,
  uploadSessionId,
  payload
}) {
  await assertAgentVideoAccess({ env, principal: principalValue, requiredScope: "content:write" });
  await ensureAgentVideoSchema(env);
  normalizeUploadSessionId(uploadSessionId);
  assertStrictObject(payload, ["operationId"], "VIDEO_UPLOAD_PAYLOAD_INVALID");
  normalizeOperationId(payload.operationId);
  throw uploadNotConfiguredError();
}

function normalizeAgentVideoPrincipal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AgentVideoServiceError("Agent video principal is invalid.", 401, "AGENT_PRINCIPAL_INVALID");
  }
  const authType = String(value.authType || "").trim();
  const userId = String(value.userId || "").trim();
  const clientId = String(value.clientId || "").trim();
  const grantRef = String(value.grantRef || "").trim();
  const tokenRef = String(value.tokenRef || "").trim();
  const effectiveScopes = normalizedScopes(value.effectiveScopes);
  const agentTokenPrincipal = authType === "agent-token"
    && DEVICE_PRINCIPAL_REF_PATTERN.test(tokenRef)
    && !grantRef;
  const oauthPrincipal = authType === "oauth"
    && OAUTH_GRANT_REF_PATTERN.test(grantRef)
    && clientId
    && clientId.length <= 2_048
    && !tokenRef;
  if (!userId || userId.length > 128 || /[\u0000-\u001f\u007f]/.test(userId)
    || (!agentTokenPrincipal && !oauthPrincipal)
    || effectiveScopes.length > 32
    || effectiveScopes.some((scope) => !PRINCIPAL_SCOPE_PATTERN.test(scope))) {
    throw new AgentVideoServiceError("Agent video principal is invalid.", 401, "AGENT_PRINCIPAL_INVALID");
  }
  return { authType, userId, clientId, grantRef, tokenRef, effectiveScopes };
}

function principalAuditRef(principal) {
  return principal.authType === "oauth" ? `oauth:${principal.grantRef}` : principal.tokenRef;
}

function normalizeAgentVideoListQuery(value) {
  assertStrictObject(value, ["status", "platform", "limit"], "VIDEO_QUERY_INVALID");
  const status = String(value.status || "").trim();
  const platform = String(value.platform || "").trim().toLowerCase();
  if (status && !VIDEO_STATUSES.has(status)) {
    throw new AgentVideoServiceError("Video status filter is invalid.", 400, "VIDEO_QUERY_INVALID");
  }
  if (platform && !VIDEO_PLATFORMS.has(platform)) {
    throw new AgentVideoServiceError("Video platform filter is invalid.", 400, "VIDEO_QUERY_INVALID");
  }
  const limit = value.limit === undefined || value.limit === "" ? 50 : Number(value.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new AgentVideoServiceError(
      "Video list limit must be an integer from 1 to 200.",
      400,
      "VIDEO_QUERY_INVALID"
    );
  }
  return { status, platform, limit };
}

async function normalizeCreatePayload(body, env) {
  assertStrictObject(body, [
    "operationId", "originalUrl", "title", "description", "thumbnailUrl",
    "authorName", "publishedAt", "status", "sortOrder", "pinned",
    "pinnedSortOrder", "categoryIds"
  ]);
  const parsed = await parseManagedVideoUrl(body.originalUrl, env);
  const shouldFetchMetadata = [
    "title", "description", "thumbnailUrl", "authorName", "publishedAt"
  ].some((field) => !hasOwn(body, field));
  const metadata = shouldFetchMetadata
    ? await fetchManagedVideoMetadata(parsed, env)
    : emptyManagedVideoMetadata();
  const title = hasOwn(body, "title")
    ? normalizeBoundedString(body.title, MAX_TITLE_CHARS, {
        code: "VIDEO_TITLE_INVALID",
        message: "Video title is invalid."
      })
    : metadata.title;
  if (!title) {
    throw new AgentVideoServiceError(
      "Video title was not provided and could not be resolved from provider metadata.",
      502,
      "VIDEO_METADATA_TITLE_UNAVAILABLE"
    );
  }
  const pinned = !hasOwn(body, "pinned") ? false : normalizeBoolean(
    body.pinned,
    "Video pin setting is invalid.",
    "VIDEO_PIN_INVALID"
  );
  const defaultSortOrder = await nextVideoSortOrder(env);
  const defaultPinnedSortOrder = pinned ? await nextPinnedVideoSortOrder(env) : 0;
  return {
    operationId: normalizeOperationId(body.operationId),
    ...parsed,
    title,
    description: !hasOwn(body, "description")
      ? metadata.description
      : normalizeBoundedString(
        body.description,
        MAX_DESCRIPTION_CHARS,
        { allowEmpty: true, code: "VIDEO_DESCRIPTION_INVALID", message: "Video description is invalid." }
      ),
    thumbnailUrl: !hasOwn(body, "thumbnailUrl")
      ? (metadata.thumbnailUrl || defaultThumbnailUrl(parsed))
      : normalizeThumbnailUrl(body.thumbnailUrl, true),
    authorName: !hasOwn(body, "authorName")
      ? metadata.authorName
      : normalizeBoundedString(
        body.authorName,
        MAX_AUTHOR_CHARS,
        { allowEmpty: true, code: "VIDEO_AUTHOR_INVALID", message: "Video author is invalid." }
      ),
    publishedAt: !hasOwn(body, "publishedAt")
      ? metadata.publishedAt
      : normalizeTimestamp(body.publishedAt, true),
    status: !hasOwn(body, "status") ? "draft" : normalizeVideoStatus(body.status),
    sortOrder: !hasOwn(body, "sortOrder") ? defaultSortOrder : normalizeSortOrder(body.sortOrder),
    pinned,
    pinnedSortOrder: pinned
      ? (!hasOwn(body, "pinnedSortOrder")
        ? defaultPinnedSortOrder
        : normalizeSortOrder(body.pinnedSortOrder))
      : 0,
    metadataError: metadata.metadataError,
    categoryIds: await normalizeVideoCategoryIds(
      env,
      hasOwn(body, "categoryIds") ? body.categoryIds : []
    )
  };
}

function normalizeCreateReceiptInput(body) {
  assertStrictObject(body, [
    "operationId", "originalUrl", "title", "description", "thumbnailUrl",
    "authorName", "publishedAt", "status", "sortOrder", "pinned",
    "pinnedSortOrder", "categoryIds"
  ]);
  const operationId = normalizeOperationId(body.operationId);
  const originalUrl = normalizeBoundedString(body.originalUrl, MAX_URL_CHARS, {
    code: "VIDEO_URL_INVALID",
    message: "Video URL is invalid."
  });
  const pinned = !hasOwn(body, "pinned") ? false : normalizeBoolean(
    body.pinned,
    "Video pin setting is invalid.",
    "VIDEO_PIN_INVALID"
  );
  if (!pinned && hasOwn(body, "pinnedSortOrder")) {
    throw new AgentVideoServiceError(
      "pinnedSortOrder requires pinned=true.",
      400,
      "VIDEO_PINNED_SORT_INVALID"
    );
  }
  const payload = { originalUrl };
  if (hasOwn(body, "title")) {
    payload.title = normalizeBoundedString(body.title, MAX_TITLE_CHARS, {
      code: "VIDEO_TITLE_INVALID",
      message: "Video title is invalid."
    });
  }
  if (hasOwn(body, "description")) {
    payload.description = normalizeBoundedString(body.description, MAX_DESCRIPTION_CHARS, {
      allowEmpty: true,
      code: "VIDEO_DESCRIPTION_INVALID",
      message: "Video description is invalid."
    });
  }
  if (hasOwn(body, "thumbnailUrl")) {
    payload.thumbnailUrl = normalizeThumbnailUrl(body.thumbnailUrl, true);
  }
  if (hasOwn(body, "authorName")) {
    payload.authorName = normalizeBoundedString(body.authorName, MAX_AUTHOR_CHARS, {
      allowEmpty: true,
      code: "VIDEO_AUTHOR_INVALID",
      message: "Video author is invalid."
    });
  }
  if (hasOwn(body, "publishedAt")) {
    payload.publishedAt = normalizeTimestamp(body.publishedAt, true);
  }
  if (hasOwn(body, "status")) payload.status = normalizeVideoStatus(body.status);
  if (hasOwn(body, "sortOrder")) payload.sortOrder = normalizeSortOrder(body.sortOrder);
  if (hasOwn(body, "pinned")) payload.pinned = pinned;
  if (hasOwn(body, "pinnedSortOrder")) {
    payload.pinnedSortOrder = normalizeSortOrder(body.pinnedSortOrder);
  }
  if (hasOwn(body, "categoryIds")) {
    payload.categoryIds = body.categoryIds === null
      ? null
      : normalizeCategoryIdsShape(body.categoryIds);
  }
  return {
    operationId,
    payload
  };
}

function legacyCreateReceiptPayload(intentPayload) {
  if (!hasOwn(intentPayload, "title")) return null;
  return {
    originalUrl: intentPayload.originalUrl,
    title: intentPayload.title,
    description: hasOwn(intentPayload, "description") ? intentPayload.description : "",
    thumbnailUrl: hasOwn(intentPayload, "thumbnailUrl") ? intentPayload.thumbnailUrl : null,
    authorName: hasOwn(intentPayload, "authorName") ? intentPayload.authorName : "",
    publishedAt: hasOwn(intentPayload, "publishedAt") ? intentPayload.publishedAt : null,
    status: hasOwn(intentPayload, "status") ? intentPayload.status : "draft",
    sortOrder: hasOwn(intentPayload, "sortOrder") ? intentPayload.sortOrder : null,
    pinned: hasOwn(intentPayload, "pinned") ? intentPayload.pinned : false,
    pinnedSortOrder: hasOwn(intentPayload, "pinnedSortOrder") ? intentPayload.pinnedSortOrder : null,
    categoryIds: hasOwn(intentPayload, "categoryIds") && intentPayload.categoryIds !== null
      ? intentPayload.categoryIds
      : []
  };
}

async function normalizeUpdatePayload(body, existing, env) {
  assertStrictObject(body, [
    "operationId", "expectedUpdatedAt", "originalUrl", "title", "description",
    "thumbnailUrl", "authorName", "publishedAt", "status", "sortOrder",
    "pinned", "pinnedSortOrder", "categoryIds"
  ]);
  const changeKeys = Object.keys(body).filter((key) => !["operationId", "expectedUpdatedAt"].includes(key));
  if (!changeKeys.length) {
    throw new AgentVideoServiceError(
      "Video update must include at least one field change.",
      400,
      "VIDEO_UPDATE_EMPTY"
    );
  }
  const parsed = body.originalUrl === undefined
    ? {
        platform: existing.platform,
        originalUrl: existing.original_url,
        externalId: existing.external_id,
        embedUrl: existing.embed_url
      }
    : await parseManagedVideoUrl(body.originalUrl, env);
  const pinned = body.pinned === undefined
    ? Number(existing.pinned || 0) === 1
    : normalizeBoolean(body.pinned, "Video pin setting is invalid.", "VIDEO_PIN_INVALID");
  let pinnedSortOrder = 0;
  if (pinned) {
    if (body.pinnedSortOrder !== undefined) {
      pinnedSortOrder = normalizeSortOrder(body.pinnedSortOrder);
    } else if (Number(existing.pinned || 0) === 1) {
      pinnedSortOrder = Number(existing.pinned_sort_order || 0);
    } else {
      pinnedSortOrder = await nextPinnedVideoSortOrder(env);
    }
  } else if (body.pinnedSortOrder !== undefined) {
    throw new AgentVideoServiceError(
      "pinnedSortOrder requires pinned=true.",
      400,
      "VIDEO_PINNED_SORT_INVALID"
    );
  }
  return {
    operationId: normalizeOperationId(body.operationId),
    expectedUpdatedAt: normalizeTimestamp(body.expectedUpdatedAt, false),
    ...parsed,
    title: body.title === undefined ? existing.title : normalizeBoundedString(
      body.title,
      MAX_TITLE_CHARS,
      { code: "VIDEO_TITLE_INVALID", message: "Video title is invalid." }
    ),
    description: body.description === undefined ? (existing.description || "") : normalizeBoundedString(
      body.description,
      MAX_DESCRIPTION_CHARS,
      { allowEmpty: true, code: "VIDEO_DESCRIPTION_INVALID", message: "Video description is invalid." }
    ),
    thumbnailUrl: body.thumbnailUrl === undefined
      ? (existing.thumbnail_url || "")
      : normalizeThumbnailUrl(body.thumbnailUrl, true),
    authorName: body.authorName === undefined ? (existing.author_name || "") : normalizeBoundedString(
      body.authorName,
      MAX_AUTHOR_CHARS,
      { allowEmpty: true, code: "VIDEO_AUTHOR_INVALID", message: "Video author is invalid." }
    ),
    publishedAt: body.publishedAt === undefined
      ? (existing.published_at || null)
      : normalizeTimestamp(body.publishedAt, true),
    status: body.status === undefined ? existing.status : normalizeVideoStatus(body.status),
    sortOrder: body.sortOrder === undefined
      ? Number(existing.sort_order || 0)
      : normalizeSortOrder(body.sortOrder),
    pinned,
    pinnedSortOrder,
    metadataError: body.originalUrl === undefined ? (existing.metadata_error || "") : "",
    categoryIds: body.categoryIds === undefined
      ? undefined
      : await normalizeVideoCategoryIds(env, body.categoryIds)
  };
}

function normalizeDeletePayload(body) {
  assertStrictObject(body, ["operationId", "expectedUpdatedAt", "confirm"]);
  if (body.confirm !== true) {
    throw new AgentVideoServiceError(
      "Permanent video deletion requires confirm=true.",
      400,
      "VIDEO_DELETE_CONFIRMATION_REQUIRED"
    );
  }
  return {
    operationId: normalizeOperationId(body.operationId),
    expectedUpdatedAt: normalizeTimestamp(body.expectedUpdatedAt, false),
    confirm: true
  };
}

function normalizeRefreshPayload(body) {
  assertStrictObject(body, ["operationId", "expectedUpdatedAt"]);
  return {
    operationId: normalizeOperationId(body.operationId),
    expectedUpdatedAt: normalizeTimestamp(body.expectedUpdatedAt, false)
  };
}

function normalizeUploadBeginPayload(body) {
  assertStrictObject(body, [
    "operationId", "filename", "mimeType", "sizeBytes", "sha256", "title",
    "description", "thumbnailUrl", "authorName", "publishedAt", "status",
    "sortOrder", "pinned", "pinnedSortOrder", "categoryIds"
  ], "VIDEO_UPLOAD_PAYLOAD_INVALID");
  normalizeOperationId(body.operationId);
  const filename = normalizeBoundedString(body.filename, 180, {
    code: "VIDEO_UPLOAD_FILENAME_INVALID",
    message: "Upload filename is invalid."
  });
  if (filename === "." || filename === ".." || /[\\/:\u0000-\u001f\u007f]/.test(filename)) {
    throw new AgentVideoServiceError(
      "Upload filename must be a plain file name without a path.",
      400,
      "VIDEO_UPLOAD_FILENAME_INVALID"
    );
  }
  const mimeType = String(body.mimeType || "").trim().toLowerCase();
  const extensions = VIDEO_UPLOAD_MIME_TYPES.get(mimeType);
  const extension = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
  if (!extensions?.has(extension)) {
    throw new AgentVideoServiceError(
      "Hosted video uploads are limited to matching MP4 or WebM files.",
      400,
      "VIDEO_UPLOAD_MIME_INVALID"
    );
  }
  const sizeBytes = Number(body.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_HOSTED_VIDEO_BYTES) {
    throw new AgentVideoServiceError(
      "Hosted video size is outside the supported bound.",
      400,
      "VIDEO_UPLOAD_SIZE_INVALID"
    );
  }
  const sha256 = String(body.sha256 || "").trim().toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) {
    throw new AgentVideoServiceError(
      "Hosted video sha256 must be a lowercase 64-character digest.",
      400,
      "VIDEO_UPLOAD_SHA256_INVALID"
    );
  }
  normalizeBoundedString(body.title, MAX_TITLE_CHARS, {
    code: "VIDEO_TITLE_INVALID",
    message: "Video title is invalid."
  });
  if (body.description !== undefined) {
    normalizeBoundedString(body.description, MAX_DESCRIPTION_CHARS, {
      allowEmpty: true,
      code: "VIDEO_DESCRIPTION_INVALID",
      message: "Video description is invalid."
    });
  }
  if (body.thumbnailUrl !== undefined) normalizeThumbnailUrl(body.thumbnailUrl, true);
  if (body.authorName !== undefined) {
    normalizeBoundedString(body.authorName, MAX_AUTHOR_CHARS, {
      allowEmpty: true,
      code: "VIDEO_AUTHOR_INVALID",
      message: "Video author is invalid."
    });
  }
  if (body.publishedAt !== undefined) normalizeTimestamp(body.publishedAt, true);
  if (body.status !== undefined) normalizeVideoStatus(body.status);
  if (body.sortOrder !== undefined) normalizeSortOrder(body.sortOrder);
  if (body.pinned !== undefined) normalizeBoolean(body.pinned, "Video pin setting is invalid.", "VIDEO_PIN_INVALID");
  if (body.pinnedSortOrder !== undefined) normalizeSortOrder(body.pinnedSortOrder);
  if (body.categoryIds !== undefined && !Array.isArray(body.categoryIds)) {
    throw new AgentVideoServiceError(
      "Video category ids are invalid.",
      400,
      "VIDEO_CATEGORY_IDS_INVALID"
    );
  }
  return { filename, mimeType, sizeBytes, sha256 };
}

async function parseManagedVideoUrl(value, env) {
  if (typeof value !== "string") throw invalidVideoUrlError();
  const raw = value.trim();
  if (!raw || Array.from(raw).length > MAX_URL_CHARS) throw invalidVideoUrlError();
  if (/^BV[A-Za-z0-9]{10}$/.test(raw)) {
    return bilibiliParsed(raw, 1);
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw invalidVideoUrlError();
  }
  if (url.protocol !== "https:" || url.username || url.password) throw invalidVideoUrlError();
  const host = normalizedHost(url.hostname);
  if (host === "b23.tv") {
    return parseManagedVideoUrl(await resolveB23Url(url, env), env);
  }
  if (host === "youtu.be") {
    return youtubeParsed(cleanYoutubeId(url.pathname.split("/").filter(Boolean)[0]));
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") return youtubeParsed(cleanYoutubeId(url.searchParams.get("v")));
    const shorts = url.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shorts) return youtubeParsed(cleanYoutubeId(shorts[1]));
  }
  if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
    const bvid = cleanBilibiliBvid((url.pathname.match(/\/video\/(BV[A-Za-z0-9]{10})(?:\/|$)/) || [])[1]);
    if (!bvid) throw invalidVideoUrlError();
    return bilibiliParsed(bvid, normalizeBilibiliPage(url.searchParams.get("p") || url.searchParams.get("page")));
  }
  throw invalidVideoUrlError();
}

function youtubeParsed(videoId) {
  if (!videoId) throw invalidVideoUrlError();
  return {
    platform: "youtube",
    originalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    externalId: videoId,
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`
  };
}

function bilibiliParsed(bvid, page) {
  const safeBvid = cleanBilibiliBvid(bvid);
  if (!safeBvid) throw invalidVideoUrlError();
  const original = new URL(`/video/${safeBvid}`, "https://www.bilibili.com");
  if (page > 1) original.searchParams.set("p", String(page));
  return {
    platform: "bilibili",
    originalUrl: original.toString(),
    externalId: safeBvid,
    embedUrl: `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(safeBvid)}&page=${page}&high_quality=1&autoplay=0`
  };
}

async function resolveB23Url(initialUrl, env) {
  const fetchImpl = metadataFetch(env);
  let current = new URL(initialUrl);
  for (let redirects = 0; redirects < 3; redirects += 1) {
    if (current.protocol !== "https:" || current.username || current.password
      || normalizedHost(current.hostname) !== "b23.tv") {
      throw invalidVideoUrlError();
    }
    const response = await fetchWithTimeout(fetchImpl, current.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "text/html", "User-Agent": "LuSu-Agent-Video/1.0" }
    }, 4_500).catch(() => null);
    const location = response?.headers?.get?.("location") || "";
    if (!location) {
      throw new AgentVideoServiceError(
        "b23.tv short link could not be resolved. Use the full Bilibili URL.",
        400,
        "VIDEO_URL_INVALID"
      );
    }
    const next = new URL(location, current);
    if (next.protocol !== "https:" || next.username || next.password) throw invalidVideoUrlError();
    const nextHost = normalizedHost(next.hostname);
    if (nextHost === "b23.tv") {
      current = next;
      continue;
    }
    if (nextHost === "bilibili.com" || nextHost.endsWith(".bilibili.com")) {
      return next.toString();
    }
    throw invalidVideoUrlError();
  }
  throw invalidVideoUrlError();
}

async function fetchManagedVideoMetadata(parsed, env) {
  try {
    if (parsed.platform === "youtube") {
      return await fetchYoutubeMetadata(parsed, env);
    }
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(parsed.externalId)}`;
    const payload = await fetchProviderJson(metadataFetch(env), url, {
      headers: {
        Accept: "application/json",
        Referer: parsed.originalUrl,
        "User-Agent": "LuSu-Agent-Video/1.0"
      },
      redirect: "error"
    }, 6_000, MAX_PROVIDER_JSON_BYTES);
    if (Number(payload?.code || 0) !== 0 || !payload?.data) throw new Error("metadata unavailable");
    const data = payload.data;
    return {
      title: metadataText(data.title, MAX_TITLE_CHARS),
      description: metadataText(data.desc, MAX_DESCRIPTION_CHARS),
      thumbnailUrl: metadataThumbnailUrl(data.pic),
      authorName: metadataText(data.owner?.name, MAX_AUTHOR_CHARS),
      publishedAt: unixTimestamp(data.pubdate || data.ctime),
      metadataError: ""
    };
  } catch {
    return {
      title: "",
      description: "",
      thumbnailUrl: "",
      authorName: "",
      publishedAt: null,
      metadataError: `${parsed.platform === "youtube" ? "YouTube" : "Bilibili"} metadata refresh failed.`
        .slice(0, MAX_METADATA_ERROR_CHARS)
    };
  }
}

async function fetchYoutubeMetadata(parsed, env) {
  const fetchImpl = metadataFetch(env);
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.originalUrl)}&format=json`;
  const pageUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(parsed.externalId)}`;
  const [oembedResult, pageResult] = await Promise.allSettled([
    fetchProviderJson(fetchImpl, oembedUrl, {
      headers: { ...YOUTUBE_METADATA_HEADERS, Accept: "application/json" },
      redirect: "follow"
    }, 8_000, MAX_PROVIDER_JSON_BYTES),
    fetchYoutubePageMetadata(fetchImpl, pageUrl, parsed.externalId)
  ]);
  const oembed = oembedResult.status === "fulfilled" ? oembedResult.value : {};
  const page = pageResult.status === "fulfilled" ? pageResult.value : emptyManagedVideoMetadata();
  const title = metadataText(oembed?.title, MAX_TITLE_CHARS) || page.title;
  if (!title) throw new Error("metadata title unavailable");
  return {
    title,
    description: page.description,
    thumbnailUrl: metadataThumbnailUrl(oembed?.thumbnail_url) || page.thumbnailUrl,
    authorName: metadataText(oembed?.author_name, MAX_AUTHOR_CHARS) || page.authorName,
    publishedAt: page.publishedAt,
    metadataError: ""
  };
}

async function fetchYoutubePageMetadata(fetchImpl, pageUrl, expectedVideoId) {
  const html = await fetchProviderText(fetchImpl, pageUrl, {
    headers: YOUTUBE_METADATA_HEADERS,
    redirect: "follow"
  }, 8_000, MAX_PROVIDER_HTML_BYTES);
  if (youtubePageVideoId(html) !== expectedVideoId) {
    throw new Error("metadata page identity mismatch");
  }
  return {
    title: metadataText(
      htmlMetaContent(html, "og:title") || htmlJsonString(html, "title"),
      MAX_TITLE_CHARS
    ),
    description: metadataText(
      htmlMetaContent(html, "description") || htmlMetaContent(html, "og:description"),
      MAX_DESCRIPTION_CHARS
    ),
    thumbnailUrl: metadataThumbnailUrl(htmlMetaContent(html, "og:image")),
    authorName: metadataText(
      htmlJsonString(html, "ownerChannelName") || htmlJsonString(html, "author"),
      MAX_AUTHOR_CHARS
    ),
    publishedAt: providerTimestamp(
      htmlJsonString(html, "publishDate") || htmlJsonString(html, "uploadDate")
    ),
    metadataError: ""
  };
}

function emptyManagedVideoMetadata() {
  return {
    title: "",
    description: "",
    thumbnailUrl: "",
    authorName: "",
    publishedAt: null,
    metadataError: ""
  };
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function metadataFetch(env) {
  return typeof env?.VIDEO_METADATA_FETCH === "function"
    ? env.VIDEO_METADATA_FETCH
    : globalThis.fetch.bind(globalThis);
}

function metadataText(value, maxChars) {
  return Array.from(String(value || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim())
    .slice(0, maxChars)
    .join("");
}

function metadataThumbnailUrl(value) {
  const raw = String(value || "").trim().replace(/^http:\/\//i, "https://");
  try {
    return normalizeThumbnailUrl(raw.startsWith("//") ? `https:${raw}` : raw, true);
  } catch {
    return "";
  }
}

function unixTimestamp(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1_000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function defaultThumbnailUrl(parsed) {
  return parsed.platform === "youtube"
    ? `https://i.ytimg.com/vi/${encodeURIComponent(parsed.externalId)}/hqdefault.jpg`
    : "";
}

async function normalizeVideoCategoryIds(env, value) {
  const ids = normalizeCategoryIdsShape(value);
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = (await env.DB.prepare(`
    select category_id from video_categories where category_id in (${placeholders})
  `).bind(...ids).all()).results || [];
  const found = new Set(rows.map((row) => row.category_id));
  if (ids.some((id) => !found.has(id))) {
    throw new AgentVideoServiceError(
      "A selected video category does not exist.",
      400,
      "VIDEO_CATEGORY_NOT_FOUND"
    );
  }
  return ids;
}

function normalizeCategoryIdsShape(value) {
  if (!Array.isArray(value) || value.length > MAX_CATEGORY_IDS) {
    throw new AgentVideoServiceError(
      "Video category ids are invalid.",
      400,
      "VIDEO_CATEGORY_IDS_INVALID"
    );
  }
  const ids = [...new Set(value.map((item) => normalizeVideoId(item)))];
  if (ids.length !== value.length) {
    throw new AgentVideoServiceError(
      "Video category ids must not contain duplicates.",
      400,
      "VIDEO_CATEGORY_IDS_INVALID"
    );
  }
  return ids;
}

async function videoRelations(env, videoIds) {
  const result = new Map(videoIds.map((videoId) => [videoId, []]));
  if (!videoIds.length) return result;
  const placeholders = videoIds.map(() => "?").join(", ");
  const rows = (await env.DB.prepare(`
    select
      video_category_relations.video_id,
      video_categories.category_id,
      video_categories.slug,
      video_categories.name_zh,
      video_categories.name_en,
      video_categories.name_ja,
      video_categories.sort_order,
      video_categories.enabled
    from video_category_relations
    join video_categories on video_categories.category_id = video_category_relations.category_id
    where video_category_relations.video_id in (${placeholders})
    order by video_category_relations.sort_order asc, video_categories.sort_order desc
  `).bind(...videoIds).all()).results || [];
  for (const row of rows) {
    const categories = result.get(row.video_id) || [];
    categories.push({
      categoryId: row.category_id,
      slug: row.slug,
      nameZh: row.name_zh,
      nameEn: row.name_en || "",
      nameJa: row.name_ja || "",
      sortOrder: Number(row.sort_order || 0),
      enabled: Number(row.enabled || 0) === 1
    });
    result.set(row.video_id, categories);
  }
  return result;
}

function videoCategoryRelationStatements(env, videoId, categoryIds, options) {
  return categoryIds.map((categoryId, index) => env.DB.prepare(`
    insert into video_category_relations (video_id, category_id, sort_order, created_at)
    select ?, ?, ?, ?
    where ${options.conditionSql}
    on conflict(video_id, category_id) do update set sort_order = excluded.sort_order
  `).bind(
    videoId,
    categoryId,
    index,
    options.createdAt,
    ...options.conditionBindings
  ));
}

function conditionalAgentVideoReceiptStatement(env, receipt) {
  return env.DB.prepare(`
    insert into agent_video_receipts (
      receipt_id, user_id, operation_id, action, payload_hash,
      video_id, response_json, created_at
    )
    select ?, ?, ?, ?, ?, ?, ?, ?
    where ${receipt.conditionSql}
  `).bind(
    receipt.receiptId,
    receipt.userId,
    receipt.operationId,
    receipt.action,
    receipt.payloadHash,
    receipt.videoId,
    receipt.responseJson,
    receipt.createdAt,
    ...receipt.conditionBindings
  );
}

function conditionalAgentVideoAuditStatement(env, principal, event) {
  return env.DB.prepare(`
    insert into agent_audit_log (
      event_id, actor_user_id, token_id, action, target_type, target_id,
      scopes, result, created_at
    )
    select ?, ?, ?, ?, 'video', ?, ?, ?, ?
    where exists (select 1 from agent_video_receipts where receipt_id = ?)
  `).bind(
    crypto.randomUUID(),
    principal.userId,
    principalAuditRef(principal),
    event.action,
    event.videoId,
    JSON.stringify(principal.effectiveScopes),
    event.result,
    event.createdAt,
    event.receiptId
  );
}

async function readAgentVideoReceipt(env, userId, operationId) {
  return env.DB.prepare(`
    select action, payload_hash, video_id, response_json
    from agent_video_receipts
    where user_id = ? and operation_id = ?
    limit 1
  `).bind(userId, operationId).first();
}

function replayAgentVideoReceipt(receipt, action, payloadHash, compatiblePayloadHashes = []) {
  const storedPayloadHash = String(receipt.payload_hash || "");
  const hashMatches = storedPayloadHash === payloadHash
    || (SHA256_PATTERN.test(storedPayloadHash)
      && compatiblePayloadHashes.includes(storedPayloadHash));
  if (receipt.action !== action || !hashMatches) {
    throw new AgentVideoServiceError(
      "operationId was already used for a different video action or payload.",
      409,
      "VIDEO_OPERATION_CONFLICT"
    );
  }
  const responseText = String(receipt.response_json || "");
  if (new TextEncoder().encode(responseText).byteLength > MAX_RECEIPT_RESPONSE_BYTES) {
    throw invalidReceiptError();
  }
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw invalidReceiptError();
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || payload.videoId !== receipt.video_id) {
    throw invalidReceiptError();
  }
  return agentVideoResult({ ...payload, duplicate: true });
}

async function readVideo(env, videoId) {
  return env.DB.prepare("select * from videos where video_id = ? limit 1")
    .bind(videoId)
    .first();
}

async function findVideoByProvider(env, platform, externalId) {
  return env.DB.prepare(`
    select video_id, updated_at
    from videos
    where platform = ? and external_id = ?
    limit 1
  `).bind(platform, externalId).first();
}

async function nextVideoSortOrder(env) {
  const row = await env.DB.prepare("select coalesce(max(sort_order), 0) as max_sort from videos").first();
  return Number(row?.max_sort || 0) + 10;
}

async function nextPinnedVideoSortOrder(env) {
  const row = await env.DB.prepare(
    "select coalesce(max(pinned_sort_order), 0) as max_sort from videos where pinned = 1"
  ).first();
  return Number(row?.max_sort || 0) + 10;
}

function toManagedVideo(row, categories) {
  return {
    videoId: row.video_id,
    platform: row.platform,
    originalUrl: row.original_url || "",
    externalId: row.external_id,
    embedUrl: row.embed_url,
    title: row.title || "",
    description: row.description || "",
    thumbnailUrl: row.thumbnail_url || "",
    authorName: row.author_name || "",
    publishedAt: row.published_at || null,
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    pinned: Number(row.pinned || 0) === 1,
    pinnedSortOrder: Number(row.pinned_sort_order || 0),
    metadataError: row.metadata_error || "",
    categoryIds: categories.map((category) => category.categoryId),
    categories,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeOperationId(value) {
  if (typeof value !== "string" || !OPERATION_ID_PATTERN.test(value)) {
    throw new AgentVideoServiceError(
      "operationId must contain 8 to 80 safe characters.",
      400,
      "VIDEO_OPERATION_ID_INVALID"
    );
  }
  return value;
}

function normalizeVideoId(value) {
  const videoId = String(value || "").trim();
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    throw new AgentVideoServiceError("Video id is invalid.", 400, "VIDEO_ID_INVALID");
  }
  return videoId;
}

function normalizeUploadSessionId(value) {
  const uploadSessionId = String(value || "").trim();
  if (!UPLOAD_SESSION_ID_PATTERN.test(uploadSessionId)) {
    throw new AgentVideoServiceError(
      "Video upload session id is invalid.",
      400,
      "VIDEO_UPLOAD_SESSION_ID_INVALID"
    );
  }
  return uploadSessionId;
}

function normalizeVideoStatus(value) {
  const status = String(value || "").trim();
  if (!VIDEO_STATUSES.has(status)) {
    throw new AgentVideoServiceError(
      "Video status must be draft, published, or hidden.",
      400,
      "VIDEO_STATUS_INVALID"
    );
  }
  return status;
}

function normalizeSortOrder(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < -1_000_000_000 || number > 1_000_000_000) {
    throw new AgentVideoServiceError(
      "Video sort order is invalid.",
      400,
      "VIDEO_SORT_ORDER_INVALID"
    );
  }
  return number;
}

function normalizeBoolean(value, message, code) {
  if (typeof value !== "boolean") throw new AgentVideoServiceError(message, 400, code);
  return value;
}

function normalizeBoundedString(value, maxChars, options = {}) {
  if (typeof value !== "string") throw new AgentVideoServiceError(options.message, 400, options.code);
  const text = value.trim();
  if ((!options.allowEmpty && !text) || Array.from(text).length > maxChars
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new AgentVideoServiceError(options.message, 400, options.code);
  }
  return text;
}

function normalizeTimestamp(value, allowNull) {
  if (allowNull && value === null) return null;
  if (typeof value !== "string") throw timestampError();
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/
  );
  if (!match || !validDateTimeParts(match)) throw timestampError();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw timestampError();
  return new Date(timestamp).toISOString();
}

function validDateTimeParts(match) {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  const offsetHour = Number(match[10] || 0);
  const offsetMinute = Number(match[11] || 0);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  if (offsetHour > 23 || offsetMinute > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function timestampError() {
  return new AgentVideoServiceError(
    "Video timestamp must be an ISO date-time with a timezone.",
    400,
    "VIDEO_TIMESTAMP_INVALID"
  );
}

function normalizeThumbnailUrl(value, allowEmpty) {
  if (typeof value !== "string") {
    throw new AgentVideoServiceError("Video thumbnail URL is invalid.", 400, "VIDEO_THUMBNAIL_URL_INVALID");
  }
  const raw = value.trim();
  if (!raw && allowEmpty) return "";
  if (!raw || Array.from(raw).length > MAX_URL_CHARS || /^data:/i.test(raw)) {
    throw new AgentVideoServiceError("Video thumbnail URL is invalid.", 400, "VIDEO_THUMBNAIL_URL_INVALID");
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new AgentVideoServiceError("Video thumbnail URL is invalid.", 400, "VIDEO_THUMBNAIL_URL_INVALID");
  }
  const host = normalizedHost(url.hostname);
  if (url.protocol !== "https:" || url.username || url.password || !THUMBNAIL_HOSTS.has(host)) {
    throw new AgentVideoServiceError(
      "Video thumbnail must use an approved YouTube or Bilibili image host.",
      400,
      "VIDEO_THUMBNAIL_URL_INVALID"
    );
  }
  url.hash = "";
  return url.toString();
}

function cleanYoutubeId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
}

function cleanBilibiliBvid(value) {
  const id = String(value || "").trim();
  return /^BV[A-Za-z0-9]{10}$/.test(id) ? id : "";
}

function normalizeBilibiliPage(value) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page >= 1 && page <= 99 ? page : 1;
}

function normalizedHost(value) {
  return String(value || "").toLowerCase().replace(/^www\./, "");
}

async function fetchProviderJson(fetchImpl, url, options, timeoutMs, maxBytes) {
  const text = await fetchProviderText(fetchImpl, url, options, timeoutMs, maxBytes);
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function fetchProviderText(fetchImpl, url, options, timeoutMs, maxBytes) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel?.("metadata response rejected");
      throw new Error("metadata unavailable");
    }
    const declaredLength = Number(response.headers?.get?.("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      await response.body?.cancel?.("metadata response too large");
      throw new Error("metadata response too large");
    }
    const reader = response.body?.getReader?.();
    if (!reader) throw new Error("metadata response body unavailable");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let size = 0;
    let text = "";
    let streamFinished = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamFinished = true;
          break;
        }
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel("metadata response too large");
          streamFinished = true;
          throw new Error("metadata response too large");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return text;
    } finally {
      if (!streamFinished) {
        try {
          await reader.cancel("metadata response interrupted");
        } catch {
          // Preserve the original read/decode error.
        }
      }
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timeout);
  }
}

function htmlMetaContent(html, expectedKey) {
  const key = String(expectedKey || "").toLowerCase();
  for (const match of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const declaredKey = htmlAttribute(tag, "property")
      || htmlAttribute(tag, "name")
      || htmlAttribute(tag, "itemprop");
    if (declaredKey.toLowerCase() !== key) continue;
    return decodeHtmlText(htmlAttribute(tag, "content"));
  }
  return "";
}

function htmlLinkHref(html, expectedRel) {
  const rel = String(expectedRel || "").toLowerCase();
  for (const match of String(html || "").matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const declaredRel = htmlAttribute(tag, "rel").toLowerCase().split(/\s+/);
    if (!declaredRel.includes(rel)) continue;
    return decodeHtmlText(htmlAttribute(tag, "href"));
  }
  return "";
}

function htmlAttribute(tag, name) {
  const match = String(tag || "").match(new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  ));
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function htmlJsonString(html, key) {
  const escapedKey = String(key || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html || "").match(new RegExp(
    `"${escapedKey}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`,
    "i"
  ));
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return "";
  }
}

function youtubePageVideoId(html) {
  const declaredUrl = htmlMetaContent(html, "og:url") || htmlLinkHref(html, "canonical");
  try {
    const url = new URL(declaredUrl);
    const host = normalizedHost(url.hostname);
    if (url.protocol !== "https:" || url.username || url.password
      || (host !== "youtube.com" && host !== "m.youtube.com")
      || url.pathname !== "/watch") {
      return "";
    }
    return cleanYoutubeId(url.searchParams.get("v"));
  } catch {
    return "";
  }
}

function decodeHtmlText(value) {
  return String(value || "").replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|quot|apos|lt|gt|amp);/gi,
    (entity, decimal, hexadecimal) => {
      if (decimal !== undefined) return decodeHtmlCodePoint(entity, decimal, 10);
      if (hexadecimal !== undefined) return decodeHtmlCodePoint(entity, hexadecimal, 16);
      switch (entity.toLowerCase()) {
        case "&quot;": return '"';
        case "&apos;": return "'";
        case "&lt;": return "<";
        case "&gt;": return ">";
        case "&amp;": return "&";
        default: return entity;
      }
    }
  );
}

function decodeHtmlCodePoint(entity, value, radix) {
  const codePoint = Number.parseInt(String(value || ""), radix);
  if (!Number.isInteger(codePoint)
    || codePoint < 0
    || codePoint > 0x10ffff
    || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
    return entity;
  }
  return String.fromCodePoint(codePoint);
}

function providerTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertStrictObject(value, allowedFields, code = "VIDEO_PAYLOAD_INVALID") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AgentVideoServiceError("Video payload is invalid.", 400, code);
  }
  const allowed = new Set(allowedFields);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new AgentVideoServiceError("Video payload contains unknown fields.", 400, code);
  }
}

function strictPayloadForHash(body, fields) {
  assertStrictObject(body, fields);
  normalizeOperationId(body.operationId);
  if (!Object.keys(body).some((key) => !["operationId", "expectedUpdatedAt"].includes(key))) {
    throw new AgentVideoServiceError(
      "Video update must include at least one field change.",
      400,
      "VIDEO_UPDATE_EMPTY"
    );
  }
  const payload = normalizeRawUpdateFields(body);
  return payload;
}

function normalizeRawUpdateFields(body) {
  const normalized = { expectedUpdatedAt: normalizeTimestamp(body.expectedUpdatedAt, false) };
  if (body.originalUrl !== undefined) {
    normalized.originalUrl = normalizeBoundedString(body.originalUrl, MAX_URL_CHARS, {
      code: "VIDEO_URL_INVALID",
      message: "Video URL is invalid."
    });
  }
  if (body.title !== undefined) {
    normalized.title = normalizeBoundedString(body.title, MAX_TITLE_CHARS, {
      code: "VIDEO_TITLE_INVALID",
      message: "Video title is invalid."
    });
  }
  if (body.description !== undefined) {
    normalized.description = normalizeBoundedString(body.description, MAX_DESCRIPTION_CHARS, {
      allowEmpty: true,
      code: "VIDEO_DESCRIPTION_INVALID",
      message: "Video description is invalid."
    });
  }
  if (body.thumbnailUrl !== undefined) normalized.thumbnailUrl = normalizeThumbnailUrl(body.thumbnailUrl, true);
  if (body.authorName !== undefined) {
    normalized.authorName = normalizeBoundedString(body.authorName, MAX_AUTHOR_CHARS, {
      allowEmpty: true,
      code: "VIDEO_AUTHOR_INVALID",
      message: "Video author is invalid."
    });
  }
  if (body.publishedAt !== undefined) normalized.publishedAt = normalizeTimestamp(body.publishedAt, true);
  if (body.status !== undefined) normalized.status = normalizeVideoStatus(body.status);
  if (body.sortOrder !== undefined) normalized.sortOrder = normalizeSortOrder(body.sortOrder);
  if (body.pinned !== undefined) {
    normalized.pinned = normalizeBoolean(body.pinned, "Video pin setting is invalid.", "VIDEO_PIN_INVALID");
  }
  if (body.pinnedSortOrder !== undefined) normalized.pinnedSortOrder = normalizeSortOrder(body.pinnedSortOrder);
  if (body.categoryIds !== undefined) normalized.categoryIds = normalizeCategoryIdsShape(body.categoryIds);
  return normalized;
}

function deletePayloadForHash(payload) {
  return { expectedUpdatedAt: payload.expectedUpdatedAt, confirm: payload.confirm };
}

function refreshPayloadForHash(payload) {
  return { expectedUpdatedAt: payload.expectedUpdatedAt };
}

async function hashCanonicalPayload(value) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function nextMutationTimestamp(previousTimestamp) {
  const previous = Date.parse(previousTimestamp);
  const timestamp = Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0);
  return new Date(timestamp).toISOString();
}

function normalizedScopes(scopes) {
  return [...new Set((scopes || []).map((scope) => String(scope)))].sort();
}

function isUniqueConstraintError(error) {
  return /(?:unique|constraint failed)/i.test(error instanceof Error ? error.message : String(error || ""));
}

function invalidVideoUrlError() {
  return new AgentVideoServiceError(
    "Only canonical HTTPS YouTube or Bilibili video URLs are supported.",
    400,
    "VIDEO_URL_INVALID"
  );
}

function videoNotFoundError() {
  return new AgentVideoServiceError("Video was not found.", 404, "VIDEO_NOT_FOUND");
}

function videoDuplicateError() {
  return new AgentVideoServiceError(
    "This YouTube or Bilibili video already exists.",
    409,
    "VIDEO_DUPLICATE"
  );
}

function videoContentConflictError(updatedAt) {
  return new AgentVideoServiceError(
    "Video changed after it was read.",
    409,
    "CONTENT_CONFLICT",
    { updatedAt: updatedAt || null }
  );
}

function invalidReceiptError() {
  return new AgentVideoServiceError(
    "Stored Agent video receipt is invalid.",
    500,
    "AGENT_VIDEO_RECEIPT_INVALID"
  );
}

function uploadNotConfiguredError() {
  return new AgentVideoServiceError(
    "Hosted video upload is not configured. No R2 upload session was created.",
    503,
    "VIDEO_UPLOAD_NOT_CONFIGURED",
    { uploadAvailable: false }
  );
}

function agentVideoResult(payload, status = 200) {
  return { status, payload };
}

export class AgentVideoServiceError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = "AgentVideoServiceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
