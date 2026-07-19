const SESSION_COOKIE = "lusu_session";
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const TIB = 1024 * GIB;
const TRANSFER_PREFIX = "transfer/";
const ROOM_KEY_PATTERN = /^transfer_[A-Za-z0-9_-]{43}$/;
const ACTIVE_UPLOAD_STATUSES = ["uploading", "ready", "delete_failed"];
const MULTIPART_ACTIVE_STATUSES = ["active", "completing"];
const MAX_JSON_BYTES = 64 * 1024;
const MAX_FILENAME_CHARS = 180;
const MAX_MIME_CHARS = 120;
const MAX_ITEMS_PAGE = 100;
const MAX_ADMIN_PAGE = 200;
const DEFAULTS = Object.freeze({
  normalMaxFileBytes: 95 * MIB,
  normalUser24hBytes: 300 * MIB,
  normalUserDailyFiles: 30,
  normalUserInitPerMinute: 3,
  normalUserConcurrentUploads: 1,
  normalRoomActiveBytes: 1 * GIB,
  normalRoomActiveItems: 100,
  normalPoolActiveBytes: 8 * GIB,
  normalPoolClassABudget: 700000,
  normalPoolClassBBudget: 7000000,
  normalPoolStorageGbMonth: 8,
  normalPoolYellowRatio: 0.75,
  normalPoolRedRatio: 1,
  retentionHours: 24,
  textMaxChars: 10000,
  textPerMinute: 20,
  globalUploadEnabled: 1,
  normalUploadEnabled: 1,
  alertThresholds: "1,3,5",
  adminMaxObjectBytes: 5 * TIB - 5 * GIB,
  adminMaxParts: 10000,
  adminMinPartBytes: 5 * MIB,
  adminMaxPartBytes: 95 * MIB,
  uploadSessionHours: 6
});

const SETTING_DEFINITIONS = Object.freeze({
  normal_max_file_bytes: ["normalMaxFileBytes", 1 * MIB, 95 * MIB, "TRANSFER_MAX_FILE_BYTES"],
  normal_user_24h_bytes: ["normalUser24hBytes", 1 * MIB, 8 * GIB, "TRANSFER_USER_24H_BYTES"],
  normal_user_daily_files: ["normalUserDailyFiles", 1, 1000, "TRANSFER_USER_DAILY_FILES"],
  normal_user_init_per_minute: ["normalUserInitPerMinute", 1, 120, "TRANSFER_USER_INIT_PER_MINUTE"],
  normal_user_concurrent_uploads: ["normalUserConcurrentUploads", 1, 8, "TRANSFER_USER_CONCURRENT_UPLOADS"],
  normal_room_active_bytes: ["normalRoomActiveBytes", 1 * MIB, 8 * GIB, "TRANSFER_ROOM_ACTIVE_BYTES"],
  normal_room_active_items: ["normalRoomActiveItems", 1, 1000, "TRANSFER_ROOM_ACTIVE_ITEMS"],
  normal_pool_active_bytes: ["normalPoolActiveBytes", 1 * GIB, 9 * GIB, "TRANSFER_NORMAL_POOL_ACTIVE_BYTES"],
  normal_pool_class_a_budget: ["normalPoolClassABudget", 1000, 900000, "TRANSFER_NORMAL_POOL_CLASS_A_BUDGET"],
  normal_pool_class_b_budget: ["normalPoolClassBBudget", 1000, 9000000, "TRANSFER_NORMAL_POOL_CLASS_B_BUDGET"],
  normal_pool_storage_gb_month: ["normalPoolStorageGbMonth", 1, 9, "TRANSFER_NORMAL_POOL_STORAGE_GB_MONTH"],
  normal_pool_yellow_ratio: ["normalPoolYellowRatio", 0.25, 0.95, "TRANSFER_NORMAL_POOL_YELLOW_RATIO"],
  normal_pool_red_ratio: ["normalPoolRedRatio", 0.5, 1, "TRANSFER_NORMAL_POOL_RED_RATIO"],
  retention_hours: ["retentionHours", 1, 24, "TRANSFER_RETENTION_HOURS"],
  text_max_chars: ["textMaxChars", 100, 10000, "TRANSFER_TEXT_MAX_CHARS"],
  text_per_minute: ["textPerMinute", 1, 120, "TRANSFER_TEXT_PER_MINUTE"],
  global_upload_enabled: ["globalUploadEnabled", 0, 1, ""],
  normal_upload_enabled: ["normalUploadEnabled", 0, 1, ""]
});

const SAFE_INLINE_MIME_PREFIXES = ["image/", "video/", "audio/"];
const SAFE_INLINE_MIME_TYPES = new Set(["application/pdf", "text/plain"]);
const DANGEROUS_MIME_TYPES = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "application/x-sh",
  "application/x-msdownload",
  "application/x-executable"
]);

let transferSchemaReady = false;

