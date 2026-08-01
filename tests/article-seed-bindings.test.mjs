import assert from "node:assert/strict";
import test from "node:test";

const FRAME_PIPELINE_SEED_ID = "seed-update-2026-07-18-frame-pipeline-low-performance";
const FRAME_PIPELINE_SEED_TIME = "2026-07-17T21:12:00.000Z";
const AI_AGENT_WORKFLOW_ARTICLE_ID = "seed-ai-agent-workflow-guide-2026-06-14";
const AI_AGENT_WORKFLOW_PIN_REPAIR_KEY = "article_ai_agent_workflow_pin_repair_v1";
const ARTICLE_SEED_VERSION = "20260801-whiteboard-reliable-sketch-r1";
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
