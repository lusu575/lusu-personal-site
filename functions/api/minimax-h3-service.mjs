import {
  H3_AGENT_SCOPE,
  H3_DEFAULT_POLL_SECONDS,
  H3_HEARTBEAT_SECONDS,
  H3_LEASE_SECONDS,
  H3_MAX_ERROR_SUMMARY_LENGTH,
  H3_MAX_JSON_BYTES,
  H3_MAX_PAGE_SIZE,
  H3_MAX_RESULT_NAME_LENGTH,
  H3_OFFLINE_SECONDS,
  H3_PROTOCOL_VERSION,
  H3_TEMPLATE_VERSION,
  H3ProtocolError,
  H3_READY_STATES,
  assertObject,
  assertExactKeys,
  assertTransition,
  canonicalize,
  canonicalJobPayload,
  normalizeJobCreateRequest,
  normalizeOpaqueId,
  normalizeOperationId,
  normalizeOffset,
  normalizePageSize,
  normalizeRunnerHeartbeat,
  normalizeRunnerRegisterRequest,
  requireString,
  sha256Hex
} from "../../lib/minimax-h3/protocol.mjs";
import { MINIMAX_H3_SCHEMA_STATEMENTS } from "../../lib/minimax-h3/schema.mjs";

export { H3ProtocolError } from "../../lib/minimax-h3/protocol.mjs";

const H3_FEATURE_FLAG = "MINIMAX_H3_CONTROL_ENABLED";
const H3_TRANSFER_FEATURE_FLAG = "MINIMAX_H3_TRANSFER_ENABLED";
const H3_DEFAULT_BRIDGE_ORIGIN = "";
const H3_MAX_CAPABILITIES_JSON_BYTES = 8 * 1024;
const H3_MINUTE_MS = 60 * 1000;
const H3_TICKET_TTL_MS = 5 * H3_MINUTE_MS;

let h3SchemaReady = false;

export function isMinimaxH3ApiPath(parts) {
  return parts[0] === "admin" && parts[1] === "minimax-h3"
    || parts[0] === "agent" && parts[1] === "minimax-h3";
}

export async function ensureMinimaxH3Schema(env) {
  if (h3SchemaReady) return;
  await env.DB.batch(MINIMAX_H3_SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement)));
  h3SchemaReady = true;
}

export async function handleMinimaxH3Api({ request, env, parts, adminSession, agentPrincipal }) {
  if (!isMinimaxH3ApiPath(parts)) return null;
  const isAdminRoute = parts[0] === "admin";
  if (isAdminRoute) {
    if (!adminSession) throw new H3ProtocolError("MiniMax H3 admin session is required.", 401, "H3_ADMIN_AUTH_REQUIRED");
    await ensureMinimaxH3Schema(env);
    return await handleAdminApi(request, env, parts.slice(2), adminSession.user);
  }
  if (!agentPrincipal) {
    throw new H3ProtocolError("MiniMax H3 Agent authorization is required.", 401, "H3_AGENT_AUTH_REQUIRED");
  }
  await ensureMinimaxH3Schema(env);
  return await handleAgentApi(request, env, parts.slice(2), agentPrincipal);
}

async function handleAdminApi(request, env, parts, user) {
  if (request.method === "GET" && parts.length === 1 && parts[0] === "runners") {
    return json(await listRunners(env, user.id));
  }
  if (request.method === "GET" && parts.length === 1 && parts[0] === "jobs") {
    return json(await listJobs(request, env, user.id));
  }
  if (request.method === "POST" && parts.length === 1 && parts[0] === "jobs") {
    assertControlEnabled(env);
    return json(await createJob(request, env, user.id), 201);
  }
  if (parts[0] === "jobs" && parts[1]) {
    const jobId = normalizeOpaqueId(parts[1], "jobId", "job_");
    if (request.method === "POST" && parts[2] === "download-ticket" && parts.length === 3) {
      assertControlEnabled(env);
      assertTransferEnabled(env);
      return json(await issueDownloadTicket(request, env, user.id, jobId), 201);
    }
    if (request.method === "GET" && parts.length === 2) return json(await getJob(env, user.id, jobId));
    if (request.method === "POST" && parts[2] === "cancel" && parts.length === 3) {
      assertControlEnabled(env);
      return json(await cancelJob(request, env, user.id, jobId));
    }
  }
  throw new H3ProtocolError("MiniMax H3 admin endpoint not found.", 404, "H3_NOT_FOUND");
}

async function handleAgentApi(request, env, parts, principal) {
  await assertAgentPrincipal(principal, env);
  if (request.method === "POST" && parts.join("/") === "runners/register") {
    return json(await registerRunner(request, env, principal), 201);
  }
  if (request.method === "POST" && parts.join("/") === "runners/heartbeat") {
    return json(await heartbeatRunner(request, env, principal));
  }
  if (request.method === "POST" && parts.join("/") === "jobs/claim") {
    assertControlEnabled(env);
    const body = assertObject(await readJson(request), "claim request");
    if (Object.keys(body).some((key) => key !== "runnerId")) {
      throw new H3ProtocolError("Claim request contains unsupported fields.", 422, "H3_EXTRA_FIELDS");
    }
    const runnerId = normalizeOpaqueId(body.runnerId, "runnerId", "runner_");
    const result = await claimJob(env, principal, runnerId);
    return result ? json(result) : new Response(null, { status: 204, headers: securityHeaders() });
  }
  if (request.method === "POST" && parts.join("/") === "transfers/introspect") {
    assertTransferEnabled(env);
    return json(await introspectTransferTicket(request, env, principal));
  }
  if (request.method === "POST" && parts[0] === "jobs" && parts[1] && parts[2] === "events" && parts.length === 3) {
    assertControlEnabled(env);
    return json(await recordRunnerEvent(request, env, principal, normalizeOpaqueId(parts[1], "jobId", "job_")));
  }
  if (request.method === "POST" && parts[0] === "jobs" && parts[1] && parts[2] === "complete" && parts.length === 3) {
    assertControlEnabled(env);
    return json(await completeJob(request, env, principal, normalizeOpaqueId(parts[1], "jobId", "job_")));
  }
  if (request.method === "POST" && parts[0] === "jobs" && parts[1] && parts[2] === "fail" && parts.length === 3) {
    assertControlEnabled(env);
    return json(await failJob(request, env, principal, normalizeOpaqueId(parts[1], "jobId", "job_")));
  }
  throw new H3ProtocolError("MiniMax H3 Agent endpoint not found.", 404, "H3_NOT_FOUND");
}