export async function handleTransferApi(context, parts) {
  const isPublicTransfer = parts[0] === "transfer";
  const isAdminTransfer = parts[0] === "admin" && parts[1] === "transfer";
  if (!isPublicTransfer && !isAdminTransfer) {
    return null;
  }

  try {
    assertBindings(context.env, { requireBucket: routeNeedsBucket(context.request, parts) });
    await ensureTransferSchema(context.env);
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
      assertSameOrigin(context.request);
    }
    return isAdminTransfer
      ? await handleAdminTransferApi(context, parts.slice(2))
      : await handleUserTransferApi(context, parts.slice(1));
  } catch (error) {
    const status = error instanceof TransferHttpError ? error.status : 500;
    const code = error instanceof TransferHttpError ? error.code : "TRANSFER_INTERNAL_ERROR";
    if (status >= 500) {
      console.error(JSON.stringify({
        message: "transfer api failed",
        code,
        path: new URL(context.request.url).pathname,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
    return transferJson({
      error: status >= 500 ? "临时互传服务暂时不可用，请稍后重试。" : error.message,
      code
    }, status);
  }
}

async function handleUserTransferApi(context, parts) {
  const { request, env } = context;
  const session = await requireTransferSession(request, env);
  const url = new URL(request.url);

  if (request.method === "GET" && parts[0] === "config" && !parts[1]) {
    return transferJson(await publicTransferConfig(env, session));
  }
  if (request.method === "POST" && parts[0] === "room" && parts[1] === "join") {
    const body = await readBoundedJson(request);
    const room = await joinTransferRoom(env, normalizeRoomKey(body.roomKey), session.user.id);
    return transferJson({ room: publicRoom(room) });
  }
  if (request.method === "GET" && parts[0] === "room" && parts[1] === "items") {
    const roomKey = normalizeRoomKey(url.searchParams.get("room"));
    const cursor = normalizeCursor(url.searchParams.get("cursor") || url.searchParams.get("after"));
    const limit = clampInteger(url.searchParams.get("limit"), 1, MAX_ITEMS_PAGE, 100);
    return transferJson(await listRoomItems(env, session, roomKey, cursor, limit));
  }
  if (request.method === "POST" && parts[0] === "text" && !parts[1]) {
    const body = await readBoundedJson(request);
    const item = await createTransferText(env, session, body);
    return transferJson({ item: publicItem(item, normalizeRoomKey(body.roomKey), session) }, 201);
  }
  if (request.method === "POST" && parts[0] === "upload" && parts[1] === "simple") {
    const item = await uploadSimpleObject(context, session);
    return transferJson({ item: publicItem(item, item.room_key, session) }, 201);
  }
  if (request.method === "POST" && parts[0] === "upload" && parts[1] === "init") {
    const body = await readBoundedJson(request);
    const result = await initializeMultipartUpload(context, session, body);
    return transferJson(result, 201);
  }
  if (request.method === "PUT" && parts[0] === "upload" && parts[1] === "part") {
    return transferJson(await uploadMultipartPart(context, session));
  }
  if (request.method === "GET" && parts[0] === "upload" && parts[1] === "status") {
    return transferJson(await getMultipartStatus(env, session, url.searchParams));
  }
  if (request.method === "POST" && parts[0] === "upload" && parts[1] === "complete") {
    const body = await readBoundedJson(request);
    return transferJson(await completeMultipartUpload(context, session, body));
  }
  if (request.method === "POST" && parts[0] === "upload" && parts[1] === "abort") {
    const body = await readBoundedJson(request);
    return transferJson(await abortMultipartUpload(env, session, body.sessionId, body.roomKey));
  }
  if ((request.method === "GET" || request.method === "HEAD") && parts[0] === "file" && parts[1]) {
    return await downloadTransferFile(context, session, parts[1]);
  }
  if (request.method === "DELETE" && parts[0] === "item" && parts[1]) {
    const roomKey = normalizeRoomKey(url.searchParams.get("room"));
    await deleteTransferItem(env, session, parts[1], roomKey);
    return transferJson({ ok: true });
  }
  throw new TransferHttpError("未找到临时互传接口。", 404, "TRANSFER_NOT_FOUND");
}

async function handleAdminTransferApi(context, parts) {
  const { request, env } = context;
  const session = await requireTransferAdmin(request, env);
  const url = new URL(request.url);

  if (request.method === "GET" && parts[0] === "overview") {
    return transferJson(await adminOverview(env));
  }
  if (request.method === "GET" && parts[0] === "rooms") {
    return transferJson({ rooms: await adminRooms(env, url.searchParams) });
  }
  if (request.method === "GET" && parts[0] === "items") {
    const result = await adminItems(env, url.searchParams);
    return transferJson({ items: result.items, pagination: result.pagination });
  }
  if (request.method === "GET" && parts[0] === "uploads") {
    return transferJson({ uploads: await adminUploads(env, url.searchParams) });
  }
  if (request.method === "GET" && parts[0] === "usage") {
    return transferJson(await usageSummary(env));
  }
  if (request.method === "GET" && parts[0] === "alerts") {
    const rows = await env.DB.prepare("select * from transfer_alerts order by created_at desc limit 100").all();
    return transferJson({ alerts: rows.results || [], notification: notificationStatus(env) });
  }
  if (request.method === "GET" && parts[0] === "settings") {
    return transferJson({ settings: await loadTransferSettings(env) });
  }
  if (request.method === "PUT" && parts[0] === "settings") {
    const body = await readBoundedJson(request);
    const settings = await updateTransferSettings(env, session, body);
    return transferJson({ settings });
  }
  if (request.method === "POST" && parts[0] === "upload" && parts[1] === "abort") {
    const body = await readBoundedJson(request);
    return transferJson(await abortMultipartUpload(env, session, body.sessionId, body.roomKey, true));
  }
  if (request.method === "DELETE" && parts[0] === "item" && parts[1]) {
    await adminDeleteTransferItem(env, session, parts[1]);
    return transferJson({ ok: true });
  }
  if (request.method === "POST" && parts[0] === "room" && parts[1] && parts[2] === "clear") {
    return transferJson(await adminClearRoom(env, session, parts[1]));
  }
  if (request.method === "POST" && parts[0] === "room" && parts[1] && parts[2] === "close") {
    return transferJson(await adminCloseRoom(env, session, parts[1]));
  }
  if (request.method === "POST" && parts[0] === "normal-upload-switch") {
    const body = await readBoundedJson(request);
    await setBooleanSetting(env, "normal_upload_enabled", body.enabled, session.user.id);
    return transferJson({ ok: true, enabled: Boolean(body.enabled) });
  }
  if (request.method === "POST" && parts[0] === "global-upload-switch") {
    const body = await readBoundedJson(request);
    await setBooleanSetting(env, "global_upload_enabled", body.enabled, session.user.id);
    return transferJson({ ok: true, enabled: Boolean(body.enabled) });
  }
  if (request.method === "POST" && parts[0] === "cleanup") {
    const body = await readBoundedJson(request).catch(() => ({}));
    return transferJson(await runTransferCleanup(env, {
      actorUserId: session.user.id,
      reconcile: body.reconcile === true,
      limit: clampInteger(body.limit, 1, 500, 100)
    }));
  }
  if (request.method === "POST" && parts[0] === "alert" && parts[1] === "test") {
    return transferJson(await createTestAlert(env, session.user.id));
  }
  throw new TransferHttpError("未找到临时互传管理接口。", 404, "TRANSFER_ADMIN_NOT_FOUND");
}

async function publicTransferConfig(env, session) {
  const settings = await loadTransferSettings(env);
  const usage = await usageSummary(env, settings);
  const userUsage = await userUsage24h(env, session.user.id);
  return {
    user: { role: session.user.role, isAdmin: session.user.role === "admin" },
    r2Ready: Boolean(env.TRANSFER_BUCKET),
    retentionHours: settings.retentionHours,
    textMaxChars: settings.textMaxChars,
    normal: {
      maxFileBytes: settings.normalMaxFileBytes,
      user24hBytes: settings.normalUser24hBytes,
      userDailyFiles: settings.normalUserDailyFiles,
      roomActiveBytes: settings.normalRoomActiveBytes,
      roomActiveItems: settings.normalRoomActiveItems,
      used24hBytes: userUsage.uploadedBytes,
      completed24hFiles: userUsage.completedFiles,
      remaining24hBytes: Math.max(0, settings.normalUser24hBytes - userUsage.uploadedBytes),
      poolStatus: usage.normalPool.status,
      poolActiveBytes: usage.normalPool.activeBytes,
      poolActiveLimitBytes: settings.normalPoolActiveBytes
    },
    admin: {
      multipartAllowed: session.user.role === "admin",
      maxObjectBytes: settings.adminMaxObjectBytes,
      maxParts: settings.adminMaxParts,
      minPartBytes: settings.adminMinPartBytes,
      maxRequestPartBytes: settings.adminMaxPartBytes,
      recommendedPartBytes: 32 * MIB,
      desktopConcurrency: 4,
      mobileConcurrency: 2
    },
    security: {
      textClientEncrypted: true,
      filesEndToEndEncrypted: false,
      privateBucket: true,
      virusScanning: false
    }
  };
}

async function joinTransferRoom(env, roomKey, userId) {
  const now = nowIso();
  await env.DB.prepare(`
    insert into transfer_rooms (id, room_key, created_by, status, created_at, last_activity_at)
    values (?, ?, ?, 'open', ?, ?)
    on conflict(room_key) do update set last_activity_at = excluded.last_activity_at
  `).bind(crypto.randomUUID(), roomKey, userId, now, now).run();
  const room = await env.DB.prepare("select * from transfer_rooms where room_key = ?").bind(roomKey).first();
  if (!room || room.status !== "open") {
    throw new TransferHttpError("这个互传房间已经关闭。", 423, "TRANSFER_ROOM_CLOSED");
  }
  return room;
}

async function listRoomItems(env, session, roomKey, cursor, limit) {
  const room = await activeRoomByKey(env, roomKey);
  const now = nowIso();
  const generation = Number(room.sync_generation || 0);
  if (cursor.generation !== null && cursor.generation !== generation) {
    return {
      room: publicRoom(room), items: [], nextCursor: "", hasMore: false,
      resetRequired: true, resetReason: "items-removed"
    };
  }
  if (cursor.validUntil && cursor.validUntil <= now) {
    return {
      room: publicRoom(room), items: [], nextCursor: "", hasMore: false,
      resetRequired: true, resetReason: "items-expired"
    };
  }
  const rows = await env.DB.prepare(`
    select i.*, u.email as uploader_email
    from transfer_items i
    join users u on u.id = i.uploader_user_id
    where i.room_id = ? and i.upload_status = 'ready' and i.expires_at > ?
      and (? = '' or i.created_at > ? or (i.created_at = ? and i.id > ?))
    order by i.created_at asc, i.id asc
    limit ?
  `).bind(room.id, now, cursor.at, cursor.at, cursor.at, cursor.id, limit + 1).all();
  const pageRows = (rows.results || []).slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  const expiry = await env.DB.prepare(`
    select min(expires_at) as valid_until from transfer_items
    where room_id = ? and upload_status = 'ready' and expires_at > ?
  `).bind(room.id, now).first();
  return {
    room: publicRoom(room),
    items: pageRows.map((item) => publicItem(item, roomKey, session)),
    nextCursor: encodeCursor({
      at: last?.created_at || cursor.at,
      id: last?.id || cursor.id,
      generation,
      validUntil: expiry?.valid_until || ""
    }),
    hasMore: (rows.results || []).length > limit,
    resetRequired: false,
    syncMode: cursor.at ? "incremental" : "initial"
  };
}

async function createTransferText(env, session, body) {
  const settings = await loadTransferSettings(env);
  const roomKey = normalizeRoomKey(body.roomKey);
  const room = await activeRoomByKey(env, roomKey);
  const encryptedContent = normalizeEncryptedText(body.encryptedContent, settings.textMaxChars);
  const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);
  const existing = await findIdempotentItem(env, session.user.id, idempotencyKey);
  if (existing) {
    assertIdempotentItem(existing, room.id, "text");
    return { ...existing, room_key: roomKey };
  }
  const since = new Date(Date.now() - 60000).toISOString();
  const recent = await env.DB.prepare(`
    select count(*) as count from transfer_items
    where uploader_user_id = ? and item_type = 'text' and created_at >= ?
  `).bind(session.user.id, since).first();
  if (session.user.role !== "admin" && Number(recent?.count || 0) >= settings.textPerMinute) {
    throw new TransferHttpError("文字发送过于频繁，请稍后再试。", 429, "TRANSFER_TEXT_RATE_LIMIT");
  }
  const itemCount = await activeRoomItemCount(env, room.id);
  if (session.user.role !== "admin" && itemCount >= settings.normalRoomActiveItems) {
    throw new TransferHttpError("房间当前内容数量已满，请等待旧内容过期。", 409, "TRANSFER_ROOM_ITEM_LIMIT");
  }
  const now = nowIso();
  const expiresAt = addHoursIso(settings.retentionHours);
  const item = {
    id: crypto.randomUUID(),
    room_id: room.id,
    uploader_user_id: session.user.id,
    uploader_role_snapshot: session.user.role,
    item_type: "text",
    encrypted: 1,
    text_ciphertext: encryptedContent,
    created_at: now,
    completed_at: now,
    expires_at: expiresAt
  };
  try {
    await env.DB.prepare(`
      insert into transfer_items (
        id, room_id, uploader_user_id, uploader_role_snapshot, item_type, encrypted,
        text_ciphertext, upload_mode, upload_status, created_at, completed_at, expires_at, idempotency_key
      ) values (?, ?, ?, ?, 'text', 1, ?, 'text', 'ready', ?, ?, ?, ?)
    `).bind(
      item.id, item.room_id, item.uploader_user_id, item.uploader_role_snapshot,
      item.text_ciphertext, now, now, expiresAt, idempotencyKey
    ).run();
  } catch (error) {
    const replay = await findIdempotentItem(env, session.user.id, idempotencyKey);
    if (!replay) throw error;
    assertIdempotentItem(replay, room.id, "text");
    return { ...replay, room_key: roomKey };
  }
  await touchRoom(env, room.id, now);
  return { ...item, room_key: roomKey, size_bytes: 0, mime_type: "text/plain" };
}

async function uploadSimpleObject(context, session) {
  const { request, env } = context;
  if (!request.body) {
    throw new TransferHttpError("没有收到文件内容。", 400, "TRANSFER_EMPTY_UPLOAD");
  }
  const url = new URL(request.url);
  const settings = await loadTransferSettings(env);
  const roomKey = normalizeRoomKey(url.searchParams.get("room"));
  const filename = normalizeFilename(url.searchParams.get("filename"));
  const mimeType = normalizeMimeType(url.searchParams.get("mime") || request.headers.get("Content-Type"));
  const declaredSize = normalizeUploadLength(request, url.searchParams.get("size"));
  const room = await activeRoomByKey(env, roomKey);
  const idempotencyKey = normalizeIdempotencyKey(request.headers.get("Idempotency-Key"));
  let existing = await findIdempotentItem(env, session.user.id, idempotencyKey);
  if (existing) {
    assertIdempotentItem(existing, room.id, itemTypeFromMime(mimeType));
    if (existing.display_filename !== filename || Number(existing.size_bytes) !== declaredSize || existing.mime_type !== mimeType) {
      throw new TransferHttpError("幂等键对应的上传文件不一致。", 409, "TRANSFER_IDEMPOTENCY_KEY_REUSED");
    }
    if (existing.upload_status === "ready") return { ...existing, room_key: roomKey };
    if (existing.upload_status === "failed") {
      await discardFailedIdempotentItem(env, existing);
      existing = null;
    }
  }
  if (existing) {
    throw new TransferHttpError("相同上传仍在处理，请稍后刷新。", 409, "TRANSFER_REQUEST_IN_PROGRESS");
  }
  await assertUploadAllowed(env, session, room, declaredSize, settings, { simple: true });

  const now = nowIso();
  const itemId = crypto.randomUUID();
  const objectKey = objectKeyFor(itemId, now);
  const expiresAt = addHoursIso(settings.retentionHours);
  try {
    await reserveSimpleUpload(env, session, room, {
      itemId, objectKey, filename, mimeType, declaredSize, now, expiresAt, idempotencyKey
    }, settings);
  } catch (error) {
    const replay = await findIdempotentItem(env, session.user.id, idempotencyKey);
    if (!replay) throw error;
    assertIdempotentItem(replay, room.id, itemTypeFromMime(mimeType));
    if (replay.upload_status === "ready") return { ...replay, room_key: roomKey };
    throw new TransferHttpError("相同上传仍在处理，请稍后刷新。", 409, "TRANSFER_REQUEST_IN_PROGRESS");
  }
  await refreshDailyStoragePeaks(env);

  let object;
  try {
    object = await env.TRANSFER_BUCKET.put(objectKey, request.body, {
      httpMetadata: {
        contentType: mimeType,
        contentDisposition: contentDisposition(filename, false)
      },
      customMetadata: { transferItemId: itemId }
    });
    await recordR2Operations(env, { classA: 1 });
    const head = object || await env.TRANSFER_BUCKET.head(objectKey);
    if (!object) {
      await recordR2Operations(env, { classB: 1 });
    }
    if (!head || Number(head.size) !== declaredSize) {
      await env.TRANSFER_BUCKET.delete(objectKey);
      throw new TransferHttpError("上传后的文件大小校验失败，请重试。", 422, "TRANSFER_SIZE_MISMATCH");
    }
    const completeAt = nowIso();
    await env.DB.prepare(`
      update transfer_items set upload_status = 'ready', size_bytes = ?, etag = ?, completed_at = ?, expires_at = ?
      where id = ? and upload_status = 'uploading'
    `).bind(declaredSize, head.etag || "", completeAt, addHoursIso(settings.retentionHours), itemId).run();
    await recordCompletedUpload(env, session, declaredSize);
    await touchRoom(env, room.id, completeAt);
    scheduleAlerts(context);
  } catch (error) {
    await env.DB.prepare("update transfer_items set upload_status = 'failed', last_error = ? where id = ?")
      .bind(safeErrorCode(error), itemId).run();
    if (!(error instanceof TransferHttpError && error.code === "TRANSFER_SIZE_MISMATCH")) {
      try {
        await env.TRANSFER_BUCKET.delete(objectKey);
      } catch {
        // Lifecycle and the cleanup worker remain the final orphan-object fallback.
      }
    }
    throw error;
  }

  const item = await env.DB.prepare(`
    select i.*, r.room_key from transfer_items i join transfer_rooms r on r.id = i.room_id where i.id = ?
  `).bind(itemId).first();
  return item;
}

async function reserveSimpleUpload(env, session, room, upload, settings) {
  if (session.user.role === "admin") {
    await env.DB.prepare(`
      insert into transfer_items (
        id, room_id, uploader_user_id, uploader_role_snapshot, item_type, original_filename,
        display_filename, r2_object_key, mime_type, size_bytes, upload_mode, upload_status,
        created_at, expires_at, idempotency_key
      ) values (?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, 'simple', 'uploading', ?, ?, ?)
    `).bind(
      upload.itemId, room.id, session.user.id, itemTypeFromMime(upload.mimeType),
      upload.filename, upload.filename, upload.objectKey, upload.mimeType, upload.declaredSize,
      upload.now, upload.expiresAt, upload.idempotencyKey
    ).run();
    return;
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = dateKey();
  const recentMinute = new Date(Date.now() - 60000).toISOString();
  const result = await env.DB.prepare(`
    insert into transfer_items (
      id, room_id, uploader_user_id, uploader_role_snapshot, item_type, original_filename,
      display_filename, r2_object_key, mime_type, size_bytes, upload_mode, upload_status,
      created_at, expires_at, idempotency_key
    )
    select ?, ?, ?, 'user', ?, ?, ?, ?, ?, ?, 'simple', 'uploading', ?, ?, ?
    where
      (select count(*) from transfer_items where uploader_user_id = ? and upload_status = 'uploading') < ?
      and (select count(*) from transfer_items where uploader_user_id = ? and created_at >= ?) < ?
      and (select coalesce(sum(size_bytes), 0) from transfer_audit_log where actor_user_id = ? and action = 'upload_completed' and created_at >= ?) + ? <= ?
      and (select coalesce(sum(completed_files), 0) from transfer_usage_daily where user_id = ? and usage_date = ?) < ?
      and (select coalesce(sum(size_bytes), 0) from transfer_items where room_id = ? and uploader_role_snapshot <> 'admin' and upload_status in ('uploading','ready','delete_failed') and expires_at > ?) + ? <= ?
      and (select count(*) from transfer_items where room_id = ? and upload_status in ('uploading','ready','delete_failed') and expires_at > ?) < ?
      and (select coalesce(sum(size_bytes), 0) from transfer_items where uploader_role_snapshot <> 'admin' and upload_status in ('uploading','ready','delete_failed') and expires_at > ?) + ? <= ?
  `).bind(
    upload.itemId, room.id, session.user.id, itemTypeFromMime(upload.mimeType), upload.filename,
    upload.filename, upload.objectKey, upload.mimeType, upload.declaredSize, upload.now, upload.expiresAt, upload.idempotencyKey,
    session.user.id, settings.normalUserConcurrentUploads,
    session.user.id, recentMinute, settings.normalUserInitPerMinute,
    session.user.id, since24h, upload.declaredSize, settings.normalUser24hBytes,
    session.user.id, today, settings.normalUserDailyFiles,
    room.id, nowIso(), upload.declaredSize, settings.normalRoomActiveBytes,
    room.id, nowIso(), settings.normalRoomActiveItems,
    nowIso(), upload.declaredSize, settings.normalPoolActiveBytes
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    throw new TransferHttpError("普通账号的上传额度、频率或全站免费池已达到限制。", 429, "TRANSFER_NORMAL_QUOTA_EXCEEDED");
  }
}

async function initializeMultipartUpload(context, session, body) {
  const { env } = context;
  if (session.user.role !== "admin") {
    throw new TransferHttpError("只有管理员可以初始化大文件分片上传。", 403, "TRANSFER_MULTIPART_ADMIN_ONLY");
  }
  const settings = await loadTransferSettings(env);
  if (!settings.globalUploadEnabled) {
    throw new TransferHttpError("全部文件上传已由管理员暂停。", 503, "TRANSFER_UPLOADS_PAUSED");
  }
  const roomKey = normalizeRoomKey(body.roomKey);
  const room = await activeRoomByKey(env, roomKey);
  const filename = normalizeFilename(body.filename);
  const mimeType = normalizeMimeType(body.mimeType);
  const declaredSize = integerInRange(body.sizeBytes, 1, settings.adminMaxObjectBytes, "文件大小超出 R2 平台边界。", "TRANSFER_ADMIN_FILE_LIMIT");
  const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);
  let existing = await findIdempotentMultipart(env, session.user.id, idempotencyKey);
  if (existing) {
    assertIdempotentItem(existing, room.id, itemTypeFromMime(mimeType));
    if (Number(existing.declared_size_bytes) !== declaredSize || existing.filename !== filename) {
      throw new TransferHttpError("幂等键对应的上传文件不一致。", 409, "TRANSFER_IDEMPOTENCY_KEY_REUSED");
    }
    if (["active", "completing", "completed"].includes(existing.session_status)) {
      return publicMultipartInitialization(existing, true);
    }
    await discardFailedIdempotentItem(env, existing);
    existing = null;
  }
  const partSize = choosePartSize(declaredSize, body.partSizeBytes, settings);
  const expectedParts = Math.ceil(declaredSize / partSize);
  if (expectedParts > settings.adminMaxParts) {
    throw new TransferHttpError("分片数量超过 R2 上限。", 413, "TRANSFER_TOO_MANY_PARTS");
  }
  const now = nowIso();
  const sessionId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const objectKey = objectKeyFor(itemId, now);
  const multipart = await env.TRANSFER_BUCKET.createMultipartUpload(objectKey, {
    httpMetadata: {
      contentType: mimeType,
      contentDisposition: contentDisposition(filename, false)
    },
    customMetadata: { transferItemId: itemId }
  });
  await recordR2Operations(env, { classA: 1 });
  const expiresAt = addHoursIso(settings.uploadSessionHours);
  try {
    await env.DB.batch([
      env.DB.prepare(`
        insert into transfer_items (
          id, room_id, uploader_user_id, uploader_role_snapshot, item_type, original_filename,
          display_filename, r2_object_key, mime_type, size_bytes, upload_mode, upload_status,
          created_at, expires_at, idempotency_key
        ) values (?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, 'multipart', 'uploading', ?, ?, ?)
      `).bind(
        itemId, room.id, session.user.id, itemTypeFromMime(mimeType), filename, filename,
        objectKey, mimeType, declaredSize, now, expiresAt, idempotencyKey
      ),
      env.DB.prepare(`
        insert into transfer_upload_sessions (
          id, item_id, room_id, user_id, user_role_snapshot, object_key, r2_upload_id,
          filename, mime_type, declared_size_bytes, part_size_bytes, expected_parts,
          status, created_at, updated_at, expires_at
        ) values (?, ?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).bind(
        sessionId, itemId, room.id, session.user.id, objectKey, multipart.uploadId,
        filename, mimeType, declaredSize, partSize, expectedParts, now, now, expiresAt
      )
    ]);
  } catch (error) {
    try {
      await multipart.abort();
    } catch {
      // R2's default incomplete multipart lifecycle is the final fallback.
    }
    const replay = await findIdempotentMultipart(env, session.user.id, idempotencyKey);
    if (replay) {
      assertIdempotentItem(replay, room.id, itemTypeFromMime(mimeType));
      return publicMultipartInitialization(replay, true);
    }
    throw error;
  }
  await refreshDailyStoragePeaks(env);
  scheduleAlerts(context);
  return {
    sessionId,
    itemId,
    partSizeBytes: partSize,
    expectedParts,
    expiresAt,
    maxParallelParts: 4,
    idempotentReplay: false
  };
}

async function findIdempotentMultipart(env, userId, key) {
  if (!key) return null;
  return env.DB.prepare(`
    select i.*, s.id as session_id, s.filename, s.r2_upload_id, s.declared_size_bytes, s.part_size_bytes,
      s.expected_parts, s.expires_at as session_expires_at, s.status as session_status
    from transfer_items i join transfer_upload_sessions s on s.item_id = i.id
    where i.uploader_user_id = ? and i.idempotency_key = ? limit 1
  `).bind(userId, key).first();
}

async function discardFailedIdempotentItem(env, item) {
  if (item.r2_upload_id && item.r2_object_key) {
    try { await env.TRANSFER_BUCKET?.resumeMultipartUpload(item.r2_object_key, item.r2_upload_id).abort(); } catch { /* lifecycle remains the fallback */ }
  }
  if (item.r2_object_key) {
    try { await env.TRANSFER_BUCKET?.delete(item.r2_object_key); } catch { /* cleanup remains the fallback */ }
  }
  await env.DB.prepare("delete from transfer_items where id = ? and upload_status <> 'ready'").bind(item.id).run();
}

function publicMultipartInitialization(row, idempotentReplay) {
  return {
    sessionId: row.session_id,
    itemId: row.id,
    partSizeBytes: Number(row.part_size_bytes),
    expectedParts: Number(row.expected_parts),
    expiresAt: row.session_expires_at,
    maxParallelParts: 4,
    idempotentReplay
  };
}

async function uploadMultipartPart(context, session) {
  const { request, env } = context;
  if (session.user.role !== "admin") {
    throw new TransferHttpError("普通账号不能上传大文件分片。", 403, "TRANSFER_MULTIPART_ADMIN_ONLY");
  }
  if (!request.body) {
    throw new TransferHttpError("没有收到分片内容。", 400, "TRANSFER_EMPTY_PART");
  }
  const url = new URL(request.url);
  const sessionId = normalizeId(url.searchParams.get("session"), "上传任务编号无效。", "TRANSFER_SESSION_INVALID");
  const roomKey = normalizeRoomKey(url.searchParams.get("room"));
  const partNumber = integerInRange(url.searchParams.get("part"), 1, DEFAULTS.adminMaxParts, "分片编号无效。", "TRANSFER_PART_INVALID");
  const row = await ownedUploadSession(env, session, sessionId, roomKey, false);
  const expectedLength = expectedPartLength(row, partNumber);
  const actualLength = normalizeUploadLength(request, url.searchParams.get("size"));
  if (actualLength !== expectedLength) {
    throw new TransferHttpError("分片长度与上传任务不一致。", 422, "TRANSFER_PART_SIZE_MISMATCH");
  }
  const existing = await env.DB.prepare(`
    select etag, size_bytes from transfer_upload_parts where upload_session_id = ? and part_number = ?
  `).bind(sessionId, partNumber).first();
  if (existing && Number(existing.size_bytes) === actualLength && url.searchParams.get("force") !== "1") {
    return { partNumber, etag: existing.etag, sizeBytes: Number(existing.size_bytes), reused: true };
  }
  const multipart = env.TRANSFER_BUCKET.resumeMultipartUpload(row.object_key, row.r2_upload_id);
  const uploaded = await multipart.uploadPart(partNumber, request.body);
  await recordR2Operations(env, { classA: 1 });
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      insert into transfer_upload_parts (upload_session_id, part_number, etag, size_bytes, completed_at)
      values (?, ?, ?, ?, ?)
      on conflict(upload_session_id, part_number) do update set
        etag = excluded.etag, size_bytes = excluded.size_bytes, completed_at = excluded.completed_at
    `).bind(sessionId, partNumber, uploaded.etag, actualLength, now),
    env.DB.prepare("update transfer_upload_sessions set updated_at = ? where id = ?")
      .bind(now, sessionId)
  ]);
  return { partNumber, etag: uploaded.etag, sizeBytes: actualLength, reused: false };
}

async function getMultipartStatus(env, session, params) {
  const sessionId = normalizeId(params.get("session"), "上传任务编号无效。", "TRANSFER_SESSION_INVALID");
  const roomKey = normalizeRoomKey(params.get("room"));
  const row = await ownedUploadSession(env, session, sessionId, roomKey, false);
  const parts = await env.DB.prepare(`
    select part_number, etag, size_bytes, completed_at
    from transfer_upload_parts where upload_session_id = ? order by part_number asc
  `).bind(sessionId).all();
  return {
    sessionId,
    status: row.status,
    filename: row.filename,
    sizeBytes: Number(row.declared_size_bytes),
    partSizeBytes: Number(row.part_size_bytes),
    expectedParts: Number(row.expected_parts),
    expiresAt: row.expires_at,
    parts: (parts.results || []).map((part) => ({
      partNumber: Number(part.part_number),
      etag: part.etag,
      sizeBytes: Number(part.size_bytes),
      completedAt: part.completed_at
    }))
  };
}

async function completeMultipartUpload(context, session, body) {
  const { env } = context;
  if (session.user.role !== "admin") {
    throw new TransferHttpError("普通账号不能完成大文件分片上传。", 403, "TRANSFER_MULTIPART_ADMIN_ONLY");
  }
  const sessionId = normalizeId(body.sessionId, "上传任务编号无效。", "TRANSFER_SESSION_INVALID");
  const roomKey = normalizeRoomKey(body.roomKey);
  const row = await ownedUploadSession(env, session, sessionId, roomKey, false);
  if (row.status === "completed") {
    const completedItem = await env.DB.prepare("select * from transfer_items where id = ?").bind(row.item_id).first();
    return { item: publicItem(completedItem, roomKey, session), alreadyCompleted: true };
  }
  const partRows = await env.DB.prepare(`
    select part_number, etag, size_bytes from transfer_upload_parts
    where upload_session_id = ? order by part_number asc
  `).bind(sessionId).all();
  const parts = partRows.results || [];
  validateCompleteParts(row, parts);
  await env.DB.prepare("update transfer_upload_sessions set status = 'completing', updated_at = ? where id = ?")
    .bind(nowIso(), sessionId).run();
  let object = await env.TRANSFER_BUCKET.head(row.object_key);
  await recordR2Operations(env, { classB: 1 });
  if (!object || Number(object.size) !== Number(row.declared_size_bytes)) {
    const multipart = env.TRANSFER_BUCKET.resumeMultipartUpload(row.object_key, row.r2_upload_id);
    object = await multipart.complete(parts.map((part) => ({
      partNumber: Number(part.part_number),
      etag: part.etag
    })));
    await recordR2Operations(env, { classA: 1 });
  }
  const verified = await env.TRANSFER_BUCKET.head(row.object_key);
  await recordR2Operations(env, { classB: 1 });
  if (!verified || Number(verified.size) !== Number(row.declared_size_bytes)) {
    await env.DB.prepare("update transfer_upload_sessions set status = 'failed', updated_at = ? where id = ?")
      .bind(nowIso(), sessionId).run();
    throw new TransferHttpError("R2 完成对象大小与上传任务不一致。", 422, "TRANSFER_FINAL_SIZE_MISMATCH");
  }
  const settings = await loadTransferSettings(env);
  const completedAt = nowIso();
  const expiresAt = addHoursIso(settings.retentionHours);
  await env.DB.batch([
    env.DB.prepare(`
      update transfer_items set upload_status = 'ready', size_bytes = ?, etag = ?,
        completed_at = ?, expires_at = ?, last_error = ''
      where id = ?
    `).bind(Number(verified.size), verified.etag || object?.etag || "", completedAt, expiresAt, row.item_id),
    env.DB.prepare(`
      update transfer_upload_sessions set status = 'completed', updated_at = ?, completed_at = ? where id = ?
    `).bind(completedAt, completedAt, sessionId)
  ]);
  await recordCompletedUpload(env, session, Number(verified.size));
  await touchRoom(env, row.room_id, completedAt);
  scheduleAlerts(context);
  const item = await env.DB.prepare("select * from transfer_items where id = ?").bind(row.item_id).first();
  return { item: publicItem(item, roomKey, session), alreadyCompleted: false };
}

async function abortMultipartUpload(env, session, sessionIdValue, roomKeyValue, allowAny = false) {
  const sessionId = normalizeId(sessionIdValue, "上传任务编号无效。", "TRANSFER_SESSION_INVALID");
  const roomKey = normalizeRoomKey(roomKeyValue);
  const row = await ownedUploadSession(env, session, sessionId, roomKey, allowAny);
  if (row.status === "completed") {
    throw new TransferHttpError("已经完成的上传不能作为未完成任务中止。", 409, "TRANSFER_ALREADY_COMPLETED");
  }
  if (row.status !== "aborted") {
    const multipart = env.TRANSFER_BUCKET.resumeMultipartUpload(row.object_key, row.r2_upload_id);
    try {
      await multipart.abort();
    } catch (error) {
      if (!String(error?.message || "").toLowerCase().includes("not found")) {
        throw new TransferHttpError("R2 暂时无法中止这个上传任务。", 503, "TRANSFER_ABORT_FAILED");
      }
    }
  }
  await env.DB.batch([
    env.DB.prepare("delete from transfer_upload_parts where upload_session_id = ?").bind(sessionId),
    env.DB.prepare("update transfer_upload_sessions set status = 'aborted', updated_at = ?, aborted_at = ? where id = ?")
      .bind(nowIso(), nowIso(), sessionId),
    env.DB.prepare("delete from transfer_items where id = ? and upload_status <> 'ready'").bind(row.item_id)
  ]);
  await audit(env, session.user.id, "upload_aborted", row.room_id, row.item_id, Number(row.declared_size_bytes), row.mime_type);
  return { ok: true, sessionId, status: "aborted" };
}

async function downloadTransferFile(context, session, itemIdValue) {
  const { request, env } = context;
  const url = new URL(request.url);
  const itemId = normalizeId(itemIdValue, "文件编号无效。", "TRANSFER_ITEM_INVALID");
  const roomKey = normalizeRoomKey(url.searchParams.get("room"));
  const item = await env.DB.prepare(`
    select i.*, r.room_key, r.status as room_status
    from transfer_items i join transfer_rooms r on r.id = i.room_id
    where i.id = ? and r.room_key = ?
  `).bind(itemId, roomKey).first();
  if (!item || item.upload_status !== "ready" || !item.r2_object_key || item.expires_at <= nowIso()) {
    throw new TransferHttpError("文件不存在、已删除或已经过期。", 404, "TRANSFER_FILE_UNAVAILABLE");
  }
  if (item.room_status !== "open" && session.user.role !== "admin") {
    throw new TransferHttpError("这个互传房间已经关闭。", 423, "TRANSFER_ROOM_CLOSED");
  }
  const totalSize = Number(item.size_bytes);
  const range = parseSingleRange(request.headers.get("Range"), totalSize);
  const headers = fileResponseHeaders(item, url.searchParams.get("download") === "1");
  let object;
  if (request.method === "HEAD") {
    object = await env.TRANSFER_BUCKET.head(item.r2_object_key);
    await recordR2Operations(env, { classB: 1 });
    if (!object) {
      throw new TransferHttpError("R2 中的文件对象不存在。", 404, "TRANSFER_R2_OBJECT_MISSING");
    }
    headers.set("Content-Length", String(totalSize));
    return new Response(null, { status: 200, headers });
  }
  object = await env.TRANSFER_BUCKET.get(item.r2_object_key, range ? { range } : undefined);
  await recordR2Operations(env, { classB: 1 });
  if (!object?.body) {
    throw new TransferHttpError("R2 中的文件对象不存在。", 404, "TRANSFER_R2_OBJECT_MISSING");
  }
  if (range) {
    headers.set("Content-Length", String(range.length));
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${totalSize}`);
  } else {
    headers.set("Content-Length", String(totalSize));
  }
  context.waitUntil?.(recordDownloadUsage(env, session, range?.length || totalSize));
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

async function deleteTransferItem(env, session, itemIdValue, roomKey) {
  const itemId = normalizeId(itemIdValue, "内容编号无效。", "TRANSFER_ITEM_INVALID");
  const item = await env.DB.prepare(`
    select i.*, r.room_key from transfer_items i join transfer_rooms r on r.id = i.room_id
    where i.id = ? and r.room_key = ?
  `).bind(itemId, roomKey).first();
  if (!item) {
    throw new TransferHttpError("内容不存在。", 404, "TRANSFER_ITEM_NOT_FOUND");
  }
  if (item.uploader_user_id !== session.user.id && session.user.role !== "admin") {
    throw new TransferHttpError("只能删除自己上传的内容。", 403, "TRANSFER_DELETE_FORBIDDEN");
  }
  await deleteItemRecordAndObject(env, session.user.id, item, "item_deleted");
}

async function adminDeleteTransferItem(env, session, itemIdValue) {
  const itemId = normalizeId(itemIdValue, "内容编号无效。", "TRANSFER_ITEM_INVALID");
  const item = await env.DB.prepare("select * from transfer_items where id = ?").bind(itemId).first();
  if (!item) {
    throw new TransferHttpError("内容不存在。", 404, "TRANSFER_ITEM_NOT_FOUND");
  }
  await deleteItemRecordAndObject(env, session.user.id, item, "admin_item_deleted");
}

async function deleteItemRecordAndObject(env, actorUserId, item, action) {
  if (item.r2_object_key) {
    try {
      await env.TRANSFER_BUCKET.delete(item.r2_object_key);
    } catch {
      await env.DB.prepare(`
        update transfer_items set upload_status = 'delete_failed', cleanup_attempts = cleanup_attempts + 1,
          last_error = 'r2_delete_failed' where id = ?
      `).bind(item.id).run();
      throw new TransferHttpError("R2 文件删除失败，系统会继续重试。", 503, "TRANSFER_DELETE_RETRYING");
    }
  }
  await audit(env, actorUserId, action, item.room_id, item.id, Number(item.size_bytes || 0), item.mime_type || "");
  await env.DB.batch([
    env.DB.prepare("delete from transfer_items where id = ?").bind(item.id),
    env.DB.prepare("update transfer_rooms set sync_generation = sync_generation + 1, last_activity_at = ? where id = ?")
      .bind(nowIso(), item.room_id)
  ]);
}

async function assertUploadAllowed(env, session, room, sizeBytes, settings, options = {}) {
  if (!settings.globalUploadEnabled) {
    throw new TransferHttpError("全部文件上传已由管理员暂停。", 503, "TRANSFER_UPLOADS_PAUSED");
  }
  if (options.simple && sizeBytes > settings.normalMaxFileBytes) {
    throw new TransferHttpError(
      session.user.role === "admin"
        ? "超过 95 MiB 的文件必须使用管理员分片上传。"
        : "普通账号单文件不能超过 95 MiB。",
      413,
      session.user.role === "admin" ? "TRANSFER_MULTIPART_REQUIRED" : "TRANSFER_NORMAL_FILE_LIMIT"
    );
  }
  if (session.user.role === "admin") {
    if (sizeBytes > settings.adminMaxObjectBytes) {
      throw new TransferHttpError("文件大小超过 R2 平台边界。", 413, "TRANSFER_ADMIN_FILE_LIMIT");
    }
    return;
  }
  if (!settings.normalUploadEnabled) {
    throw new TransferHttpError("普通账号上传目前已暂停，已有内容仍可下载。", 503, "TRANSFER_NORMAL_UPLOADS_PAUSED");
  }
  const usage = await usageSummary(env, settings);
  if (usage.normalPool.status === "red") {
    throw new TransferHttpError("普通账号免费额度保护已启动，请等待旧文件过期。", 503, "TRANSFER_FREE_POOL_PAUSED");
  }
  if (room.status !== "open") {
    throw new TransferHttpError("这个互传房间已经关闭。", 423, "TRANSFER_ROOM_CLOSED");
  }
}

async function activeRoomByKey(env, roomKey) {
  const room = await env.DB.prepare("select * from transfer_rooms where room_key = ?").bind(roomKey).first();
  if (!room) {
    throw new TransferHttpError("请先加入这个互传房间。", 404, "TRANSFER_ROOM_NOT_JOINED");
  }
  if (room.status !== "open") {
    throw new TransferHttpError("这个互传房间已经关闭。", 423, "TRANSFER_ROOM_CLOSED");
  }
  return room;
}

async function ownedUploadSession(env, session, sessionId, roomKey, allowAny) {
  const row = await env.DB.prepare(`
    select s.*, r.room_key from transfer_upload_sessions s
    join transfer_rooms r on r.id = s.room_id
    where s.id = ? and r.room_key = ?
  `).bind(sessionId, roomKey).first();
  if (!row) {
    throw new TransferHttpError("上传任务不存在或房间凭证不匹配。", 404, "TRANSFER_SESSION_NOT_FOUND");
  }
  if (!allowAny && row.user_id !== session.user.id) {
    throw new TransferHttpError("不能操作其他账号的上传任务。", 403, "TRANSFER_SESSION_FORBIDDEN");
  }
  if (!MULTIPART_ACTIVE_STATUSES.includes(row.status) && row.status !== "completed" && row.status !== "aborted") {
    throw new TransferHttpError("上传任务当前不能继续。", 409, "TRANSFER_SESSION_INACTIVE");
  }
  if (row.expires_at <= nowIso() && row.status !== "completed") {
    throw new TransferHttpError("上传任务已过期，请重新开始。", 410, "TRANSFER_SESSION_EXPIRED");
  }
  return row;
}

function validateCompleteParts(row, parts) {
  const expected = Number(row.expected_parts);
  if (parts.length !== expected) {
    throw new TransferHttpError("仍有分片没有上传完成。", 409, "TRANSFER_PARTS_MISSING");
  }
  let total = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (Number(part.part_number) !== index + 1 || !part.etag) {
      throw new TransferHttpError("分片顺序或 ETag 校验失败。", 422, "TRANSFER_PARTS_INVALID");
    }
    const expectedLength = expectedPartLength(row, index + 1);
    if (Number(part.size_bytes) !== expectedLength) {
      throw new TransferHttpError("分片大小校验失败。", 422, "TRANSFER_PART_SIZE_MISMATCH");
    }
    total += Number(part.size_bytes);
  }
  if (total !== Number(row.declared_size_bytes)) {
    throw new TransferHttpError("全部分片合计大小不正确。", 422, "TRANSFER_FINAL_SIZE_MISMATCH");
  }
}

function expectedPartLength(row, partNumber) {
  const expectedParts = Number(row.expected_parts);
  if (partNumber > expectedParts) {
    throw new TransferHttpError("分片编号超出任务范围。", 422, "TRANSFER_PART_INVALID");
  }
  const declared = Number(row.declared_size_bytes);
  const partSize = Number(row.part_size_bytes);
  return partNumber === expectedParts ? declared - partSize * (expectedParts - 1) : partSize;
}

function choosePartSize(fileSize, requested, settings) {
  const preferred = Number(requested) || (fileSize >= 4 * GIB ? 64 * MIB : fileSize >= 512 * MIB ? 32 * MIB : 16 * MIB);
  const bounded = Math.min(settings.adminMaxPartBytes, Math.max(settings.adminMinPartBytes, Math.floor(preferred)));
  const minimumForPartCount = Math.ceil(fileSize / settings.adminMaxParts);
  const required = Math.max(bounded, minimumForPartCount);
  const rounded = Math.ceil(required / MIB) * MIB;
  if (rounded > settings.adminMaxPartBytes) {
    throw new TransferHttpError("在当前请求体上限下无法把文件分成不超过 10,000 个分片。", 413, "TRANSFER_PART_PLAN_UNAVAILABLE");
  }
  return rounded;
}

async function loadTransferSettings(env) {
  const result = await env.DB.prepare("select setting_key, setting_value from transfer_settings").all();
  const stored = Object.fromEntries((result.results || []).map((row) => [row.setting_key, row.setting_value]));
  const settings = { ...DEFAULTS };
  for (const [settingKey, definition] of Object.entries(SETTING_DEFINITIONS)) {
    const [property, min, max, envName] = definition;
    const envValue = envName ? env[envName] : undefined;
    const raw = envValue ?? stored[settingKey];
    if (raw === undefined) {
      continue;
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric >= min && numeric <= max) {
      settings[property] = numeric;
    }
  }
  settings.alertThresholds = String(env.TRANSFER_ALERT_THRESHOLDS || stored.alert_thresholds || DEFAULTS.alertThresholds);
  return settings;
}

async function updateTransferSettings(env, session, body) {
  const entries = [];
  for (const [settingKey, definition] of Object.entries(SETTING_DEFINITIONS)) {
    if (!Object.prototype.hasOwnProperty.call(body, settingKey)) {
      continue;
    }
    const [, min, max] = definition;
    const value = Number(body[settingKey]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new TransferHttpError(`设置 ${settingKey} 超出允许范围。`, 422, "TRANSFER_SETTING_INVALID");
    }
    entries.push([settingKey, String(value)]);
  }
  if (Object.prototype.hasOwnProperty.call(body, "alert_thresholds")) {
    const thresholds = normalizeAlertThresholds(body.alert_thresholds).join(",");
    entries.push(["alert_thresholds", thresholds]);
  }
  if (!entries.length) {
    throw new TransferHttpError("没有可更新的互传设置。", 422, "TRANSFER_SETTINGS_EMPTY");
  }
  const now = nowIso();
  await env.DB.batch(entries.map(([key, value]) => env.DB.prepare(`
    insert into transfer_settings (setting_key, setting_value, updated_at, updated_by)
    values (?, ?, ?, ?)
    on conflict(setting_key) do update set setting_value = excluded.setting_value,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `).bind(key, value, now, session.user.id)));
  await audit(env, session.user.id, "settings_updated", "", "", 0, "");
  return await loadTransferSettings(env);
}

async function setBooleanSetting(env, key, enabled, userId) {
  if (typeof enabled !== "boolean") {
    throw new TransferHttpError("开关状态必须是布尔值。", 422, "TRANSFER_SWITCH_INVALID");
  }
  await env.DB.prepare(`
    insert into transfer_settings (setting_key, setting_value, updated_at, updated_by)
    values (?, ?, ?, ?)
    on conflict(setting_key) do update set setting_value = excluded.setting_value,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `).bind(key, enabled ? "1" : "0", nowIso(), userId).run();
  await audit(env, userId, `${key}_${enabled ? "enabled" : "disabled"}`, "", "", 0, "");
}

async function usageSummary(env, providedSettings) {
  const settings = providedSettings || await loadTransferSettings(env);
  const now = nowIso();
  const month = monthKey();
  const [active, counts, operations, daily] = await Promise.all([
    env.DB.prepare(`
      select
        coalesce(sum(case when uploader_role_snapshot <> 'admin' then size_bytes else 0 end), 0) as normal_bytes,
        coalesce(sum(case when uploader_role_snapshot = 'admin' then size_bytes else 0 end), 0) as admin_bytes
      from transfer_items where upload_status in ('uploading','ready','delete_failed') and expires_at > ?
    `).bind(now).first(),
    env.DB.prepare(`
      select count(*) as active_items,
        sum(case when upload_status = 'uploading' then 1 else 0 end) as uploading_items,
        sum(case when upload_status = 'failed' then 1 else 0 end) as failed_items,
        sum(case when upload_status = 'delete_failed' then 1 else 0 end) as cleanup_failed_items
      from transfer_items
    `).first(),
    env.DB.prepare("select * from transfer_usage_monthly where billing_month = ?").bind(month).first(),
    env.DB.prepare(`
      select
        (select coalesce(sum(normal_peak_active_bytes), 0)
          from transfer_storage_daily where usage_date like ?) as normal_peak_sum,
        (select coalesce(sum(total_peak_active_bytes), 0)
          from transfer_storage_daily where usage_date like ?) as total_peak_sum,
        (select coalesce(sum(uploaded_bytes), 0)
          from transfer_usage_daily where usage_date like ?) as uploaded_bytes,
        (select coalesce(sum(completed_files), 0)
          from transfer_usage_daily where usage_date like ?) as completed_files
    `).bind(`${month}%`, `${month}%`, `${month}%`, `${month}%`).first()
  ]);
  const classA = Number(operations?.class_a_operations || 0);
  const classB = Number(operations?.class_b_operations || 0);
  const normalActive = Number(active?.normal_bytes || 0);
  const storageGbMonth = Number(daily?.total_peak_sum || 0) / GIB / daysInMonth();
  const normalStorageGbMonth = Number(daily?.normal_peak_sum || 0) / GIB / daysInMonth();
  const cost = estimateR2Cost(storageGbMonth, classA, classB);
  const ratios = {
    active: normalActive / settings.normalPoolActiveBytes,
    classA: classA / settings.normalPoolClassABudget,
    classB: classB / settings.normalPoolClassBBudget,
    storage: normalStorageGbMonth / settings.normalPoolStorageGbMonth
  };
  const maxRatio = Math.max(...Object.values(ratios));
  const status = !settings.normalUploadEnabled || maxRatio >= settings.normalPoolRedRatio
    ? "red"
    : maxRatio >= settings.normalPoolYellowRatio ? "yellow" : "green";
  return {
    active: {
      normalBytes: normalActive,
      adminBytes: Number(active?.admin_bytes || 0),
      totalBytes: normalActive + Number(active?.admin_bytes || 0),
      activeItems: Number(counts?.active_items || 0),
      uploadingItems: Number(counts?.uploading_items || 0),
      failedItems: Number(counts?.failed_items || 0),
      cleanupFailedItems: Number(counts?.cleanup_failed_items || 0)
    },
    monthly: {
      billingMonth: month,
      classAOperations: classA,
      classBOperations: classB,
      uploadedBytes: Number(daily?.uploaded_bytes || operations?.uploaded_bytes || 0),
      completedFiles: Number(daily?.completed_files || 0),
      estimatedStorageGbMonth: round(storageGbMonth, 4),
      estimatedCostUsd: cost.total,
      costBreakdown: cost
    },
    normalPool: {
      status,
      activeBytes: normalActive,
      ratios,
      maxRatio: round(maxRatio, 4),
      normalUploadEnabled: Boolean(settings.normalUploadEnabled),
      globalUploadEnabled: Boolean(settings.globalUploadEnabled)
    },
    pricing: {
      updatedAt: "2026-05-28",
      standardStorageUsdPerGbMonth: 0.015,
      classAUsdPerMillion: 4.5,
      classBUsdPerMillion: 0.36,
      freeStorageGbMonth: 10,
      freeClassAOperations: 1000000,
      freeClassBOperations: 10000000,
      estimateOnly: true
    }
  };
}

function estimateR2Cost(storageGbMonth, classA, classB) {
  const billableStorage = Math.ceil(Math.max(0, storageGbMonth - 10));
  const billableAUnits = Math.ceil(Math.max(0, classA - 1000000) / 1000000);
  const billableBUnits = Math.ceil(Math.max(0, classB - 10000000) / 1000000);
  const storage = round(billableStorage * 0.015, 2);
  const operationsA = round(billableAUnits * 4.5, 2);
  const operationsB = round(billableBUnits * 0.36, 2);
  return { storage, operationsA, operationsB, total: round(storage + operationsA + operationsB, 2) };
}

async function adminOverview(env) {
  const usage = await usageSummary(env);
  const [rooms, expired, cleanup, alerts, topUsers, topRooms, largest, recentAudit] = await Promise.all([
    env.DB.prepare("select count(*) as count from transfer_rooms where status = 'open'").first(),
    env.DB.prepare("select count(*) as count from transfer_items where expires_at <= ?").bind(nowIso()).first(),
    env.DB.prepare("select * from transfer_cleanup_runs order by started_at desc limit 1").first(),
    env.DB.prepare("select * from transfer_alerts order by created_at desc limit 20").all(),
    env.DB.prepare(`
      select u.id as user_id, u.email, count(i.id) as files, coalesce(sum(i.size_bytes),0) as bytes
      from transfer_items i join users u on u.id = i.uploader_user_id
      where i.upload_status = 'ready' group by u.id, u.email order by bytes desc limit 20
    `).all(),
    env.DB.prepare(`
      select r.id as room_id, count(i.id) as items, coalesce(sum(i.size_bytes),0) as bytes, max(i.created_at) as last_activity_at
      from transfer_rooms r left join transfer_items i on i.room_id = r.id and i.upload_status = 'ready'
      group by r.id order by bytes desc limit 20
    `).all(),
    env.DB.prepare(`
      select id, room_id, uploader_user_id, display_filename, mime_type, size_bytes, created_at, expires_at
      from transfer_items where upload_status = 'ready' order by size_bytes desc limit 20
    `).all(),
    env.DB.prepare("select * from transfer_audit_log order by created_at desc limit 50").all()
  ]);
  return {
    usage,
    openRooms: Number(rooms?.count || 0),
    expiredPendingCleanup: Number(expired?.count || 0),
    latestCleanup: cleanup || null,
    alerts: alerts.results || [],
    notification: notificationStatus(env),
    topUsers: topUsers.results || [],
    topRooms: topRooms.results || [],
    largestFiles: largest.results || [],
    recentAudit: recentAudit.results || []
  };
}

async function adminRooms(env, params) {
  const limit = clampInteger(params.get("limit"), 1, MAX_ADMIN_PAGE, 50);
  const search = normalizeAdminSearch(params.get("search"));
  const rows = await env.DB.prepare(`
    select r.*, count(i.id) as item_count, coalesce(sum(i.size_bytes),0) as active_bytes
    from transfer_rooms r left join transfer_items i on i.room_id = r.id and i.upload_status in ('uploading','ready','delete_failed')
    where (? = '' or r.id like ?)
    group by r.id order by r.last_activity_at desc limit ?
  `).bind(search, `%${search}%`, limit).all();
  return rows.results || [];
}

async function adminItems(env, params) {
  const limit = clampInteger(params.get("limit"), 1, MAX_ADMIN_PAGE, 50);
  const requestedOffset = clampInteger(params.get("offset"), 0, 1000000, 0);
  const search = normalizeAdminSearch(params.get("search"));
  const searchPattern = `%${search}%`;
  const countRow = await env.DB.prepare(`
    select count(*) as count
    from transfer_items i left join users u on u.id = i.uploader_user_id
    where (? = '' or i.display_filename like ? or coalesce(u.email, '') like ? or i.id like ?)
  `).bind(search, searchPattern, searchPattern, searchPattern).first();
  const total = Number(countRow?.count || 0);
  const lastPageOffset = total > 0 ? Math.floor((total - 1) / limit) * limit : 0;
  const offset = Math.min(requestedOffset, lastPageOffset);
  const rows = await env.DB.prepare(`
    select i.id, i.room_id, i.uploader_user_id, i.uploader_role_snapshot, i.item_type,
      i.display_filename, i.mime_type, i.size_bytes, i.upload_mode, i.upload_status,
      i.created_at, i.completed_at, i.expires_at, i.cleanup_attempts, i.last_error,
      u.email as uploader_email
    from transfer_items i left join users u on u.id = i.uploader_user_id
    where (? = '' or i.display_filename like ? or coalesce(u.email, '') like ? or i.id like ?)
    order by i.created_at desc limit ? offset ?
  `).bind(search, searchPattern, searchPattern, searchPattern, limit, offset).all();
  return {
    items: rows.results || [],
    pagination: {
      total,
      limit,
      offset,
      hasPrevious: offset > 0,
      hasNext: offset + limit < total
    }
  };
}

async function adminUploads(env, params) {
  const limit = clampInteger(params.get("limit"), 1, MAX_ADMIN_PAGE, 50);
  const rows = await env.DB.prepare(`
    select s.id, s.item_id, s.room_id, r.room_key, s.user_id, s.user_role_snapshot, s.filename, s.mime_type,
      s.declared_size_bytes, s.part_size_bytes, s.expected_parts, s.status, s.created_at,
      s.updated_at, s.expires_at, s.completed_at, s.aborted_at,
      count(p.part_number) as completed_parts
    from transfer_upload_sessions s
    join transfer_rooms r on r.id = s.room_id
    left join transfer_upload_parts p on p.upload_session_id = s.id
    group by s.id order by s.updated_at desc limit ?
  `).bind(limit).all();
  return rows.results || [];
}

async function adminClearRoom(env, session, roomIdValue) {
  const roomId = normalizeId(roomIdValue, "房间编号无效。", "TRANSFER_ROOM_INVALID");
  const items = await env.DB.prepare("select * from transfer_items where room_id = ?").bind(roomId).all();
  let deleted = 0;
  let failed = 0;
  for (const item of items.results || []) {
    try {
      await deleteItemRecordAndObject(env, session.user.id, item, "admin_room_item_deleted");
      deleted += 1;
    } catch {
      failed += 1;
    }
  }
  await audit(env, session.user.id, "room_cleared", roomId, "", 0, "");
  return { ok: failed === 0, deleted, failed };
}

async function adminCloseRoom(env, session, roomIdValue) {
  const roomId = normalizeId(roomIdValue, "房间编号无效。", "TRANSFER_ROOM_INVALID");
  const result = await env.DB.prepare(`
    update transfer_rooms set status = 'closed', closed_at = ?, closed_by = ? where id = ?
  `).bind(nowIso(), session.user.id, roomId).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    throw new TransferHttpError("房间不存在。", 404, "TRANSFER_ROOM_NOT_FOUND");
  }
  await audit(env, session.user.id, "room_closed", roomId, "", 0, "");
  return { ok: true, roomId };
}

export async function runTransferCleanup(env, options = {}) {
  assertBindings(env, { requireBucket: true });
  await ensureTransferSchema(env);
  const limit = clampInteger(options.limit, 1, 500, 100);
  const runId = crypto.randomUUID();
  const startedAt = nowIso();
  let deletedItems = 0;
  let deletedBytes = 0;
  let abortedUploads = 0;
  let failed = 0;
  let orphanObjects = 0;

  await env.DB.prepare(`
    insert into transfer_cleanup_runs (id, started_at, status, trigger_type)
    values (?, ?, 'running', ?)
  `).bind(runId, startedAt, options.triggerType || "manual").run();

  const sessions = await env.DB.prepare(`
    select * from transfer_upload_sessions
    where status in ('active','completing','failed') and expires_at <= ?
    order by expires_at asc limit ?
  `).bind(startedAt, limit).all();
  for (const row of sessions.results || []) {
    try {
      if (row.r2_upload_id) {
        try {
          await env.TRANSFER_BUCKET.resumeMultipartUpload(row.object_key, row.r2_upload_id).abort();
        } catch {
          // Missing uploads are already effectively aborted.
        }
      }
      try {
        await env.TRANSFER_BUCKET.delete(row.object_key);
      } catch {
        // An incomplete upload may not have a completed object to delete.
      }
      await env.DB.batch([
        env.DB.prepare("delete from transfer_upload_parts where upload_session_id = ?").bind(row.id),
        env.DB.prepare("update transfer_upload_sessions set status = 'aborted', aborted_at = ?, updated_at = ? where id = ?")
          .bind(nowIso(), nowIso(), row.id),
        env.DB.prepare("delete from transfer_items where id = ? and upload_status <> 'ready'").bind(row.item_id)
      ]);
      abortedUploads += 1;
    } catch {
      failed += 1;
    }
  }

  const items = await env.DB.prepare(`
    select * from transfer_items
    where (expires_at <= ? or upload_status = 'delete_failed')
    order by expires_at asc limit ?
  `).bind(startedAt, limit).all();
  for (const item of items.results || []) {
    try {
      if (item.r2_object_key) {
        await env.TRANSFER_BUCKET.delete(item.r2_object_key);
      }
      await audit(env, options.actorUserId || "system", "expired_item_deleted", item.room_id, item.id, Number(item.size_bytes || 0), item.mime_type || "");
      await env.DB.batch([
        env.DB.prepare("delete from transfer_items where id = ?").bind(item.id),
        env.DB.prepare("update transfer_rooms set sync_generation = sync_generation + 1, last_activity_at = ? where id = ?")
          .bind(nowIso(), item.room_id)
      ]);
      deletedItems += 1;
      deletedBytes += Number(item.size_bytes || 0);
    } catch {
      failed += 1;
      await env.DB.prepare(`
        update transfer_items set upload_status = 'delete_failed', cleanup_attempts = cleanup_attempts + 1,
          last_error = 'cleanup_r2_delete_failed' where id = ?
      `).bind(item.id).run();
    }
  }

  if (options.reconcile) {
    const listed = await env.TRANSFER_BUCKET.list({ prefix: TRANSFER_PREFIX, limit: 1000 });
    await recordR2Operations(env, { classA: 1 });
    const orphanCutoff = Date.now() - 48 * 60 * 60 * 1000;
    for (const object of listed.objects || []) {
      if (new Date(object.uploaded).getTime() > orphanCutoff) {
        continue;
      }
      const reference = await env.DB.prepare(`
        select id from transfer_items where r2_object_key = ?
        union all select id from transfer_upload_sessions where object_key = ? limit 1
      `).bind(object.key, object.key).first();
      if (!reference) {
        try {
          await env.TRANSFER_BUCKET.delete(object.key);
          orphanObjects += 1;
        } catch {
          failed += 1;
        }
      }
    }
  }

  await env.DB.prepare(`
    delete from transfer_rooms
    where status = 'open'
      and last_activity_at <= ?
      and not exists (select 1 from transfer_items i where i.room_id = transfer_rooms.id)
      and not exists (select 1 from transfer_upload_sessions s where s.room_id = transfer_rooms.id and s.status in ('active','completing'))
  `).bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).run();
  const finishedAt = nowIso();
  await env.DB.prepare(`
    update transfer_cleanup_runs set finished_at = ?, status = ?, deleted_items = ?, deleted_bytes = ?,
      aborted_uploads = ?, orphan_objects = ?, failed_operations = ? where id = ?
  `).bind(finishedAt, failed ? "partial" : "success", deletedItems, deletedBytes, abortedUploads, orphanObjects, failed, runId).run();
  await refreshDailyStoragePeaks(env);
  return { runId, status: failed ? "partial" : "success", deletedItems, deletedBytes, abortedUploads, orphanObjects, failed };
}

async function recordCompletedUpload(env, session, bytes) {
  const today = dateKey();
  const month = monthKey();
  await env.DB.batch([
    env.DB.prepare(`
      insert into transfer_usage_daily (
        user_id, user_role_snapshot, usage_date, uploaded_bytes, downloaded_bytes,
        completed_files, initialized_uploads, failed_uploads, normal_peak_active_bytes,
        total_peak_active_bytes, updated_at
      ) values (?, ?, ?, ?, 0, 1, 1, 0, 0, 0, ?)
      on conflict(user_id, usage_date) do update set
        user_role_snapshot = excluded.user_role_snapshot,
        uploaded_bytes = transfer_usage_daily.uploaded_bytes + excluded.uploaded_bytes,
        completed_files = transfer_usage_daily.completed_files + 1,
        initialized_uploads = transfer_usage_daily.initialized_uploads + 1,
        updated_at = excluded.updated_at
    `).bind(session.user.id, session.user.role, today, bytes, nowIso()),
    env.DB.prepare(`
      insert into transfer_usage_monthly (billing_month, uploaded_bytes, class_a_operations, class_b_operations, updated_at)
      values (?, ?, 0, 0, ?)
      on conflict(billing_month) do update set uploaded_bytes = transfer_usage_monthly.uploaded_bytes + excluded.uploaded_bytes,
        updated_at = excluded.updated_at
    `).bind(month, bytes, nowIso())
  ]);
  await audit(env, session.user.id, "upload_completed", "", "", bytes, "");
  await refreshDailyStoragePeaks(env);
}

async function recordDownloadUsage(env, session, bytes) {
  await env.DB.prepare(`
    insert into transfer_usage_daily (
      user_id, user_role_snapshot, usage_date, uploaded_bytes, downloaded_bytes,
      completed_files, initialized_uploads, failed_uploads, normal_peak_active_bytes,
      total_peak_active_bytes, updated_at
    ) values (?, ?, ?, 0, ?, 0, 0, 0, 0, 0, ?)
    on conflict(user_id, usage_date) do update set
      downloaded_bytes = transfer_usage_daily.downloaded_bytes + excluded.downloaded_bytes,
      updated_at = excluded.updated_at
  `).bind(session.user.id, session.user.role, dateKey(), bytes, nowIso()).run();
}

async function recordR2Operations(env, operations) {
  await env.DB.prepare(`
    insert into transfer_usage_monthly (billing_month, uploaded_bytes, class_a_operations, class_b_operations, updated_at)
    values (?, 0, ?, ?, ?)
    on conflict(billing_month) do update set
      class_a_operations = transfer_usage_monthly.class_a_operations + excluded.class_a_operations,
      class_b_operations = transfer_usage_monthly.class_b_operations + excluded.class_b_operations,
      updated_at = excluded.updated_at
  `).bind(monthKey(), Number(operations.classA || 0), Number(operations.classB || 0), nowIso()).run();
}

async function refreshDailyStoragePeaks(env) {
  const current = await env.DB.prepare(`
    select
      coalesce(sum(case when uploader_role_snapshot <> 'admin' then size_bytes else 0 end), 0) as normal_bytes,
      coalesce(sum(size_bytes), 0) as total_bytes
    from transfer_items where upload_status in ('uploading','ready','delete_failed') and expires_at > ?
  `).bind(nowIso()).first();
  const now = nowIso();
  await env.DB.prepare(`
    insert into transfer_storage_daily (usage_date, normal_peak_active_bytes, total_peak_active_bytes, updated_at)
    values (?, ?, ?, ?)
    on conflict(usage_date) do update set
      normal_peak_active_bytes = max(transfer_storage_daily.normal_peak_active_bytes, excluded.normal_peak_active_bytes),
      total_peak_active_bytes = max(transfer_storage_daily.total_peak_active_bytes, excluded.total_peak_active_bytes),
      updated_at = excluded.updated_at
  `).bind(dateKey(), Number(current?.normal_bytes || 0), Number(current?.total_bytes || 0), now).run();
  await env.DB.prepare(`
    update transfer_usage_daily set
      normal_peak_active_bytes = max(normal_peak_active_bytes, ?),
      total_peak_active_bytes = max(total_peak_active_bytes, ?),
      updated_at = ? where usage_date = ?
  `).bind(Number(current?.normal_bytes || 0), Number(current?.total_bytes || 0), now, dateKey()).run();
}

async function userUsage24h(env, userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const row = await env.DB.prepare(`
    select coalesce(sum(size_bytes),0) as uploaded_bytes, count(*) as completed_files
    from transfer_audit_log
    where actor_user_id = ? and action = 'upload_completed' and created_at >= ?
  `).bind(userId, since).first();
  return { uploadedBytes: Number(row?.uploaded_bytes || 0), completedFiles: Number(row?.completed_files || 0) };
}

async function activeRoomItemCount(env, roomId) {
  const row = await env.DB.prepare(`
    select count(*) as count from transfer_items
    where room_id = ? and upload_status in ('uploading','ready','delete_failed') and expires_at > ?
  `).bind(roomId, nowIso()).first();
  return Number(row?.count || 0);
}

async function touchRoom(env, roomId, at = nowIso()) {
  await env.DB.prepare("update transfer_rooms set last_activity_at = ? where id = ?").bind(at, roomId).run();
}

function scheduleAlerts(context) {
  const promise = maybeCreateCostAlerts(context.env).catch((error) => {
    console.error(JSON.stringify({ message: "transfer alert evaluation failed", error: safeErrorCode(error) }));
  });
  if (typeof context.waitUntil === "function") {
    context.waitUntil(promise);
  } else {
    void promise;
  }
}

async function maybeCreateCostAlerts(env) {
  const usage = await usageSummary(env);
  const settings = await loadTransferSettings(env);
  const thresholds = normalizeAlertThresholds(settings.alertThresholds);
  for (const threshold of thresholds) {
    if (usage.monthly.estimatedCostUsd < threshold) {
      continue;
    }
    const id = `${monthKey()}-cost-${threshold}`;
    const inserted = await env.DB.prepare(`
      insert into transfer_alerts (
        id, billing_month, threshold_usd, alert_type, status, details, created_at
      ) values (?, ?, ?, 'estimated_cost', 'pending', ?, ?)
      on conflict(billing_month, threshold_usd, alert_type) do nothing
    `).bind(id, monthKey(), threshold, JSON.stringify({ estimatedCostUsd: usage.monthly.estimatedCostUsd }), nowIso()).run();
    if (Number(inserted.meta?.changes || 0) === 1) {
      await deliverAlert(env, id, threshold, usage.monthly.estimatedCostUsd, false);
    }
  }
}

async function createTestAlert(env, actorUserId) {
  const id = `test-${crypto.randomUUID()}`;
  await env.DB.prepare(`
    insert into transfer_alerts (id, billing_month, threshold_usd, alert_type, status, details, created_at)
    values (?, ?, 0, 'test', 'pending', ?, ?)
  `).bind(id, monthKey(), JSON.stringify({ actorUserId }), nowIso()).run();
  const delivered = await deliverAlert(env, id, 0, 0, true);
  return { ok: true, alertId: id, delivered, notification: notificationStatus(env) };
}

async function deliverAlert(env, alertId, threshold, estimatedCost, test) {
  if (!env.TRANSFER_ALERT_WEBHOOK_URL) {
    await env.DB.prepare("update transfer_alerts set status = 'unconfigured' where id = ?").bind(alertId).run();
    return false;
  }
  try {
    const response = await fetch(env.TRANSFER_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: test ? "transfer_test_alert" : "transfer_cost_alert",
        thresholdUsd: threshold,
        estimatedCostUsd: estimatedCost,
        destination: env.TRANSFER_ALERT_EMAIL || "",
        billingMonth: monthKey()
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    await env.DB.prepare("update transfer_alerts set status = 'sent', sent_at = ? where id = ?")
      .bind(nowIso(), alertId).run();
    return true;
  } catch (error) {
    await env.DB.prepare("update transfer_alerts set status = 'failed', details = ? where id = ?")
      .bind(JSON.stringify({ error: safeErrorCode(error) }), alertId).run();
    return false;
  }
}

function notificationStatus(env) {
  return {
    webhookConfigured: Boolean(env.TRANSFER_ALERT_WEBHOOK_URL),
    emailDestinationConfigured: Boolean(env.TRANSFER_ALERT_EMAIL),
    cloudflareBudgetAlertConfigured: false,
    note: "站内估算与可选 webhook 不能替代 Cloudflare 官方账单提醒。"
  };
}

async function ensureTransferSchema(env) {
  if (transferSchemaReady) {
    return;
  }
  await env.DB.batch(transferSchemaStatements(env));
  await ensureTransferColumns(env);
  await env.DB.prepare(`
    create unique index if not exists transfer_items_idempotency_idx
    on transfer_items(uploader_user_id, idempotency_key) where idempotency_key <> ''
  `).run();
  transferSchemaReady = true;
}

async function ensureTransferColumns(env) {
  const roomColumns = (await env.DB.prepare("pragma table_info(transfer_rooms)").all()).results || [];
  if (!roomColumns.some((column) => column.name === "sync_generation")) {
    await env.DB.prepare("alter table transfer_rooms add column sync_generation integer not null default 0").run();
  }
  const itemColumns = (await env.DB.prepare("pragma table_info(transfer_items)").all()).results || [];
  if (!itemColumns.some((column) => column.name === "idempotency_key")) {
    await env.DB.prepare("alter table transfer_items add column idempotency_key text not null default ''").run();
  }
}

function transferSchemaStatements(env) {
  const statements = [
    `create table if not exists transfer_rooms (
      id text primary key, room_key text not null unique, created_by text not null references users(id),
      status text not null default 'open', created_at text not null, last_activity_at text not null,
      closed_at text not null default '', closed_by text not null default '',
      sync_generation integer not null default 0
    )`,
    `create table if not exists transfer_items (
      id text primary key, room_id text not null references transfer_rooms(id) on delete cascade,
      uploader_user_id text not null references users(id), uploader_role_snapshot text not null default 'user',
      item_type text not null, encrypted integer not null default 0, text_ciphertext text not null default '',
      original_filename text not null default '', display_filename text not null default '',
      r2_object_key text unique, mime_type text not null default '', size_bytes integer not null default 0,
      etag text not null default '', upload_mode text not null, upload_status text not null,
      created_at text not null, completed_at text not null default '', expires_at text not null,
      cleanup_attempts integer not null default 0, last_error text not null default '',
      idempotency_key text not null default ''
    )`,
    `create table if not exists transfer_upload_sessions (
      id text primary key, item_id text not null references transfer_items(id) on delete cascade,
      room_id text not null references transfer_rooms(id) on delete cascade,
      user_id text not null references users(id), user_role_snapshot text not null default 'user',
      object_key text not null unique, r2_upload_id text not null, filename text not null, mime_type text not null,
      declared_size_bytes integer not null, part_size_bytes integer not null, expected_parts integer not null,
      status text not null, created_at text not null, updated_at text not null, expires_at text not null,
      completed_at text not null default '', aborted_at text not null default ''
    )`,
    `create table if not exists transfer_upload_parts (
      upload_session_id text not null references transfer_upload_sessions(id) on delete cascade,
      part_number integer not null, etag text not null, size_bytes integer not null,
      completed_at text not null, primary key(upload_session_id, part_number)
    )`,
    `create table if not exists transfer_usage_daily (
      user_id text not null references users(id), user_role_snapshot text not null default 'user',
      usage_date text not null, uploaded_bytes integer not null default 0, downloaded_bytes integer not null default 0,
      completed_files integer not null default 0, initialized_uploads integer not null default 0,
      failed_uploads integer not null default 0, normal_peak_active_bytes integer not null default 0,
      total_peak_active_bytes integer not null default 0, updated_at text not null,
      primary key(user_id, usage_date)
    )`,
    `create table if not exists transfer_storage_daily (
      usage_date text primary key, normal_peak_active_bytes integer not null default 0,
      total_peak_active_bytes integer not null default 0, updated_at text not null
    )`,
    `create table if not exists transfer_usage_monthly (
      billing_month text primary key, uploaded_bytes integer not null default 0,
      class_a_operations integer not null default 0, class_b_operations integer not null default 0,
      updated_at text not null
    )`,
    `create table if not exists transfer_settings (
      setting_key text primary key, setting_value text not null, updated_at text not null, updated_by text not null default ''
    )`,
    `create table if not exists transfer_alerts (
      id text primary key, billing_month text not null, threshold_usd real not null,
      alert_type text not null, status text not null, details text not null default '',
      sent_at text not null default '', created_at text not null,
      unique(billing_month, threshold_usd, alert_type)
    )`,
    `create table if not exists transfer_cleanup_runs (
      id text primary key, started_at text not null, finished_at text not null default '',
      status text not null, trigger_type text not null, deleted_items integer not null default 0,
      deleted_bytes integer not null default 0, aborted_uploads integer not null default 0,
      orphan_objects integer not null default 0, failed_operations integer not null default 0
    )`,
    `create table if not exists transfer_audit_log (
      id text primary key, actor_user_id text not null, action text not null, room_id text not null default '',
      item_id text not null default '', size_bytes integer not null default 0, mime_type text not null default '',
      created_at text not null
    )`,
    "create index if not exists transfer_rooms_activity_idx on transfer_rooms(status, last_activity_at)",
    "create index if not exists transfer_items_room_created_idx on transfer_items(room_id, created_at)",
    "create index if not exists transfer_items_room_cursor_idx on transfer_items(room_id, upload_status, created_at, id)",
    "create index if not exists transfer_items_expires_idx on transfer_items(upload_status, expires_at)",
    "create index if not exists transfer_items_user_status_idx on transfer_items(uploader_user_id, upload_status, created_at)",
    "create index if not exists transfer_items_role_status_idx on transfer_items(uploader_role_snapshot, upload_status, expires_at)",
    "create index if not exists transfer_upload_sessions_user_status_idx on transfer_upload_sessions(user_id, status, updated_at)",
    "create index if not exists transfer_upload_sessions_expires_idx on transfer_upload_sessions(status, expires_at)",
    "create index if not exists transfer_upload_parts_session_idx on transfer_upload_parts(upload_session_id, part_number)",
    "create index if not exists transfer_usage_daily_date_idx on transfer_usage_daily(usage_date, user_role_snapshot)",
    "create index if not exists transfer_alerts_month_idx on transfer_alerts(billing_month, created_at)",
    "create index if not exists transfer_audit_created_idx on transfer_audit_log(created_at, action)"
  ].map((sql) => env.DB.prepare(sql));
  const seededAt = "2026-07-16T00:00:00.000Z";
  for (const [key, [property]] of Object.entries(SETTING_DEFINITIONS)) {
    statements.push(env.DB.prepare(`
      insert into transfer_settings (setting_key, setting_value, updated_at, updated_by)
      values (?, ?, ?, 'system') on conflict(setting_key) do nothing
    `).bind(key, String(DEFAULTS[property]), seededAt));
  }
  statements.push(env.DB.prepare(`
    insert into transfer_settings (setting_key, setting_value, updated_at, updated_by)
    values ('alert_thresholds', ?, ?, 'system') on conflict(setting_key) do nothing
  `).bind(DEFAULTS.alertThresholds, seededAt));
  return statements;
}

async function requireTransferSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    throw new TransferHttpError("请先登录后再使用临时互传。", 401, "TRANSFER_LOGIN_REQUIRED");
  }
  const row = await env.DB.prepare(`
    select users.id, users.email, users.role
    from sessions join users on users.id = sessions.user_id
    where sessions.token_hash = ? and sessions.expires_at > ?
  `).bind(await sha256Hex(token), nowIso()).first();
  if (!row) {
    throw new TransferHttpError("登录状态已过期，请重新登录。", 401, "TRANSFER_SESSION_EXPIRED");
  }
  return { user: { id: row.id, email: row.email, role: row.role === "admin" ? "admin" : "user" } };
}

async function requireTransferAdmin(request, env) {
  const session = await requireTransferSession(request, env);
  if (session.user.role !== "admin") {
    throw new TransferHttpError("只有管理员可以访问互传管理功能。", 403, "TRANSFER_ADMIN_REQUIRED");
  }
  return session;
}

function assertBindings(env, options = {}) {
  if (!env?.DB) {
    throw new TransferHttpError("D1 数据库绑定 DB 未配置。", 500, "TRANSFER_DB_NOT_BOUND");
  }
  if (options.requireBucket && !env.TRANSFER_BUCKET) {
    throw new TransferHttpError("R2 绑定 TRANSFER_BUCKET 尚未配置。", 503, "TRANSFER_R2_NOT_BOUND");
  }
}

function routeNeedsBucket(request, parts) {
  if (request.method === "GET" && (parts.join("/") === "transfer/config" || parts.join("/") === "admin/transfer/settings")) {
    return false;
  }
  if (parts[0] === "transfer" && parts[1] === "room") {
    return false;
  }
  if (parts[0] === "transfer" && parts[1] === "text") {
    return false;
  }
  return true;
}

function assertSameOrigin(request) {
  const origin = request.headers.get("Origin");
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) {
    throw new TransferHttpError("请求来源校验失败。", 403, "TRANSFER_ORIGIN_REJECTED");
  }
}

async function readBoundedJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_JSON_BYTES) {
    throw new TransferHttpError("请求内容过大。", 413, "TRANSFER_JSON_TOO_LARGE");
  }
  const reader = request.body?.getReader();
  if (!reader) {
    return {};
  }
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new TransferHttpError("请求内容过大。", 413, "TRANSFER_JSON_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes) || "{}");
  } catch {
    throw new TransferHttpError("JSON 请求格式不正确。", 400, "TRANSFER_JSON_INVALID");
  }
}

function normalizeRoomKey(value) {
  const roomKey = String(value || "").trim();
  if (!ROOM_KEY_PATTERN.test(roomKey)) {
    throw new TransferHttpError("房间凭证无效。", 422, "TRANSFER_ROOM_KEY_INVALID");
  }
  return roomKey;
}

function normalizeEncryptedText(value, maxChars) {
  const text = String(value || "").trim();
  const length = Array.from(text).length;
  if (!text || length > Math.max(maxChars * 3, maxChars + 512) || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text)) {
    throw new TransferHttpError("加密文字内容无效或过长。", 422, "TRANSFER_TEXT_INVALID");
  }
  return text;
}

function normalizeFilename(value) {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "_")
    .trim();
  const chars = Array.from(cleaned);
  if (!chars.length) {
    throw new TransferHttpError("文件名不能为空。", 422, "TRANSFER_FILENAME_INVALID");
  }
  return chars.slice(0, MAX_FILENAME_CHARS).join("");
}

function normalizeMimeType(value) {
  const mime = String(value || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime) || mime.length > MAX_MIME_CHARS) {
    return "application/octet-stream";
  }
  return mime;
}

function normalizeUploadLength(request, declaredValue) {
  const headerLength = Number(request.headers.get("Content-Length"));
  const declared = Number(declaredValue);
  if (!Number.isSafeInteger(headerLength) || headerLength <= 0 || !Number.isSafeInteger(declared) || declared <= 0 || headerLength !== declared) {
    throw new TransferHttpError("必须提供准确且一致的文件长度。", 411, "TRANSFER_LENGTH_REQUIRED");
  }
  return headerLength;
}

function normalizeCursor(value) {
  const cursor = String(value || "").trim();
  if (!cursor) {
    return { at: "", id: "", generation: null, validUntil: "" };
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(cursor)) {
    const date = new Date(cursor);
    if (Number.isFinite(date.getTime())) {
      return { at: date.toISOString(), id: "", generation: null, validUntil: "" };
    }
  }
  try {
    const decoded = JSON.parse(decodeCursorText(cursor));
    const at = decoded.at ? new Date(decoded.at).toISOString() : "";
    const validUntil = decoded.validUntil ? new Date(decoded.validUntil).toISOString() : "";
    const id = decoded.id ? normalizeId(decoded.id, "内容游标无效。", "TRANSFER_CURSOR_INVALID") : "";
    const generation = Number(decoded.generation);
    if (decoded.v !== 1 || !Number.isSafeInteger(generation) || generation < 0) throw new Error("invalid cursor");
    return { at, id, generation, validUntil };
  } catch {
    throw new TransferHttpError("内容游标无效。", 422, "TRANSFER_CURSOR_INVALID");
  }
}

function encodeCursor(cursor) {
  return encodeCursorText(JSON.stringify({ v: 1, ...cursor }));
}

function encodeCursorText(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeCursorText(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function normalizeId(value, message, code) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) {
    throw new TransferHttpError(message, 422, code);
  }
  return id;
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(key)) {
    throw new TransferHttpError("幂等键无效。", 422, "TRANSFER_IDEMPOTENCY_KEY_INVALID");
  }
  return key;
}

async function findIdempotentItem(env, userId, key) {
  if (!key) return null;
  return env.DB.prepare(`
    select * from transfer_items where uploader_user_id = ? and idempotency_key = ? limit 1
  `).bind(userId, key).first();
}

function assertIdempotentItem(item, roomId, itemType) {
  if (item.room_id !== roomId || item.item_type !== itemType) {
    throw new TransferHttpError("幂等键已用于其他互传内容。", 409, "TRANSFER_IDEMPOTENCY_KEY_REUSED");
  }
}

function normalizeAdminSearch(value) {
  return Array.from(String(value || "").trim()).slice(0, 80).join("");
}

function normalizeAlertThresholds(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  const normalized = [...new Set(values.map(Number).filter((item) => Number.isFinite(item) && item > 0 && item <= 100))]
    .sort((a, b) => a - b);
  if (!normalized.length) {
    throw new TransferHttpError("费用报警阈值无效。", 422, "TRANSFER_ALERT_THRESHOLDS_INVALID");
  }
  return normalized;
}

function integerInRange(value, min, max, message, code) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < min || numeric > max) {
    throw new TransferHttpError(message, 422, code);
  }
  return numeric;
}

function clampInteger(value, min, max, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.floor(numeric))) : fallback;
}

function itemTypeFromMime(mime) {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return "file";
}

function publicRoom(room) {
  return {
    id: room.id,
    status: room.status,
    createdAt: room.created_at,
    lastActivityAt: room.last_activity_at
  };
}

function publicItem(item, roomKey, session) {
  if (!item) {
    return null;
  }
  const isFile = Boolean(item.r2_object_key);
  return {
    id: item.id,
    type: item.item_type,
    encrypted: Boolean(Number(item.encrypted || 0)),
    encryptedContent: item.item_type === "text" ? item.text_ciphertext : "",
    filename: isFile ? item.display_filename : "",
    mimeType: isFile ? item.mime_type : "",
    sizeBytes: Number(item.size_bytes || 0),
    uploader: item.uploader_email ? maskEmail(item.uploader_email) : "",
    canDelete: Boolean(session && (session.user.role === "admin" || item.uploader_user_id === session.user.id)),
    createdAt: item.created_at,
    completedAt: item.completed_at,
    expiresAt: item.expires_at,
    fileUrl: isFile ? `/api/transfer/file/${encodeURIComponent(item.id)}?room=${encodeURIComponent(roomKey)}` : ""
  };
}

function fileResponseHeaders(item, forceDownload) {
  const mime = normalizeMimeType(item.mime_type);
  const inline = !forceDownload && !DANGEROUS_MIME_TYPES.has(mime)
    && (SAFE_INLINE_MIME_TYPES.has(mime) || SAFE_INLINE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)));
  const headers = new Headers({
    "Content-Type": inline ? mime : "application/octet-stream",
    "Content-Disposition": contentDisposition(item.display_filename, inline),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; sandbox"
  });
  return headers;
}

function contentDisposition(filename, inline) {
  const ascii = String(filename || "file")
    .replace(/[^\x20-\x7e]+/g, "_")
    .replace(/["\\;\r\n]/g, "_")
    .slice(0, 120) || "file";
  const encoded = encodeURIComponent(String(filename || "file")).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function parseSingleRange(header, totalSize) {
  if (!header) {
    return null;
  }
  if (header.includes(",")) {
    throw new TransferHttpError("暂不支持多个 Range。", 416, "TRANSFER_RANGE_INVALID");
  }
  const match = String(header).match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (!match[1] && !match[2])) {
    throw new TransferHttpError("Range 请求格式无效。", 416, "TRANSFER_RANGE_INVALID");
  }
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      throw new TransferHttpError("Range 请求超出文件范围。", 416, "TRANSFER_RANGE_INVALID");
    }
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : totalSize - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= totalSize || end < start) {
    throw new TransferHttpError("Range 请求超出文件范围。", 416, "TRANSFER_RANGE_INVALID");
  }
  end = Math.min(end, totalSize - 1);
  return { offset: start, length: end - start + 1 };
}

function objectKeyFor(itemId, now) {
  return `${TRANSFER_PREFIX}${now.slice(0, 10)}/${itemId}`;
}

async function audit(env, actorUserId, action, roomId, itemId, sizeBytes, mimeType) {
  await env.DB.prepare(`
    insert into transfer_audit_log (id, actor_user_id, action, room_id, item_id, size_bytes, mime_type, created_at)
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), actorUserId || "system", action, roomId || "", itemId || "", sizeBytes || 0, mimeType || "", nowIso()).run();
}

function maskEmail(value) {
  const [local, domain] = String(value || "").split("@");
  if (!domain) return "";
  return `${local.slice(0, 2)}***@${domain}`;
}

function safeErrorCode(error) {
  return error instanceof TransferHttpError ? error.code : String(error?.name || "transfer_error").slice(0, 80);
}

function transferJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin"
    }
  });
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const item of cookie.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return "";
      }
    }
  }
  return "";
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nowIso() {
  return new Date().toISOString();
}

function addHoursIso(hours) {
  return new Date(Date.now() + Number(hours) * 60 * 60 * 1000).toISOString();
}

function dateKey() {
  return nowIso().slice(0, 10);
}

function monthKey() {
  return nowIso().slice(0, 7);
}

function daysInMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

class TransferHttpError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "TransferHttpError";
    this.status = status;
    this.code = code;
  }
}

export const transferInternals = Object.freeze({
  DEFAULTS,
  ROOM_KEY_PATTERN,
  choosePartSize,
  contentDisposition,
  estimateR2Cost,
  expectedPartLength,
  itemTypeFromMime,
  normalizeFilename,
  normalizeMimeType,
  parseSingleRange
});
