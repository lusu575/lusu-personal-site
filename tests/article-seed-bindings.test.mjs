import assert from "node:assert/strict";
import test from "node:test";

const FRAME_PIPELINE_SEED_ID = "seed-update-2026-07-18-frame-pipeline-low-performance";
const FRAME_PIPELINE_SEED_TIME = "2026-07-17T21:12:00.000Z";
const AI_AGENT_WORKFLOW_ARTICLE_ID = "seed-ai-agent-workflow-guide-2026-06-14";
const AI_AGENT_WORKFLOW_PIN_REPAIR_KEY = "article_ai_agent_workflow_pin_repair_v1";
const PASSWORD_ROOM_GUIDE_ARTICLE_ID = "seed-site-guide-whiteboard-chat-password-rooms-2026-08-06";
const AGENT_CAPABILITIES_UPDATE_ID = "seed-update-2026-08-06-agent-capabilities";
const WHITEBOARD_2048_AGENT_UPDATE_ID = "seed-update-2026-08-06-whiteboard-2048-agent";
const AGENT_READ_BREADTH_UPDATE_ID = "seed-update-2026-08-06-agent-read-breadth";
const JAPANESE_AGENT_PROGRESS_UPDATE_ID = "seed-update-2026-08-06-japanese-agent-progress";
const AGENT_AUTH_FORM_ORIGIN_UPDATE_ID = "seed-update-2026-08-06-agent-auth-form-origin";
const WHITEBOARD_AGENT_IMAGES_UPDATE_ID = "seed-update-2026-08-06-whiteboard-agent-images";
const HEXTRIS_AGENT_UPDATE_ID = "seed-update-2026-08-07-hextris-agent";
const LIFE_RESTART_AGENT_UPDATE_ID = "seed-update-2026-08-07-life-restart-agent";
const ARTICLE_SEED_VERSION = "20260807-life-restart-agent-r1";
const VALID_CHAT_SECRET = "article-seed-chat-secret-0000000000000001";
const VALID_ANALYTICS_SECRET = "article-seed-analytics-secret-000000001";

function createRecordingD1({ articleSeedVersion = "" } = {}) {
  const batches = [];
  const executions = [];

  function statement(sql, params = null) {
    return {
      sql: String(sql),
      params,
      bind(...values) {
        return statement(sql, values);
      },
      async first() {
        executions.push({ method: "first", sql: String(sql), params });
        if (
          /select value from site_runtime_state where key = \?/i.test(normalizedSql(sql))
          && params?.[0] === "article_seed_version"
          && articleSeedVersion
        ) {
          return { value: articleSeedVersion };
        }
        return null;
      },
      async all() {
        executions.push({ method: "all", sql: String(sql), params });
        return { results: [] };
      },
      async run() {
        return { success: true, meta: { changes: 0 } };
      }
    };
  }

  return {
    batches,
    executions,
    prepare(sql) {
      assert.equal(typeof sql, "string", "D1 prepare requires a SQL string");
      return statement(sql);
    },
    async batch(statements) {
      batches.push([...statements]);
      return statements.map(() => ({ success: true, meta: { changes: 0 } }));
    }
  };
}

function normalizedSql(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim();
}