async function registerRunner(request, env, principal) {
  const body = normalizeRunnerRegisterRequest(await readJson(request));
  const now = nowIso();
  const installationIdHash = await sha256Hex(`minimax-h3-installation:${body.installationId}`);
  const requestedRunnerId = body.runnerId || "";
  const generatedRunnerId = `runner_${crypto.randomUUID()}`;
  const existing = await env.DB.prepare(`
    select runner_id, owner_user_id, status, installation_id_hash
    from minimax_h3_runners
    where (runner_id = ? and ? <> '') or (owner_user_id = ? and installation_id_hash = ?)
    order by runner_id asc
    limit 1
  `).bind(requestedRunnerId, requestedRunnerId, principal.user.id, installationIdHash).first();
  const runnerId = existing?.runner_id || requestedRunnerId || generatedRunnerId;
  if (existing && existing.owner_user_id !== principal.user.id) {
    throw new H3ProtocolError("Runner is owned by another account.", 403, "H3_RUNNER_OWNER_MISMATCH");
  }
  if (existing && existing.status !== "active") {
    throw new H3ProtocolError("H3 runner is disabled.", 403, "H3_RUNNER_DISABLED");
  }
  const capabilitiesJson = boundedJson(body.capabilities, H3_MAX_CAPABILITIES_JSON_BYTES);
  if (existing) {
    await env.DB.prepare(`
      update minimax_h3_runners
      set installation_id_hash = ?, label = ?, protocol_version = ?, agent_version = ?, controller_version = ?,
          capabilities_json = ?, ready_state = 'agent_only', last_seen_at = ?, last_persisted_heartbeat_at = ?,
          current_token_id = ?, revision = revision + 1, updated_at = ?
      where runner_id = ? and owner_user_id = ? and status = 'active'
    `).bind(
      installationIdHash,
      body.label,
      body.protocolVersion,
      body.agentVersion,
      body.controllerVersion,
      capabilitiesJson,
      now,
      now,
      principal.tokenId,
      now,
      runnerId,
      principal.user.id
    ).run();
  } else {
    try {
      await env.DB.prepare(`
        insert into minimax_h3_runners (
          runner_id, owner_user_id, installation_id_hash, label, status, protocol_version, agent_version,
          controller_version, capabilities_json, ready_state, busy_job_id, current_token_id, last_seen_at,
          last_persisted_heartbeat_at, revision, created_at, updated_at
        ) values (?, ?, ?, ?, 'active', ?, ?, ?, ?, 'agent_only', '', ?, ?, ?, 0, ?, ?)
      `).bind(
        runnerId,
        principal.user.id,
        installationIdHash,
        body.label,
        body.protocolVersion,
        body.agentVersion,
        body.controllerVersion,
        capabilitiesJson,
        principal.tokenId,
        now,
        now,
        now,
        now
      ).run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new H3ProtocolError("This installation is already registered.", 409, "H3_RUNNER_ALREADY_REGISTERED");
      }
      throw error;
    }
  }
  return {
    runnerId,
    protocolVersion: H3_PROTOCOL_VERSION,
    pollSeconds: H3_DEFAULT_POLL_SECONDS,
    heartbeatSeconds: H3_HEARTBEAT_SECONDS,
    leaseSeconds: H3_LEASE_SECONDS,
    bridgeOrigin: configuredBridgeOrigin(env),
    featureEnabled: controlEnabled(env),
    transferEnabled: transferEnabled(env)
  };
}

async function heartbeatRunner(request, env, principal) {
  const body = normalizeRunnerHeartbeat(await readJson(request));
  const now = nowIso();
  const runner = await getOwnedRunner(env, principal, body.runnerId);
  const heartbeatCapabilities = {
    ...(body.capabilities || {}),
    bridgeOnline: body.bridgeOnline,
    comfyReachable: body.comfyReachable,
    ...(body.diskFreeBytes === null ? {} : { diskFreeBytes: body.diskFreeBytes })
  };
  const capabilitiesJson = boundedJson(heartbeatCapabilities, H3_MAX_CAPABILITIES_JSON_BYTES);
  const readyState = body.busyJobId ? "busy" : body.readyState;
  const result = await env.DB.prepare(`
    update minimax_h3_runners
    set ready_state = ?, busy_job_id = ?, last_seen_at = ?,
        last_persisted_heartbeat_at = ?, current_token_id = ?,
    capabilities_json = ?, revision = revision + 1, updated_at = ?
    where runner_id = ? and owner_user_id = ? and status = 'active'
  `).bind(
    readyState,
    body.busyJobId,
    now,
    now,
    principal.tokenId,
    capabilitiesJson,
    now,
    runner.runner_id,
    principal.user.id
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    throw new H3ProtocolError("Runner heartbeat lost ownership.", 409, "H3_RUNNER_CONFLICT");
  }
  let leaseRenewed = false;
  if (body.busyJobId) {
    const leaseExpiresAt = new Date(Date.now() + H3_LEASE_SECONDS * 1000).toISOString();
    const leaseResult = await env.DB.prepare(`
      update minimax_h3_jobs
      set lease_expires_at = ?, updated_at = ?
      where job_id = ? and runner_id = ? and owner_user_id = ?
        and lease_token_id = ? and lease_expires_at > ?
        and state in ('leased', 'validating', 'submitted', 'running', 'retrieving')
    `).bind(
      leaseExpiresAt,
      now,
      body.busyJobId,
      runner.runner_id,
      principal.user.id,
      principal.tokenId,
      now
    ).run();
    leaseRenewed = Number(leaseResult.meta?.changes || 0) === 1;
    if (!leaseRenewed) {
      throw new H3ProtocolError("Runner lease could not be renewed.", 409, "H3_LEASE_CONFLICT");
    }
  }
  return {
    runnerId: runner.runner_id,
    readyState,
    offlineAfterSeconds: H3_OFFLINE_SECONDS,
    serverTime: now,
    featureEnabled: controlEnabled(env),
    leaseRenewed
  };
}