test("every article seed D1 binding is defined", async () => {
  const moduleUrl = new URL("../functions/api/[[route]].js", import.meta.url);
  moduleUrl.searchParams.set("article-seed-bindings", String(Date.now()));
  const { onRequest } = await import(moduleUrl.href);
  const DB = createRecordingD1();

  const response = await onRequest({
    request: new Request("https://example.test/api/articles?lang=zh"),
    env: {
      DB,
      CHAT_IP_HASH_SALT: VALID_CHAT_SECRET,
      ANALYTICS_IP_HASH_SALT: VALID_ANALYTICS_SECRET
    },
    waitUntil() {}
  });

  assert.equal(response.status, 200, "the article route should finish after constructing its seed batches");

  const publicListQuery = DB.executions.find(({ method, sql }) => (
    method === "all"
    && /\bfrom articles\b/i.test(normalizedSql(sql))
    && /\border by articles\.is_pinned desc\b/i.test(normalizedSql(sql))
  ));
  assert.ok(publicListQuery, "expected the public article archive query to run");
  assert.deepEqual(publicListQuery.params, ["zh", 500], "the public archive should not truncate older articles at 50");

  const seedBatch = DB.batches.find((batch) => (
    batch.some(({ sql }) => sql.includes(`'${FRAME_PIPELINE_SEED_ID}'`))
    && !batch.some(({ sql }) => /^create\s+table\b/i.test(normalizedSql(sql)))
  ));
  assert.ok(seedBatch, "expected the standalone articleSeedStatements batch to be constructed");
  const schemaBatch = DB.batches.find((batch) => (
    batch.some(({ sql }) => /^create\s+table\b/i.test(normalizedSql(sql)))
    && batch.some(({ sql }) => /create table if not exists articles/i.test(normalizedSql(sql)))
  ));
  assert.ok(schemaBatch, "expected the article schema batch to be constructed");
  assert.equal(
    schemaBatch.some(({ sql }) => sql.includes(`'${FRAME_PIPELINE_SEED_ID}'`)),
    false,
    "runtime schema checks must not replay the article seed payload"
  );
  const releaseMarker = seedBatch.at(-1);
  assert.match(normalizedSql(releaseMarker?.sql), /^insert into site_runtime_state/i);
  assert.deepEqual(
    releaseMarker?.params?.slice(0, 2),
    ["article_seed_version", ARTICLE_SEED_VERSION],
    "the seed release marker must be committed after every seed statement"
  );

  const boundStatements = seedBatch.filter(({ params }) => Array.isArray(params));
  assert.ok(boundStatements.length > 0, "expected articleSeedStatements to construct bound D1 statements");

  const undefinedBindings = [];
  boundStatements.forEach(({ sql, params }, statementIndex) => {
    params.forEach((value, parameterIndex) => {
      if (value === undefined) {
        undefinedBindings.push({
          statement: statementIndex + 1,
          parameter: parameterIndex + 1,
          sql: normalizedSql(sql).slice(0, 160)
        });
      }
    });
  });
  assert.deepEqual(undefinedBindings, [], "article seed statements must never bind JavaScript undefined");

  const frameTranslations = boundStatements.filter(({ params }) => (
    params[1] === FRAME_PIPELINE_SEED_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(frameTranslations.length, 3, "expected all three frame-pipeline translations");
  for (const { params } of frameTranslations) {
    assert.equal(params[6], FRAME_PIPELINE_SEED_TIME, `${params[2]} created_at must be bound`);
    assert.equal(params[7], FRAME_PIPELINE_SEED_TIME, `${params[2]} updated_at must be bound`);
  }

  const aiAgentSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${AI_AGENT_WORKFLOW_ARTICLE_ID}'`)
    && /on conflict\(article_id\) do nothing/i.test(normalizedSql(sql))
  ));
  assert.ok(aiAgentSeed, "the admin-editable AI Agent article must use insert-only metadata seeding");

  const passwordRoomGuideSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${PASSWORD_ROOM_GUIDE_ARTICLE_ID}'`)
    && /on conflict\(article_id\) do nothing/i.test(normalizedSql(sql))
  ));
  assert.ok(passwordRoomGuideSeed, "the Website Guide article must use insert-only metadata seeding");
  const passwordRoomGuideTranslations = boundStatements.filter(({ params }) => (
    params[1] === PASSWORD_ROOM_GUIDE_ARTICLE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(passwordRoomGuideTranslations.length, 3, "the password-room guide must include three translations");
  for (const { params } of passwordRoomGuideTranslations) {
    assert.match(params[5], /password-room-chat-desktop\.png\?v=1375ed179bd8672af824c272f806f71d350d0485ab57067d9b4baaaca8a57440/);
    assert.match(params[5], /password-room-whiteboard-mobile\.png\?v=44578f131f03ef3044dd87e69a53e2bcb1d9865fb761d9920cdd3bc96293894d/);
  }

  const agentCapabilitiesSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${AGENT_CAPABILITIES_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(agentCapabilitiesSeed, "the newest AI capability update metadata must be seeded");
  const agentCapabilitiesTranslations = boundStatements.filter(({ params }) => (
    params[1] === AGENT_CAPABILITIES_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(agentCapabilitiesTranslations.length, 3, "the AI capability update must include three translations");
  for (const { params } of agentCapabilitiesTranslations) {
    assert.match(params[5], /stdio MCP/);
    assert.match(params[5], /remote MCP|远程 MCP|リモート MCP/);
  }

  const whiteboard2048AgentSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${WHITEBOARD_2048_AGENT_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(whiteboard2048AgentSeed, "the Whiteboard and 2048 Agent update metadata must be seeded");
  const whiteboard2048AgentTranslations = boundStatements.filter(({ params }) => (
    params[1] === WHITEBOARD_2048_AGENT_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(whiteboard2048AgentTranslations.length, 3, "the Whiteboard and 2048 Agent update must include three translations");
  for (const { params } of whiteboard2048AgentTranslations) {
    assert.match(params[5], /stdio MCP/);
    assert.match(params[5], /2048/);
    assert.match(params[5], /JSON/);
    assert.match(params[5], /append-only|只追加|追記専用/);
    assert.match(params[5], /browser|浏览器|ブラウザー/);
    assert.match(params[5], /undeployed and read-only|未部署且保持只读|未展開の読み取り専用/);
  }

  const agentReadBreadthSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${AGENT_READ_BREADTH_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(agentReadBreadthSeed, "the Phase 3 read breadth update metadata must be seeded");
  const agentReadBreadthTranslations = boundStatements.filter(({ params }) => (
    params[1] === AGENT_READ_BREADTH_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(agentReadBreadthTranslations.length, 3, "the Phase 3 read breadth update must include three translations");
  for (const { params } of agentReadBreadthTranslations) {
    assert.match(params[5], /stdio MCP/);
    assert.match(params[5], /250/);
    assert.match(params[5], /2048/);
    assert.match(params[5], /undeployed|未部署|未展開/);
  }

  const japaneseAgentProgressSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${JAPANESE_AGENT_PROGRESS_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(japaneseAgentProgressSeed, "the Phase 4 Japanese Agent progress update metadata must be seeded");
  const japaneseAgentProgressTranslations = boundStatements.filter(({ params }) => (
    params[1] === JAPANESE_AGENT_PROGRESS_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(japaneseAgentProgressTranslations.length, 3, "the Phase 4 Japanese Agent update must include three translations");
  for (const { params } of japaneseAgentProgressTranslations) {
    assert.match(params[5], /stdio MCP/);
    assert.match(params[5], /revision/);
    assert.match(params[5], /operation ID|operationId/);
    assert.match(params[5], /bronze|铜牌|銅/);
    assert.match(params[5], /undeployed|未部署|未展開/);
  }

  const agentAuthFormOriginSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${AGENT_AUTH_FORM_ORIGIN_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(agentAuthFormOriginSeed, "the Agent authorization form fix metadata must be seeded");
  const agentAuthFormOriginTranslations = boundStatements.filter(({ params }) => (
    params[1] === AGENT_AUTH_FORM_ORIGIN_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(agentAuthFormOriginTranslations.length, 3, "the Agent authorization form fix must include three translations");
  for (const { params } of agentAuthFormOriginTranslations) {
    assert.match(params[5], /strict-origin/);
    assert.match(params[5], /Origin: null/);
    assert.match(params[5], /no-referrer/);
    assert.match(params[5], /undeployed|未部署|未展開/);
  }

  const whiteboardAgentImagesSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${WHITEBOARD_AGENT_IMAGES_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(whiteboardAgentImagesSeed, "the Phase 5 whiteboard Agent image update metadata must be seeded");
  const whiteboardAgentImagesTranslations = boundStatements.filter(({ params }) => (
    params[1] === WHITEBOARD_AGENT_IMAGES_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(whiteboardAgentImagesTranslations.length, 3, "the Phase 5 whiteboard image update must include three translations");
  for (const { params } of whiteboardAgentImagesTranslations) {
    assert.match(params[5], /stdio MCP/);
    assert.match(params[5], /whiteboard:assets/);
    assert.match(params[5], /PNG/);
    assert.match(params[5], /append-only|只追加|追記専用/);
    assert.match(params[5], /application\/vnd\.yjs-update/);
    assert.match(params[5], /1\.0\.7/);
    assert.match(params[5], /undeployed|未部署|未展開/);
  }

  const hextrisAgentSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${HEXTRIS_AGENT_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(hextrisAgentSeed, "the Phase 6 Hextris Agent update metadata must be seeded");
  const hextrisAgentTranslations = boundStatements.filter(({ params }) => (
    params[1] === HEXTRIS_AGENT_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(hextrisAgentTranslations.length, 3, "the Phase 6 Hextris Agent update must include three translations");
  for (const { params } of hextrisAgentTranslations) {
    assert.match(params[5], /Hextris/);
    assert.match(params[5], /stdio MCP/);
    assert.match(params[5], /GPL-3\.0-or-later/);
    assert.match(params[5], /browser|浏览器|ブラウザー/);
    assert.match(params[5], /undeployed|未部署|未展開/);
  }

  const lifeRestartAgentSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${LIFE_RESTART_AGENT_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(lifeRestartAgentSeed, "the Phase 7 Life Restart Agent update metadata must be seeded");
  const lifeRestartAgentTranslations = boundStatements.filter(({ params }) => (
    params[1] === LIFE_RESTART_AGENT_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(lifeRestartAgentTranslations.length, 3, "the Phase 7 Life Restart update must include three translations");
  for (const { params } of lifeRestartAgentTranslations) {
    assert.match(params[5], /Life Restart|人生重开模拟器/);
    assert.match(params[5], /stdio MCP/);
    assert.match(params[5], /clientActionId/);
    assert.match(params[5], /browserBridge/);
    assert.match(params[5], /undeployed|未部署|未展開/);
  }

  const pinRepair = seedBatch.find(({ sql, params }) => (
    /^update articles set is_pinned = 0/i.test(normalizedSql(sql))
    && params?.includes(AI_AGENT_WORKFLOW_ARTICLE_ID)
    && params?.includes(AI_AGENT_WORKFLOW_PIN_REPAIR_KEY)
  ));
  assert.ok(pinRepair, "the historical forced pin must be repaired exactly once");

  const pinRepairMarker = seedBatch.find(({ sql, params }) => (
    /^insert or ignore into site_runtime_state/i.test(normalizedSql(sql))
    && params?.includes(AI_AGENT_WORKFLOW_PIN_REPAIR_KEY)
  ));
  assert.ok(pinRepairMarker, "the one-time pin repair must persist its runtime-state marker");
});

test("current persistent article seed marker skips every article upsert", async () => {
  const moduleUrl = new URL("../functions/api/[[route]].js", import.meta.url);
  moduleUrl.searchParams.set("article-seed-marker", `${Date.now()}-${Math.random()}`);
  const { onRequest } = await import(moduleUrl.href);
  const DB = createRecordingD1({ articleSeedVersion: ARTICLE_SEED_VERSION });

  const response = await onRequest({
    request: new Request("https://example.test/api/articles?lang=zh"),
    env: {
      DB,
      CHAT_IP_HASH_SALT: VALID_CHAT_SECRET,
      ANALYTICS_IP_HASH_SALT: VALID_ANALYTICS_SECRET
    },
    waitUntil() {}
  });

  assert.equal(response.status, 200);
  assert.equal(
    DB.batches.some((batch) => batch.some(({ sql }) => sql.includes(`'${FRAME_PIPELINE_SEED_ID}'`))),
    false,
    "a warm database with the current release marker must not construct or run seed writes"
  );
});