async function listRunners(env, userId) {
  const rows = (await env.DB.prepare(`
    select runner_id, label, status, protocol_version, agent_version, controller_version,
           capabilities_json, ready_state, busy_job_id, last_seen_at, last_persisted_heartbeat_at,
           revision, created_at, updated_at
    from minimax_h3_runners
    where owner_user_id = ?
    order by updated_at desc
    limit ?
  `).bind(userId, H3_MAX_PAGE_SIZE).all()).results || [];
  const now = Date.now();
  return {
    protocolVersion: H3_PROTOCOL_VERSION,
    controlEnabled: controlEnabled(env),
    transferEnabled: transferEnabled(env),
    runners: rows.map((row) => ({
      runnerId: row.runner_id,
      label: row.label,
      status: row.status,
      protocolVersion: row.protocol_version,
      agentVersion: row.agent_version,
      controllerVersion: row.controller_version,
      capabilities: parseJsonObject(row.capabilities_json),
      readyState: offlineReadyState(row, now),
      busyJobId: row.busy_job_id || "",
      lastSeenAt: row.last_seen_at,
      lastPersistedHeartbeatAt: row.last_persisted_heartbeat_at,
      revision: Number(row.revision || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

async function listJobs(request, env, userId) {
  const url = new URL(request.url);
  const pageSize = normalizePageSize(url.searchParams.get("pageSize"));
  const offset = normalizeOffset(url.searchParams.get("offset"));
  const rows = (await env.DB.prepare(`
    select job_id, runner_id, operation_id, state, revision, attempt, stage_code,
           progress_basis_points, error_code, error_summary, result_available, result_name,
           result_mime, result_bytes, result_sha256, retain_until, created_at, queued_at,
           claimed_at, started_at, finished_at, updated_at
    from minimax_h3_jobs
    where owner_user_id = ?
    order by created_at desc
    limit ? offset ?
  `).bind(userId, pageSize, offset).all()).results || [];
  return {
    protocolVersion: H3_PROTOCOL_VERSION,
    templateVersion: H3_TEMPLATE_VERSION,
    controlEnabled: controlEnabled(env),
    pageSize,
    offset,
    jobs: rows.map(publicJob)
  };
}

export function assertMvpJobRequest(normalized) {
  if (normalized.job.mode !== "t2v" || normalized.job.references.length > 0) {
    throw new H3ProtocolError(
      "The current MiniMax H3 MVP only accepts text-to-video jobs without reference assets.",
      409,
      "H3_PHASE_NOT_OPEN"
    );
  }
}

async function getJob(env, userId, jobId) {
  const row = await env.DB.prepare(`
    select job_id, runner_id, operation_id, state, revision, attempt, stage_code,
           progress_basis_points, error_code, error_summary, result_available, result_name,
           result_mime, result_bytes, result_sha256, retain_until, created_at, queued_at,
           claimed_at, started_at, finished_at, updated_at
    from minimax_h3_jobs
    where job_id = ? and owner_user_id = ?
    limit 1
  `).bind(jobId, userId).first();
  if (!row) throw new H3ProtocolError("H3 job was not found.", 404, "H3_JOB_NOT_FOUND");
  const events = (await env.DB.prepare(`
    select seq, actor_type, actor_ref, event_type, from_state, to_state, code, summary, created_at
    from minimax_h3_job_events
    where job_id = ?
    order by seq asc
    limit 200
  `).bind(jobId).all()).results || [];
  return { job: publicJob(row), events };
}

async function createJob(request, env, userId) {
  const body = await readJson(request);
  const normalized = normalizeJobCreateRequest(body);
  assertMvpJobRequest(normalized);
  const payload = canonicalJobPayload(normalized);
  const payloadSha256 = await sha256Hex(payload);
  const promptSha256 = await sha256Hex(normalized.job.prompt);
  const existingReceipt = await env.DB.prepare(`
    select action, payload_sha256, response_json
    from minimax_h3_operation_receipts
    where actor_type = 'admin' and actor_ref = ? and operation_id = ?
    limit 1
  `).bind(userId, normalized.operationId).first();
  if (existingReceipt) {
    if (existingReceipt.action !== "job.create" || existingReceipt.payload_sha256 !== payloadSha256) {
      throw new H3ProtocolError("operationId was already used with a different payload.", 409, "OPERATION_ID_CONFLICT");
    }
    return { ...JSON.parse(existingReceipt.response_json), duplicate: true };
  }

  const runner = await getOwnedRunner(env, { user: { id: userId } }, normalized.runnerId);
  const now = nowIso();
  const jobId = `job_${crypto.randomUUID()}`;
  const state = normalized.job.references.length ? "awaiting_assets" : "queued";
  const response = {
    job: {
      jobId,
      runnerId: normalized.runnerId,
      operationId: normalized.operationId,
      state,
      revision: 0,
      attempt: 1,
      protocolVersion: H3_PROTOCOL_VERSION,
      templateVersion: H3_TEMPLATE_VERSION,
      createdAt: now
    },
    duplicate: false
  };
  const eventSummary = state === "queued" ? "Job created and queued." : "Job created; waiting for declared assets.";
  await env.DB.batch([
    env.DB.prepare(`
      insert into minimax_h3_jobs (
        job_id, owner_user_id, runner_id, operation_id, payload_sha256, protocol_version, template_version,
        spec_json, prompt_sha256, state, revision, attempt, stage_code, progress_basis_points,
        created_at, queued_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, 0, ?, ?, ?)
    `).bind(
      jobId,
      userId,
      runner.runner_id,
      normalized.operationId,
      payloadSha256,
      H3_PROTOCOL_VERSION,
      H3_TEMPLATE_VERSION,
      payload,
      promptSha256,
      state,
      state === "queued" ? "queued" : "awaiting_assets",
      state === "queued" ? now : "",
      now
    ),
    env.DB.prepare(`
      insert into minimax_h3_job_events (
        event_id, job_id, seq, actor_type, actor_ref, event_type, from_state, to_state, code, summary, created_at
      ) values (?, ?, 1, 'admin', ?, 'job.created', '', ?, '', ?, ?)
    `).bind(crypto.randomUUID(), jobId, userId, state, eventSummary, now),
    env.DB.prepare(`
      insert into minimax_h3_operation_receipts (
        receipt_id, actor_type, actor_ref, operation_id, action, payload_sha256, response_json, created_at
      ) values (?, 'admin', ?, ?, 'job.create', ?, ?, ?)
    `).bind(crypto.randomUUID(), userId, normalized.operationId, payloadSha256, JSON.stringify(response), now)
  ]);
  return response;
}

async function issueDownloadTicket(request, env, userId, jobId) {
  const body = assertExactKeys(await readJson(request), ["operationId"], "download ticket request");
  const operationId = normalizeOperationId(body.operationId);
  const operationPayload = canonicalize({ action: "job.download-ticket", jobId, operationId });
  const payloadSha256 = await sha256Hex(operationPayload);
  const existingReceipt = await env.DB.prepare(`
    select payload_sha256, response_json
    from minimax_h3_operation_receipts
    where actor_type = 'admin' and actor_ref = ? and operation_id = ? and action = 'job.download-ticket'
    limit 1
  `).bind(userId, operationId).first();
  if (existingReceipt) {
    if (existingReceipt.payload_sha256 !== payloadSha256) {
      throw new H3ProtocolError("operationId was already used with a different payload.", 409, "OPERATION_ID_CONFLICT");
    }
    throw new H3ProtocolError(
      "The previous ticket response cannot be replayed. Request a new ticket with a new operationId.",
      409,
      "H3_TICKET_REPLAY_UNAVAILABLE"
    );
  }

  const row = await env.DB.prepare(`
    select job_id, runner_id, state, result_available, result_name, result_mime,
           result_bytes, result_sha256, retain_until
    from minimax_h3_jobs
    where job_id = ? and owner_user_id = ?
    limit 1
  `).bind(jobId, userId).first();
  if (!row) throw new H3ProtocolError("H3 job was not found.", 404, "H3_JOB_NOT_FOUND");
  if (row.state !== "ready" || Number(row.result_available || 0) !== 1 || !row.result_name || !row.result_sha256) {
    throw new H3ProtocolError("This H3 job has no downloadable result.", 409, "H3_RESULT_NOT_READY");
  }
  if (row.retain_until && row.retain_until <= nowIso()) {
    throw new H3ProtocolError("This H3 result has expired.", 410, "H3_RESULT_EXPIRED");
  }
  const bridgeOrigin = configuredBridgeOrigin(env);
  if (!bridgeOrigin) throw new H3ProtocolError("H3 Bridge origin is not configured.", 503, "H3_BRIDGE_NOT_CONFIGURED");

  const now = nowIso();
  const expiresAt = new Date(Date.now() + H3_TICKET_TTL_MS).toISOString();
  const ticketId = `ticket_${crypto.randomUUID()}`;
  const secret = randomTicketSecret();
  const ticketResponse = {
    ticketId,
    jobId,
    bridgeOrigin,
    expiresAt,
    result: {
      name: row.result_name,
      mime: row.result_mime,
      bytes: Number(row.result_bytes || 0),
      sha256: row.result_sha256
    }
  };
  const receiptResponse = { ...ticketResponse, secret: undefined };
  delete receiptResponse.secret;
  try {
    await env.DB.batch([
      env.DB.prepare(`
        insert into minimax_h3_transfer_tickets (
          ticket_id, owner_user_id, runner_id, job_id, asset_id, direction,
          secret_sha256, allowed_methods_json, max_bytes, status, expires_at,
          consumed_at, created_at, consumed_by_token_id
        ) values (?, ?, ?, ?, '', 'download', ?, ?, ?, 'issued', ?, '', ?, '')
      `).bind(
        ticketId,
        userId,
        row.runner_id,
        row.job_id,
        await sha256Hex(secret),
        JSON.stringify(["HEAD", "GET"]),
        Number(row.result_bytes || 0),
        expiresAt,
        now
      ),
      env.DB.prepare(`
        insert into minimax_h3_operation_receipts (
          receipt_id, actor_type, actor_ref, operation_id, action, payload_sha256, response_json, created_at
        ) values (?, 'admin', ?, ?, 'job.download-ticket', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        userId,
        operationId,
        payloadSha256,
        JSON.stringify(receiptResponse),
        now
      )
    ]);
  } catch (error) {
    if (/unique constraint|constraint failed/iu.test(String(error?.message || error))) {
      throw new H3ProtocolError("The download ticket request conflicted with another request. Retry with a new operationId.", 409, "H3_TICKET_CONFLICT");
    }
    throw error;
  }
  return { ...ticketResponse, secret };
}

async function introspectTransferTicket(request, env, principal) {
  const body = assertExactKeys(await readJson(request), ["ticketId", "secret", "runnerId"], "transfer introspection request");
  const ticketId = normalizeOpaqueId(body.ticketId, "ticketId", "ticket_");
  const secret = requireString(body.secret, "secret", { min: 24, max: 200, pattern: /^h3t_[A-Za-z0-9_-]{20,180}$/u });
  const runnerId = normalizeOpaqueId(body.runnerId, "runnerId", "runner_");
  const row = await env.DB.prepare(`
    select t.ticket_id, t.runner_id, t.job_id, t.direction, t.secret_sha256, t.allowed_methods_json,
           t.max_bytes, t.status, t.expires_at, j.state, j.result_name, j.result_mime,
           j.result_bytes, j.result_sha256, j.retain_until
    from minimax_h3_transfer_tickets t
    join minimax_h3_jobs j on j.job_id = t.job_id
    where t.ticket_id = ? and t.owner_user_id = ? and t.runner_id = ?
    limit 1
  `).bind(ticketId, principal.user.id, runnerId).first();
  if (!row || row.status !== "issued" || row.direction !== "download" || row.state !== "ready" || row.expires_at <= nowIso()) {
    throw new H3ProtocolError("H3 transfer ticket is unavailable.", 409, "H3_TICKET_UNAVAILABLE");
  }
  if (row.secret_sha256 && row.secret_sha256 !== await sha256Hex(secret)) {
    throw new H3ProtocolError("H3 transfer ticket is unavailable.", 409, "H3_TICKET_UNAVAILABLE");
  }
  const now = nowIso();
  const consumed = await env.DB.prepare(`
    update minimax_h3_transfer_tickets
    set status = 'consumed', consumed_at = ?, consumed_by_token_id = ?
    where ticket_id = ? and owner_user_id = ? and runner_id = ?
      and direction = 'download' and status = 'issued' and expires_at > ? and secret_sha256 = ?
  `).bind(now, principal.tokenId, ticketId, principal.user.id, runnerId, now, row.secret_sha256).run();
  if (Number(consumed.meta?.changes || 0) !== 1) {
    throw new H3ProtocolError("H3 transfer ticket has already been consumed.", 409, "H3_TICKET_CONSUMED");
  }
  return {
    ticketId,
    jobId: row.job_id,
    direction: row.direction,
    allowedMethods: parseAllowedMethods(row.allowed_methods_json),
    maxBytes: Number(row.max_bytes || 0),
    expiresAt: row.expires_at,
    result: {
      name: row.result_name,
      mime: row.result_mime,
      bytes: Number(row.result_bytes || 0),
      sha256: row.result_sha256
    },
    retainUntil: row.retain_until || ""
  };
}

async function cancelJob(request, env, userId, jobId) {
  const body = await readJson(request);
  if (Object.keys(body).some((key) => key !== "operationId")) {
    throw new H3ProtocolError("Cancel request contains unsupported fields.", 422, "H3_EXTRA_FIELDS");
  }
  const operationId = normalizeOperationId(body.operationId);
  const operationPayload = canonicalize({ jobId, operationId });
  const payloadSha256 = await sha256Hex(operationPayload);
  const existingReceipt = await env.DB.prepare(`
    select payload_sha256, response_json
    from minimax_h3_operation_receipts
    where actor_type = 'admin' and actor_ref = ? and operation_id = ? and action = 'job.cancel'
    limit 1
  `).bind(userId, operationId).first();
  if (existingReceipt) {
    if (existingReceipt.payload_sha256 !== payloadSha256) {
      throw new H3ProtocolError("operationId was already used with a different payload.", 409, "OPERATION_ID_CONFLICT");
    }
    return { ...JSON.parse(existingReceipt.response_json), duplicate: true };
  }
  const row = await env.DB.prepare(`
    select job_id, runner_id, state, revision
    from minimax_h3_jobs
    where job_id = ? and owner_user_id = ?
    limit 1
  `).bind(jobId, userId).first();
  if (!row) throw new H3ProtocolError("H3 job was not found.", 404, "H3_JOB_NOT_FOUND");
  if (!["awaiting_assets", "queued"].includes(row.state)) {
    throw new H3ProtocolError("This H3 job cannot be safely cancelled in its current state.", 409, "H3_CANCEL_NOT_ENABLED");
  }
  const now = nowIso();
  const result = await env.DB.prepare(`
    update minimax_h3_jobs
    set state = 'cancelled', revision = revision + 1, finished_at = ?, updated_at = ?
    where job_id = ? and owner_user_id = ? and revision = ? and state = ?
  `).bind(now, now, jobId, userId, Number(row.revision || 0), row.state).run();
  if (Number(result.meta?.changes || 0) !== 1) throw new H3ProtocolError("H3 job changed; refresh and retry.", 409, "H3_JOB_CONFLICT");
  await appendEvent(env, {
    jobId,
    actorType: "admin",
    actorRef: userId,
    eventType: "job.cancelled",
    fromState: row.state,
    toState: "cancelled",
    summary: "Job cancelled by administrator.",
    createdAt: now
  });
  const response = { jobId, state: "cancelled", operationId, duplicate: false };
  try {
    await env.DB.prepare(`
      insert into minimax_h3_operation_receipts (
        receipt_id, actor_type, actor_ref, operation_id, action, payload_sha256, response_json, created_at
      ) values (?, 'admin', ?, ?, 'job.cancel', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      operationId,
      payloadSha256,
      JSON.stringify(response),
      now
    ).run();
  } catch (error) {
    const replay = await env.DB.prepare(`
      select payload_sha256, response_json
      from minimax_h3_operation_receipts
      where actor_type = 'admin' and actor_ref = ? and operation_id = ? and action = 'job.cancel'
      limit 1
    `).bind(userId, operationId).first();
    if (!replay) throw error;
    if (replay.payload_sha256 !== payloadSha256) {
      throw new H3ProtocolError("operationId was already used with a different payload.", 409, "OPERATION_ID_CONFLICT");
    }
    return { ...JSON.parse(replay.response_json), duplicate: true };
  }
  return response;
}

async function claimJob(env, principal, runnerId) {
  const runner = await getOwnedRunner(env, principal, runnerId);
  if (runner.ready_state === "busy" || runner.busy_job_id) {
    throw new H3ProtocolError("Runner already has a job.", 409, "H3_RUNNER_BUSY");
  }
  const queued = await env.DB.prepare(`
    select job_id, owner_user_id, runner_id, state, revision, lease_generation, spec_json
    from minimax_h3_jobs
    where runner_id = ? and state = 'queued'
    order by created_at asc
    limit 1
  `).bind(runner.runner_id).first();
  if (!queued) return null;
  const leaseId = `lease_${crypto.randomUUID()}`;
  const leaseExpiresAt = new Date(Date.now() + H3_LEASE_SECONDS * 1000).toISOString();
  const now = nowIso();
  const leaseGeneration = Number(queued.lease_generation || 0) + 1;
  const result = await env.DB.prepare(`
    update minimax_h3_jobs
    set state = 'leased', revision = revision + 1, lease_id_hash = ?, lease_generation = ?,
        lease_token_id = ?, lease_expires_at = ?, claimed_at = ?, updated_at = ?
    where job_id = ? and runner_id = ? and state = 'queued' and revision = ?
  `).bind(
    await sha256Hex(leaseId),
    leaseGeneration,
    principal.tokenId,
    leaseExpiresAt,
    now,
    now,
    queued.job_id,
    runner.runner_id,
    Number(queued.revision || 0)
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) return null;
  await env.DB.prepare(`
    update minimax_h3_runners
    set ready_state = 'busy', busy_job_id = ?, current_token_id = ?, revision = revision + 1, updated_at = ?
    where runner_id = ? and owner_user_id = ? and status = 'active'
  `).bind(queued.job_id, principal.tokenId, now, runner.runner_id, principal.user.id).run();
  await appendEvent(env, {
    jobId: queued.job_id,
    actorType: "runner",
    actorRef: runner.runner_id,
    eventType: "job.leased",
    fromState: "queued",
    toState: "leased",
    summary: "Job leased to the local Runner.",
    createdAt: now
  });
  return {
    jobId: queued.job_id,
    runnerId: runner.runner_id,
    leaseId,
    leaseGeneration,
    leaseExpiresAt,
    revision: Number(queued.revision || 0) + 1,
    spec: JSON.parse(queued.spec_json)
  };
}

async function recordRunnerEvent(request, env, principal, jobId) {
  const body = assertObject(await readJson(request), "runner event");
  const allowed = ["runnerId", "leaseId", "leaseGeneration", "expectedRevision", "eventType", "toState", "stageCode", "progressBasisPoints", "summary"];
  const unexpected = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new H3ProtocolError(`Unsupported event fields: ${unexpected.join(", ")}.`, 422, "H3_EXTRA_FIELDS");
  const toState = typeof body.toState === "string" ? body.toState : "";
  const eventType = typeof body.eventType === "string" ? body.eventType : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (!eventType || eventType.length > 80 || !summary || summary.length > H3_MAX_ERROR_SUMMARY_LENGTH) {
    throw new H3ProtocolError("Runner event is invalid.", 422, "H3_EVENT_INVALID");
  }
  const job = await loadLeasedJob(env, principal, jobId, body.runnerId, body);
  assertTransition(job.state, toState);
  const now = nowIso();
  const updated = await env.DB.prepare(`
    update minimax_h3_jobs
    set state = ?, revision = revision + 1, stage_code = ?, progress_basis_points = ?,
        started_at = case when ? = 'validating' and started_at = '' then ? else started_at end,
        updated_at = ?
    where job_id = ? and runner_id = ? and state = ? and revision = ?
      and lease_generation = ? and lease_token_id = ? and lease_expires_at > ?
  `).bind(
    toState,
    body.stageCode ? String(body.stageCode).slice(0, 80) : "",
    Number.isInteger(body.progressBasisPoints) ? Math.max(0, Math.min(10000, body.progressBasisPoints)) : 0,
    toState,
    now,
    now,
    jobId,
    job.runner_id,
    job.state,
    job.revision,
    job.lease_generation,
    principal.tokenId,
    now
  ).run();
  if (Number(updated.meta?.changes || 0) !== 1) throw new H3ProtocolError("Runner lease or revision is stale.", 409, "H3_LEASE_CONFLICT");
  await appendEvent(env, { jobId, actorType: "runner", actorRef: job.runner_id, eventType, fromState: job.state, toState, summary, createdAt: now });
  return { jobId, state: toState, revision: Number(job.revision) + 1 };
}

async function completeJob(request, env, principal, jobId) {
  const body = assertObject(await readJson(request), "completion");
  const allowed = ["runnerId", "leaseId", "leaseGeneration", "expectedRevision", "resultName", "resultMime", "resultBytes", "resultSha256"];
  const unexpected = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new H3ProtocolError(`Unsupported completion fields: ${unexpected.join(", ")}.`, 422, "H3_EXTRA_FIELDS");
  const job = await loadLeasedJob(env, principal, jobId, body.runnerId, body);
  if (job.state !== "retrieving") throw new H3ProtocolError("H3 job is not retrieving an output.", 409, "H3_STATE_INVALID");
  const resultName = typeof body.resultName === "string" && body.resultName.length <= H3_MAX_RESULT_NAME_LENGTH && !/[\\/\u0000-\u001f]/u.test(body.resultName)
    ? body.resultName
    : "";
  const resultMime = typeof body.resultMime === "string" && /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/iu.test(body.resultMime)
    ? body.resultMime.toLowerCase()
    : "";
  const resultBytes = Number.isSafeInteger(body.resultBytes) && body.resultBytes >= 0 ? body.resultBytes : -1;
  const resultSha256 = typeof body.resultSha256 === "string" && /^[0-9a-f]{64}$/u.test(body.resultSha256) ? body.resultSha256 : "";
  if (!resultName || !resultMime || resultBytes < 0 || !resultSha256) throw new H3ProtocolError("Output summary is invalid.", 422, "H3_RESULT_INVALID");
  const now = nowIso();
  const updated = await env.DB.prepare(`
    update minimax_h3_jobs
    set state = 'ready', revision = revision + 1, result_available = 1, result_name = ?, result_mime = ?,
        result_bytes = ?, result_sha256 = ?, finished_at = ?, retain_until = ?, updated_at = ?
    where job_id = ? and runner_id = ? and state = 'retrieving' and revision = ?
      and lease_generation = ? and lease_token_id = ? and lease_expires_at > ?
  `).bind(
    resultName,
    resultMime,
    resultBytes,
    resultSha256,
    now,
    new Date(Date.now() + 24 * 60 * H3_MINUTE_MS).toISOString(),
    now,
    jobId,
    job.runner_id,
    job.revision,
    job.lease_generation,
    principal.tokenId,
    now
  ).run();
  if (Number(updated.meta?.changes || 0) !== 1) throw new H3ProtocolError("Runner lease or revision is stale.", 409, "H3_LEASE_CONFLICT");
  await clearRunnerBusy(env, job.runner_id, job.owner_user_id, now);
  await appendEvent(env, { jobId, actorType: "runner", actorRef: job.runner_id, eventType: "job.ready", fromState: "retrieving", toState: "ready", summary: "Output summary verified by the local Runner.", createdAt: now });
  return { jobId, state: "ready", revision: Number(job.revision) + 1, result: { name: resultName, mime: resultMime, bytes: resultBytes, sha256: resultSha256 } };
}

async function failJob(request, env, principal, jobId) {
  const body = assertObject(await readJson(request), "failure");
  const allowed = ["runnerId", "leaseId", "leaseGeneration", "expectedRevision", "errorCode", "errorSummary"];
  const unexpected = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new H3ProtocolError(`Unsupported failure fields: ${unexpected.join(", ")}.`, 422, "H3_EXTRA_FIELDS");
  const job = await loadLeasedJob(env, principal, jobId, body.runnerId, body);
  if (!["leased", "validating", "running", "retrieving"].includes(job.state)) throw new H3ProtocolError("H3 job cannot be failed from this state.", 409, "H3_STATE_INVALID");
  assertTransition(job.state, "failed");
  const errorCode = typeof body.errorCode === "string" && /^[A-Z0-9_]{3,80}$/u.test(body.errorCode) ? body.errorCode : "H3_RUNNER_FAILURE";
  const errorSummary = typeof body.errorSummary === "string" ? body.errorSummary.trim().slice(0, H3_MAX_ERROR_SUMMARY_LENGTH) : "H3 Runner reported a failure.";
  const now = nowIso();
  const updated = await env.DB.prepare(`
    update minimax_h3_jobs
    set state = 'failed', revision = revision + 1, error_code = ?, error_summary = ?, finished_at = ?, updated_at = ?
    where job_id = ? and runner_id = ? and state = ? and revision = ?
      and lease_generation = ? and lease_token_id = ? and lease_expires_at > ?
  `).bind(errorCode, errorSummary, now, now, jobId, job.runner_id, job.state, job.revision, job.lease_generation, principal.tokenId, now).run();
  if (Number(updated.meta?.changes || 0) !== 1) throw new H3ProtocolError("Runner lease or revision is stale.", 409, "H3_LEASE_CONFLICT");
  await clearRunnerBusy(env, job.runner_id, job.owner_user_id, now);
  await appendEvent(env, { jobId, actorType: "runner", actorRef: job.runner_id, eventType: "job.failed", fromState: job.state, toState: "failed", code: errorCode, summary: errorSummary, createdAt: now });
  return { jobId, state: "failed", errorCode, revision: Number(job.revision) + 1 };
}

async function loadLeasedJob(env, principal, jobId, runnerIdValue, body) {
  const leaseId = typeof body.leaseId === "string" ? body.leaseId : "";
  const leaseGeneration = Number.isInteger(body.leaseGeneration) ? body.leaseGeneration : -1;
  const expectedRevision = Number.isInteger(body.expectedRevision) ? body.expectedRevision : -1;
  const runnerId = normalizeOpaqueId(runnerIdValue, "runnerId", "runner_");
  if (!leaseId || leaseGeneration < 1 || expectedRevision < 1) throw new H3ProtocolError("Lease and revision are required.", 422, "H3_LEASE_REQUIRED");
  const row = await env.DB.prepare(`
    select job_id, owner_user_id, runner_id, state, revision, lease_id_hash, lease_generation, lease_token_id, lease_expires_at
    from minimax_h3_jobs
    where job_id = ? and runner_id = ?
    limit 1
  `).bind(jobId, runnerId).first();
  if (!row) throw new H3ProtocolError("H3 job was not found.", 404, "H3_JOB_NOT_FOUND");
  if (row.lease_token_id !== principal.tokenId || Number(row.lease_generation) !== leaseGeneration || Number(row.revision) !== expectedRevision || row.lease_expires_at <= nowIso()) {
    throw new H3ProtocolError("Runner lease or revision is stale.", 409, "H3_LEASE_CONFLICT");
  }
  if (row.lease_id_hash !== await sha256Hex(leaseId)) {
    throw new H3ProtocolError("Runner lease is invalid.", 409, "H3_LEASE_CONFLICT");
  }
  return row;
}

async function getOwnedRunner(env, principal, runnerId) {
  if (!runnerId) throw new H3ProtocolError("runnerId is required.", 422, "H3_RUNNER_REQUIRED");
  const row = await env.DB.prepare(`
    select runner_id, owner_user_id, status, ready_state, busy_job_id, revision
    from minimax_h3_runners
    where runner_id = ? and owner_user_id = ?
    limit 1
  `).bind(runnerId, principal.user.id).first();
  if (!row) throw new H3ProtocolError("H3 runner was not found.", 404, "H3_RUNNER_NOT_FOUND");
  if (row.status !== "active") throw new H3ProtocolError("H3 runner is disabled.", 403, "H3_RUNNER_DISABLED");
  return row;
}

async function assertAgentPrincipal(principal, env) {
  if (!principal?.scopes?.includes(H3_AGENT_SCOPE) || !principal.user?.id || !principal.tokenId) {
    throw new H3ProtocolError("MiniMax H3 Agent scope or runner binding is missing.", 403, "H3_AGENT_SCOPE_REQUIRED");
  }
  const user = await env.DB.prepare("select role from users where id = ? limit 1").bind(principal.user.id).first();
  if (String(user?.role || "").toLowerCase() !== "admin") {
    throw new H3ProtocolError("MiniMax H3 Agent requires an administrator account.", 403, "H3_ADMIN_REQUIRED");
  }
}

async function clearRunnerBusy(env, runnerId, ownerUserId, now) {
  await env.DB.prepare(`
    update minimax_h3_runners
    set ready_state = 'ready', busy_job_id = '', revision = revision + 1, updated_at = ?
    where runner_id = ? and owner_user_id = ? and status = 'active'
  `).bind(now, runnerId, ownerUserId).run();
}

async function appendEvent(env, { jobId, actorType, actorRef, eventType, fromState, toState, code = "", summary, createdAt }) {
  const seqRow = await env.DB.prepare("select coalesce(max(seq), 0) + 1 as next_seq from minimax_h3_job_events where job_id = ?").bind(jobId).first();
  await env.DB.prepare(`
    insert into minimax_h3_job_events (event_id, job_id, seq, actor_type, actor_ref, event_type, from_state, to_state, code, summary, created_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), jobId, Number(seqRow?.next_seq || 1), actorType, actorRef, eventType, fromState, toState, code, summary.slice(0, H3_MAX_ERROR_SUMMARY_LENGTH), createdAt).run();
}

function publicJob(row) {
  return {
    jobId: row.job_id,
    runnerId: row.runner_id,
    operationId: row.operation_id,
    state: row.state,
    revision: Number(row.revision || 0),
    attempt: Number(row.attempt || 1),
    stageCode: row.stage_code || "",
    progressBasisPoints: Number(row.progress_basis_points || 0),
    errorCode: row.error_code || "",
    errorSummary: row.error_summary || "",
    result: Number(row.result_available || 0) === 1 ? {
      name: row.result_name || "",
      mime: row.result_mime || "",
      bytes: Number(row.result_bytes || 0),
      sha256: row.result_sha256 || ""
    } : null,
    retainUntil: row.retain_until || "",
    createdAt: row.created_at,
    queuedAt: row.queued_at || "",
    claimedAt: row.claimed_at || "",
    startedAt: row.started_at || "",
    finishedAt: row.finished_at || "",
    updatedAt: row.updated_at
  };
}

function offlineReadyState(row, now) {
  const seenAt = Date.parse(row.last_seen_at || "");
  if (!Number.isFinite(seenAt) || now - seenAt > H3_OFFLINE_SECONDS * 1000) return "offline";
  return H3_READY_STATES.includes(row.ready_state) ? row.ready_state : "error";
}

function assertControlEnabled(env) {
  if (!controlEnabled(env)) throw new H3ProtocolError("MiniMax H3 control is not enabled.", 503, "H3_CONTROL_DISABLED");
}

function assertTransferEnabled(env) {
  if (!transferEnabled(env)) throw new H3ProtocolError("MiniMax H3 transfer is not enabled.", 503, "H3_TRANSFER_DISABLED");
}

function controlEnabled(env) {
  return String(env?.[H3_FEATURE_FLAG] ?? "false").trim().toLowerCase() === "true";
}

function transferEnabled(env) {
  return String(env?.[H3_TRANSFER_FEATURE_FLAG] ?? "false").trim().toLowerCase() === "true";
}

function configuredBridgeOrigin(env) {
  const configured = String(env?.MINIMAX_H3_BRIDGE_ORIGIN || H3_DEFAULT_BRIDGE_ORIGIN).trim();
  return /^https:\/\/[^/]+$/u.test(configured) ? configured : "";
}

function randomTicketSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `h3t_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function parseAllowedMethods(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) && parsed.every((item) => item === "GET" || item === "HEAD") ? parsed : [];
  } catch {
    return [];
  }
}

async function readJson(request) {
  const contentType = String(request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new H3ProtocolError("H3 API requires application/json.", 415, "H3_CONTENT_TYPE_REQUIRED");
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > H3_MAX_JSON_BYTES) throw new H3ProtocolError("H3 request body is too large.", 413, "H3_BODY_TOO_LARGE");
  const raw = await boundedText(request, H3_MAX_JSON_BYTES);
  try {
    return JSON.parse(raw);
  } catch {
    throw new H3ProtocolError("H3 request JSON is invalid.", 400, "H3_JSON_INVALID");
  }
}

async function boundedText(request, maxBytes) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new H3ProtocolError("H3 request body is too large.", 413, "H3_BODY_TOO_LARGE");
      }
      chunks.push(chunk);
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
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new H3ProtocolError("H3 request must be valid UTF-8.", 400, "H3_UTF8_INVALID");
  }
}

function boundedJson(value, maxBytes) {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new H3ProtocolError("H3 JSON field is too large.", 422, "H3_FIELD_TOO_LARGE");
  return text;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function nowIso() {
  return new Date().toISOString();
}

function isUniqueConstraintError(error) {
  return /unique constraint|constraint failed/iu.test(String(error?.message || error));
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: securityHeaders() });
}

function securityHeaders() {
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
}
