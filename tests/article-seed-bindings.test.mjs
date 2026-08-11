import assert from "node:assert/strict";
import test from "node:test";
import { content } from "../js/data/content.mjs";
import { homeContent } from "../js/data/home-content.mjs";

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
const REMOTE_MCP_OAUTH_UPDATE_ID = "seed-update-2026-08-07-remote-mcp-oauth";
const REMOTE_MCP_OAUTH_ACCEPTED_AT = "2026-08-09T01:00:00.000Z";
const GAME_VIDEO_MCP_CANDIDATE_UPDATE_ID = "seed-update-2026-08-09-game-video-mcp-candidate";
const GAME_VIDEO_MCP_CANDIDATE_PUBLISHED_AT = "2026-08-09T09:30:00.000Z";
const MOTION_POLISH_UPDATE_ID = "seed-update-2026-08-09-motion-polish";
const MOTION_POLISH_PUBLISHED_AT = "2026-08-09T02:50:00.000Z";
const WALLPAPER_TIME_SWITCH_UPDATE_ID = "seed-update-2026-08-09-wallpaper-time-switch";
const WALLPAPER_TIME_SWITCH_PUBLISHED_AT = "2026-08-09T05:40:00.000Z";
const WALLPAPER_SWITCH_SLIM_DAWN_UPDATE_ID = "seed-update-2026-08-10-wallpaper-switch-slim-dawn";
const WALLPAPER_SWITCH_SLIM_DAWN_CREATED_AT = "2026-08-10T02:30:00.000Z";
const WALLPAPER_SWITCH_SLIM_DAWN_PUBLISHED_AT = "2026-08-10T04:10:00.000Z";
const H3_AMBIENT_WALLPAPERS_UPDATE_ID = "seed-update-2026-08-10-h3-ambient-wallpapers-4k";
const H3_AMBIENT_WALLPAPERS_PUBLISHED_AT = "2026-08-10T08:10:00.000Z";
const AMBIENT_WALLPAPER_BFCACHE_UPDATE_ID = "seed-update-2026-08-11-ambient-wallpaper-bfcache-fix";
const AMBIENT_WALLPAPER_BFCACHE_PUBLISHED_AT = "2026-08-11T03:35:00.000Z";
const WALLPAPER_SWITCH_CERAMIC_UPDATE_ID = "seed-update-2026-08-10-wallpaper-switch-ceramic-roll";
const WALLPAPER_SWITCH_CERAMIC_PUBLISHED_AT = "2026-08-10T00:20:00.000Z";
const WALLPAPER_SWITCH_CALM_UPDATE_ID = "seed-update-2026-08-10-wallpaper-switch-calm-redesign";
const WALLPAPER_SWITCH_CALM_PUBLISHED_AT = "2026-08-09T16:00:00.000Z";
const WALLPAPER_SWITCH_SCENE_UPDATE_ID = "seed-update-2026-08-09-wallpaper-switch-scene-redesign";
const WALLPAPER_SWITCH_SCENE_PUBLISHED_AT = "2026-08-09T11:15:00.000Z";
const ARTICLE_SEED_VERSION = "20260811-ambient-wallpaper-bfcache-fix-r1";
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

  const ambientWallpaperBfcacheContent = content.updates.find(({ article_id: articleId }) => (
    articleId === AMBIENT_WALLPAPER_BFCACHE_UPDATE_ID
  ));
  assert.ok(ambientWallpaperBfcacheContent, "the public fallback must include the BFCache wallpaper recovery release");
  assert.equal(content.updates[0]?.article_id, AMBIENT_WALLPAPER_BFCACHE_UPDATE_ID);
  assert.deepEqual(
    homeContent.updates.map(({ article_id: articleId }) => articleId),
    [
      AMBIENT_WALLPAPER_BFCACHE_UPDATE_ID,
      H3_AMBIENT_WALLPAPERS_UPDATE_ID,
      WALLPAPER_SWITCH_SLIM_DAWN_UPDATE_ID,
      WALLPAPER_SWITCH_CERAMIC_UPDATE_ID,
      WALLPAPER_SWITCH_CALM_UPDATE_ID
    ],
    "Home must project exactly the newest five public updates in release order"
  );
  const ambientWallpaperBfcacheHome = homeContent.updates[0];
  const { content_markdown: _bfcacheBody, ...ambientWallpaperBfcacheProjection } = ambientWallpaperBfcacheContent;
  assert.deepEqual(
    ambientWallpaperBfcacheHome,
    ambientWallpaperBfcacheProjection,
    "the Home projection must match every non-body field from the BFCache recovery fallback"
  );
  assert.equal(ambientWallpaperBfcacheContent.slug, "2026-08-11-ambient-wallpaper-bfcache-fix");
  assert.equal(ambientWallpaperBfcacheContent.category, "site-updates");
  assert.equal(ambientWallpaperBfcacheContent.status, "published");
  assert.equal(ambientWallpaperBfcacheContent.is_pinned, 0);
  assert.equal(ambientWallpaperBfcacheContent.cover_image, "");
  assert.equal(ambientWallpaperBfcacheContent.fallbackOnly, true);
  assert.equal(ambientWallpaperBfcacheContent.date, "2026.08.11");
  assert.equal(ambientWallpaperBfcacheContent.created_at, AMBIENT_WALLPAPER_BFCACHE_PUBLISHED_AT);
  assert.equal(ambientWallpaperBfcacheContent.updated_at, AMBIENT_WALLPAPER_BFCACHE_PUBLISHED_AT);
  assert.equal(ambientWallpaperBfcacheContent.published_at, AMBIENT_WALLPAPER_BFCACHE_PUBLISHED_AT);

  const ambientWallpaperBfcacheSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${AMBIENT_WALLPAPER_BFCACHE_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(ambientWallpaperBfcacheSeed, "the BFCache wallpaper recovery metadata must be seeded");
  const ambientWallpaperBfcacheTranslations = boundStatements.filter(({ params }) => (
    params[1] === AMBIENT_WALLPAPER_BFCACHE_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(ambientWallpaperBfcacheTranslations.length, 3, "the BFCache wallpaper recovery release must include three translations");
  for (const { params } of ambientWallpaperBfcacheTranslations) {
    const lang = params[2];
    assert.equal(params[3], ambientWallpaperBfcacheContent.title[lang], `${lang} title must match the BFCache recovery fallback`);
    assert.equal(params[4], ambientWallpaperBfcacheContent.summary[lang], `${lang} summary must match the BFCache recovery fallback`);
    assert.equal(params[5], ambientWallpaperBfcacheContent.content_markdown[lang], `${lang} body must match the BFCache recovery fallback`);
    assert.equal(params[6], AMBIENT_WALLPAPER_BFCACHE_PUBLISHED_AT);
    assert.equal(params[7], AMBIENT_WALLPAPER_BFCACHE_PUBLISHED_AT);
    assert.match(params[5], /BFCache/);
    assert.match(params[5], /ui-motion/);
    assert.match(params[5], /pageshow/);
    assert.match(params[5], /Save-Data/);
    assert.match(params[5], /reduced/);
  }

  const h3AmbientWallpapersContent = content.updates.find(({ article_id: articleId }) => (
    articleId === H3_AMBIENT_WALLPAPERS_UPDATE_ID
  ));
  assert.ok(h3AmbientWallpapersContent, "the public fallback must include the H3 ambient wallpaper release");
  assert.equal(content.updates[1]?.article_id, H3_AMBIENT_WALLPAPERS_UPDATE_ID);
  const h3AmbientWallpapersHome = homeContent.updates[1];
  const { content_markdown: _h3AmbientBody, ...h3AmbientWallpapersProjection } = h3AmbientWallpapersContent;
  assert.deepEqual(
    h3AmbientWallpapersHome,
    h3AmbientWallpapersProjection,
    "the Home projection must match every non-body field from the H3 ambient wallpaper fallback"
  );
  assert.equal(h3AmbientWallpapersContent.slug, "2026-08-10-h3-ambient-wallpapers-4k");
  assert.equal(h3AmbientWallpapersContent.category, "site-updates");
  assert.equal(h3AmbientWallpapersContent.status, "published");
  assert.equal(h3AmbientWallpapersContent.is_pinned, 0);
  assert.equal(h3AmbientWallpapersContent.cover_image, "");
  assert.equal(h3AmbientWallpapersContent.fallbackOnly, true);
  assert.equal(h3AmbientWallpapersContent.date, "2026.08.10");
  assert.equal(h3AmbientWallpapersContent.created_at, H3_AMBIENT_WALLPAPERS_PUBLISHED_AT);
  assert.equal(h3AmbientWallpapersContent.updated_at, H3_AMBIENT_WALLPAPERS_PUBLISHED_AT);
  assert.equal(h3AmbientWallpapersContent.published_at, H3_AMBIENT_WALLPAPERS_PUBLISHED_AT);

  const h3AmbientWallpapersSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${H3_AMBIENT_WALLPAPERS_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(h3AmbientWallpapersSeed, "the H3 ambient wallpaper metadata must be seeded");
  const h3AmbientWallpapersTranslations = boundStatements.filter(({ params }) => (
    params[1] === H3_AMBIENT_WALLPAPERS_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(h3AmbientWallpapersTranslations.length, 3, "the H3 ambient wallpaper release must include three translations");
  for (const { params } of h3AmbientWallpapersTranslations) {
    const lang = params[2];
    assert.equal(params[3], h3AmbientWallpapersContent.title[lang], `${lang} title must match the H3 ambient fallback`);
    assert.equal(params[4], h3AmbientWallpapersContent.summary[lang], `${lang} summary must match the H3 ambient fallback`);
    assert.equal(params[5], h3AmbientWallpapersContent.content_markdown[lang], `${lang} body must match the H3 ambient fallback`);
    assert.equal(params[6], H3_AMBIENT_WALLPAPERS_PUBLISHED_AT);
    assert.equal(params[7], H3_AMBIENT_WALLPAPERS_PUBLISHED_AT);
    assert.match(params[5], /MiniMax H3/);
    assert.match(params[5], /RealESRGAN|super-resolution|超分|超解像/);
    assert.match(params[5], /2160p|4K/);
    assert.match(params[5], /Save-Data/);
  }

  const wallpaperSwitchSlimDawnContent = content.updates.find(({ article_id: articleId }) => (
    articleId === WALLPAPER_SWITCH_SLIM_DAWN_UPDATE_ID
  ));
  assert.ok(wallpaperSwitchSlimDawnContent, "the public fallback must include the slim-rim dawn polish");
  assert.equal(content.updates[2]?.article_id, WALLPAPER_SWITCH_SLIM_DAWN_UPDATE_ID);
  const wallpaperSwitchSlimDawnHome = homeContent.updates[2];
  const { content_markdown: _slimDawnBody, ...wallpaperSwitchSlimDawnProjection } = wallpaperSwitchSlimDawnContent;
  assert.deepEqual(
    wallpaperSwitchSlimDawnHome,
    wallpaperSwitchSlimDawnProjection,
    "the Home projection must match every non-body field from the slim-rim dawn fallback"
  );
  assert.equal(wallpaperSwitchSlimDawnContent.slug, "2026-08-10-wallpaper-switch-slim-dawn");
  assert.equal(wallpaperSwitchSlimDawnContent.category, "site-updates");
  assert.equal(wallpaperSwitchSlimDawnContent.status, "published");
  assert.equal(wallpaperSwitchSlimDawnContent.is_pinned, 0);
  assert.equal(wallpaperSwitchSlimDawnContent.cover_image, "");
  assert.equal(wallpaperSwitchSlimDawnContent.fallbackOnly, true);
  assert.equal(wallpaperSwitchSlimDawnContent.date, "2026.08.10");
  assert.equal(wallpaperSwitchSlimDawnContent.created_at, WALLPAPER_SWITCH_SLIM_DAWN_CREATED_AT);
  assert.equal(wallpaperSwitchSlimDawnContent.updated_at, WALLPAPER_SWITCH_SLIM_DAWN_PUBLISHED_AT);
  assert.equal(wallpaperSwitchSlimDawnContent.published_at, WALLPAPER_SWITCH_SLIM_DAWN_PUBLISHED_AT);
  assert.equal(wallpaperSwitchSlimDawnHome.date, "2026.08.10");
  assert.deepEqual(wallpaperSwitchSlimDawnContent.title, {
    zh: "四段壁纸开关的细框晨曦精修",
    en: "Slim-Rim Dawn Polish for the Four-Stage Wallpaper Switch",
    ja: "壁紙4段スイッチの細枠・朝焼け調整"
  });

  const wallpaperSwitchSlimDawnSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${WALLPAPER_SWITCH_SLIM_DAWN_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(wallpaperSwitchSlimDawnSeed, "the slim-rim dawn polish metadata must be seeded");
  assert.match(
    normalizedSql(wallpaperSwitchSlimDawnSeed.sql),
    new RegExp(`${WALLPAPER_SWITCH_SLIM_DAWN_CREATED_AT}.*${WALLPAPER_SWITCH_SLIM_DAWN_PUBLISHED_AT}.*${WALLPAPER_SWITCH_SLIM_DAWN_PUBLISHED_AT}`),
    "the slim-rim dawn polish must preserve creation time and align update with publication"
  );
  assert.match(normalizedSql(wallpaperSwitchSlimDawnSeed.sql), /'', 'published', 0, 0/);
  const wallpaperSwitchSlimDawnTranslations = boundStatements.filter(({ params }) => (
    params[1] === WALLPAPER_SWITCH_SLIM_DAWN_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(wallpaperSwitchSlimDawnTranslations.length, 3, "the slim-rim dawn polish must include three translations");
  for (const { params } of wallpaperSwitchSlimDawnTranslations) {
    const lang = params[2];
    assert.equal(params[3], wallpaperSwitchSlimDawnContent.title[lang], `${lang} title must match the slim-rim dawn fallback`);
    assert.equal(params[4], wallpaperSwitchSlimDawnContent.summary[lang], `${lang} summary must match the slim-rim dawn fallback`);
    assert.equal(params[5], wallpaperSwitchSlimDawnContent.content_markdown[lang], `${lang} body must match the slim-rim dawn fallback`);
    assert.equal(params[6], WALLPAPER_SWITCH_SLIM_DAWN_CREATED_AT, `${lang} translation created_at must preserve the original seed time`);
    assert.equal(params[7], WALLPAPER_SWITCH_SLIM_DAWN_PUBLISHED_AT, `${lang} translation updated_at must match publication`);
    assert.match(params[5], /Image2/);
    assert.match(params[5], /44px/);
    assert.match(params[5], /transform/);
    assert.match(params[5], /05:00/);
    assert.match(params[5], /accent/);
    assert.match(params[5], /Save-Data/);
    assert.match(params[5], /reduced-motion|reduced motion/);
    assert.match(params[5], /motion-off/);
    assert.match(params[4], /桌面|desktop|デスクトップ/);
    assert.match(params[5], /crossfade/);
    assert.match(params[5], /动态云|dynamic clouds|動く雲/);
    assert.match(params[5], /移动 App|mobile App|モバイル App/);
    assert.match(params[5], /Android Home/);
  }

  const wallpaperSwitchCeramicContent = content.updates.find(({ article_id: articleId }) => (
    articleId === WALLPAPER_SWITCH_CERAMIC_UPDATE_ID
  ));
  assert.ok(wallpaperSwitchCeramicContent, "the public fallback must include the ceramic rolling redesign");
  assert.equal(content.updates[3]?.article_id, WALLPAPER_SWITCH_CERAMIC_UPDATE_ID);
  const wallpaperSwitchCeramicHome = homeContent.updates[3];
  const { content_markdown: _ceramicBody, ...wallpaperSwitchCeramicProjection } = wallpaperSwitchCeramicContent;
  assert.deepEqual(
    wallpaperSwitchCeramicHome,
    wallpaperSwitchCeramicProjection,
    "the Home projection must match every non-body field from the ceramic rolling fallback"
  );
  assert.equal(wallpaperSwitchCeramicContent.slug, "2026-08-10-wallpaper-switch-ceramic-roll");
  assert.equal(wallpaperSwitchCeramicContent.category, "site-updates");
  assert.equal(wallpaperSwitchCeramicContent.status, "published");
  assert.equal(wallpaperSwitchCeramicContent.is_pinned, 0);
  assert.equal(wallpaperSwitchCeramicContent.cover_image, "");
  assert.equal(wallpaperSwitchCeramicContent.fallbackOnly, true);
  assert.equal(wallpaperSwitchCeramicContent.date, "2026.08.10");
  assert.equal(wallpaperSwitchCeramicHome.date, "2026.08.10");
  assert.deepEqual(wallpaperSwitchCeramicContent.title, {
    zh: "四段壁纸开关的陶瓷滚动重制",
    en: "Ceramic Rolling Redesign for the Four-Stage Wallpaper Switch",
    ja: "壁紙4段スイッチをセラミック調ローリング仕様に再設計"
  });

  const wallpaperSwitchCeramicSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${WALLPAPER_SWITCH_CERAMIC_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(wallpaperSwitchCeramicSeed, "the ceramic rolling redesign metadata must be seeded");
  assert.match(
    normalizedSql(wallpaperSwitchCeramicSeed.sql),
    new RegExp(`${WALLPAPER_SWITCH_CERAMIC_PUBLISHED_AT}.*${WALLPAPER_SWITCH_CERAMIC_PUBLISHED_AT}.*${WALLPAPER_SWITCH_CERAMIC_PUBLISHED_AT}`),
    "the ceramic redesign must use one consistent create, update, and publish timestamp"
  );
  assert.match(normalizedSql(wallpaperSwitchCeramicSeed.sql), /'', 'published', 0, 0/);
  const wallpaperSwitchCeramicTranslations = boundStatements.filter(({ params }) => (
    params[1] === WALLPAPER_SWITCH_CERAMIC_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(wallpaperSwitchCeramicTranslations.length, 3, "the ceramic redesign must include three translations");
  for (const { params } of wallpaperSwitchCeramicTranslations) {
    const lang = params[2];
    assert.equal(params[3], wallpaperSwitchCeramicContent.title[lang], `${lang} title must match the ceramic public fallback`);
    assert.equal(params[4], wallpaperSwitchCeramicContent.summary[lang], `${lang} summary must match the ceramic public fallback`);
    assert.equal(params[5], wallpaperSwitchCeramicContent.content_markdown[lang], `${lang} body must match the ceramic public fallback`);
    assert.equal(params[6], WALLPAPER_SWITCH_CERAMIC_PUBLISHED_AT, `${lang} translation created_at must match publication`);
    assert.equal(params[7], WALLPAPER_SWITCH_CERAMIC_PUBLISHED_AT, `${lang} translation updated_at must match publication`);
    assert.match(params[5], /Image2/);
    assert.match(params[5], /36px/);
    assert.match(params[5], /transform/);
    assert.match(params[5], /morning/);
    assert.match(params[5], /day/);
    assert.match(params[5], /dusk/);
    assert.match(params[5], /night/);
    assert.match(params[5], /accent/);
    assert.match(params[5], /Save-Data/);
    assert.match(params[5], /reduced-motion|Reduced motion/);
    assert.match(params[5], /motion-off/);
  }

  const wallpaperSwitchCalmContent = content.updates.find(({ article_id: articleId }) => (
    articleId === WALLPAPER_SWITCH_CALM_UPDATE_ID
  ));
  assert.ok(wallpaperSwitchCalmContent, "the public fallback must retain the calm wallpaper-switch redesign");
  assert.equal(content.updates[4]?.article_id, WALLPAPER_SWITCH_CALM_UPDATE_ID);
  const wallpaperSwitchCalmHome = homeContent.updates[4];
  const { content_markdown: _calmBody, ...wallpaperSwitchCalmProjection } = wallpaperSwitchCalmContent;
  assert.deepEqual(
    wallpaperSwitchCalmHome,
    wallpaperSwitchCalmProjection,
    "the Home projection must match every non-body field from the calm redesign fallback"
  );
  assert.equal(wallpaperSwitchCalmContent.slug, "2026-08-10-wallpaper-switch-calm-redesign");
  assert.equal(wallpaperSwitchCalmContent.category, "site-updates");
  assert.equal(wallpaperSwitchCalmContent.status, "published");
  assert.equal(wallpaperSwitchCalmContent.is_pinned, 0);
  assert.equal(wallpaperSwitchCalmContent.cover_image, "");
  assert.equal(wallpaperSwitchCalmContent.fallbackOnly, true);
  assert.equal(wallpaperSwitchCalmContent.date, "2026.08.10");
  assert.equal(wallpaperSwitchCalmHome.date, "2026.08.10");
  assert.deepEqual(wallpaperSwitchCalmContent.title, {
    zh: "四时段壁纸开关轻量重做",
    en: "Four-Stage Wallpaper Switch Calm Redesign",
    ja: "4段階壁紙スイッチの穏やかな再設計"
  });

  const wallpaperSwitchCalmSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${WALLPAPER_SWITCH_CALM_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(wallpaperSwitchCalmSeed, "the calm wallpaper-switch redesign metadata must be seeded");
  assert.match(
    normalizedSql(wallpaperSwitchCalmSeed.sql),
    new RegExp(`${WALLPAPER_SWITCH_CALM_PUBLISHED_AT}.*${WALLPAPER_SWITCH_CALM_PUBLISHED_AT}.*${WALLPAPER_SWITCH_CALM_PUBLISHED_AT}`),
    "the calm redesign must use one consistent create, update, and publish timestamp"
  );
  assert.match(normalizedSql(wallpaperSwitchCalmSeed.sql), /'', 'published', 0, 0/);
  const wallpaperSwitchCalmTranslations = boundStatements.filter(({ params }) => (
    params[1] === WALLPAPER_SWITCH_CALM_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(wallpaperSwitchCalmTranslations.length, 3, "the calm redesign must include three translations");
  for (const { params } of wallpaperSwitchCalmTranslations) {
    const lang = params[2];
    assert.equal(params[3], wallpaperSwitchCalmContent.title[lang], `${lang} title must match the calm public fallback`);
    assert.equal(params[4], wallpaperSwitchCalmContent.summary[lang], `${lang} summary must match the calm public fallback`);
    assert.equal(params[5], wallpaperSwitchCalmContent.content_markdown[lang], `${lang} body must match the calm public fallback`);
    assert.equal(params[6], WALLPAPER_SWITCH_CALM_PUBLISHED_AT, `${lang} translation created_at must match publication`);
    assert.equal(params[7], WALLPAPER_SWITCH_CALM_PUBLISHED_AT, `${lang} translation updated_at must match publication`);
    assert.match(params[5], /Image2/);
    assert.match(params[5], /accent/);
    assert.match(params[5], /transform/);
    assert.match(params[5], /Save-Data/);
    assert.match(params[5], /reduced-motion|Reduced motion/);
    assert.match(params[5], /motion-off/);
    assert.doesNotMatch(params[5], /planet enters in layers|planet enter in layers|night three layers/i);
  }

  const wallpaperSwitchSceneContent = content.updates.find(({ article_id: articleId }) => (
    articleId === WALLPAPER_SWITCH_SCENE_UPDATE_ID
  ));
  assert.ok(wallpaperSwitchSceneContent, "the public fallback must include the redesigned wallpaper-switch scene");
  assert.equal(content.updates[5]?.article_id, WALLPAPER_SWITCH_SCENE_UPDATE_ID);
  assert.equal(
    homeContent.updates.some(({ article_id: articleId }) => articleId === WALLPAPER_SWITCH_SCENE_UPDATE_ID),
    false,
    "the sixth-newest scene redesign must remain in full history but outside the five-item Home projection"
  );
  assert.equal(wallpaperSwitchSceneContent.slug, "2026-08-09-wallpaper-switch-scene-redesign");
  assert.equal(wallpaperSwitchSceneContent.category, "site-updates");
  assert.equal(wallpaperSwitchSceneContent.status, "published");
  assert.equal(wallpaperSwitchSceneContent.is_pinned, 0);
  assert.equal(wallpaperSwitchSceneContent.cover_image, "");
  assert.equal(wallpaperSwitchSceneContent.fallbackOnly, true);
  assert.deepEqual(wallpaperSwitchSceneContent.title, {
    zh: "四时段壁纸开关场景重做",
    en: "Four-Stage Wallpaper Switch Scene Redesign",
    ja: "4段階壁紙スイッチのシーン再設計"
  });

  const wallpaperSwitchSceneSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${WALLPAPER_SWITCH_SCENE_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(wallpaperSwitchSceneSeed, "the redesigned wallpaper-switch scene metadata must be seeded");
  assert.match(
    normalizedSql(wallpaperSwitchSceneSeed.sql),
    new RegExp(`${WALLPAPER_SWITCH_SCENE_PUBLISHED_AT}.*${WALLPAPER_SWITCH_SCENE_PUBLISHED_AT}.*${WALLPAPER_SWITCH_SCENE_PUBLISHED_AT}`),
    "the redesigned scene must use one consistent create, update, and publish timestamp"
  );
  assert.match(normalizedSql(wallpaperSwitchSceneSeed.sql), /'', 'published', 0, 0/);
  const wallpaperSwitchSceneTranslations = boundStatements.filter(({ params }) => (
    params[1] === WALLPAPER_SWITCH_SCENE_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(wallpaperSwitchSceneTranslations.length, 3, "the redesigned scene must include three translations");
  for (const { params } of wallpaperSwitchSceneTranslations) {
    const lang = params[2];
    assert.equal(params[3], wallpaperSwitchSceneContent.title[lang], `${lang} title must match the public fallback`);
    assert.equal(params[4], wallpaperSwitchSceneContent.summary[lang], `${lang} summary must match the public fallback`);
    assert.equal(params[5], wallpaperSwitchSceneContent.content_markdown[lang], `${lang} body must match the public fallback`);
    assert.equal(params[6], WALLPAPER_SWITCH_SCENE_PUBLISHED_AT, `${lang} translation created_at must match publication`);
    assert.equal(params[7], WALLPAPER_SWITCH_SCENE_PUBLISHED_AT, `${lang} translation updated_at must match publication`);
    assert.match(params[5], /Image2/);
    assert.match(params[5], /keyboard|键盘|キーボード/i);
    assert.match(params[5], /reduced.motion|reduced motion|モーション低減/i);
  }

  const wallpaperTimeSwitchContent = content.updates.find(({ article_id: articleId }) => (
    articleId === WALLPAPER_TIME_SWITCH_UPDATE_ID
  ));
  assert.ok(wallpaperTimeSwitchContent, "the public content fallback must include the wallpaper-time switch update");
  const wallpaperTimeSwitchSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${WALLPAPER_TIME_SWITCH_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(wallpaperTimeSwitchSeed, "the wallpaper-time switch update metadata must be seeded");
  assert.match(
    normalizedSql(wallpaperTimeSwitchSeed.sql),
    new RegExp(`${WALLPAPER_TIME_SWITCH_PUBLISHED_AT}.*${WALLPAPER_TIME_SWITCH_PUBLISHED_AT}.*${WALLPAPER_TIME_SWITCH_PUBLISHED_AT}`),
    "the wallpaper-time switch update must use one consistent create, update, and publish timestamp"
  );
  const wallpaperTimeSwitchTranslations = boundStatements.filter(({ params }) => (
    params[1] === WALLPAPER_TIME_SWITCH_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(wallpaperTimeSwitchTranslations.length, 3, "the wallpaper-time switch update must include three translations");
  for (const { params } of wallpaperTimeSwitchTranslations) {
    const lang = params[2];
    assert.equal(params[3], wallpaperTimeSwitchContent.title[lang], `${lang} title must match the public content fallback`);
    assert.equal(params[4], wallpaperTimeSwitchContent.summary[lang], `${lang} summary must match the public content fallback`);
    assert.equal(params[5], wallpaperTimeSwitchContent.content_markdown[lang], `${lang} body must match the public content fallback`);
    assert.equal(params[6], WALLPAPER_TIME_SWITCH_PUBLISHED_AT, `${lang} translation created_at must match publication`);
    assert.equal(params[7], WALLPAPER_TIME_SWITCH_PUBLISHED_AT, `${lang} translation updated_at must match publication`);
  }

  const motionPolishSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${MOTION_POLISH_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(motionPolishSeed, "the public motion-polish update metadata must be seeded");
  assert.match(
    normalizedSql(motionPolishSeed.sql),
    new RegExp(`${MOTION_POLISH_PUBLISHED_AT}.*${MOTION_POLISH_PUBLISHED_AT}.*${MOTION_POLISH_PUBLISHED_AT}`),
    "the motion-polish update must use one consistent create, update, and publish timestamp"
  );
  const motionPolishTranslations = boundStatements.filter(({ params }) => (
    params[1] === MOTION_POLISH_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(motionPolishTranslations.length, 3, "the motion-polish update must include three translations");
  for (const { params } of motionPolishTranslations) {
    assert.equal(params[7], MOTION_POLISH_PUBLISHED_AT, `${params[2]} translation updated_at must match publication`);
    assert.match(params[5], /Dock/);
    assert.match(params[5], /transform/);
    assert.match(params[5], /opacity/);
    assert.match(params[5], /keyboard|键盘|キーボード/i);
    assert.match(params[5], /reduced.motion|reduced motion|减弱动效|視差軽減/i);
  }

  const remoteMcpOauthSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${REMOTE_MCP_OAUTH_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(remoteMcpOauthSeed, "the remote MCP OAuth update metadata must be seeded");
  assert.match(
    normalizedSql(remoteMcpOauthSeed.sql),
    new RegExp(`${REMOTE_MCP_OAUTH_ACCEPTED_AT}.*${REMOTE_MCP_OAUTH_ACCEPTED_AT}`),
    "the accepted remote MCP update must publish and update at the production-acceptance timestamp"
  );
  const remoteMcpOauthTranslations = boundStatements.filter(({ params }) => (
    params[1] === REMOTE_MCP_OAUTH_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(remoteMcpOauthTranslations.length, 3, "the remote MCP OAuth update must include three translations");
  for (const { params } of remoteMcpOauthTranslations) {
    assert.equal(params[7], REMOTE_MCP_OAUTH_ACCEPTED_AT, `${params[2]} translation updated_at must match acceptance`);
    assert.match(params[5], /OAuth Allow/);
    assert.match(params[5], /PKCE S256/);
    assert.match(params[5], /tools\/list/);
    assert.match(params[5], /9 (?:项工具|tools)|9ツール/);
    assert.match(params[5], /4 (?:项|public capabilities|entries)|4項目/);
    assert.match(params[5], /article_publish/);
    assert.match(params[5], /article_manage_list/);
    assert.match(params[5], /article_manage_get/);
    assert.match(params[5], /operationId/);
    assert.match(params[5], /expectedUpdatedAt/);
    assert.match(params[5], /confirm: true/);
    assert.match(params[5], /zh.*en.*ja/s);
    assert.match(params[5], /404/);
    assert.match(params[5], /revoked|撤销|失効/);
    assert.match(params[5], /cleaned|清理|消去/);
    assert.match(params[5], /article_publish_files/);
    assert.match(params[5], /local stdio MCP|本地 stdio MCP|ローカル stdio MCP/);
    assert.match(params[5], /not complete|尚未完成|未完成/);
    assert.match(params[5], /game|游戏|ゲーム/);
  }

  const gameVideoMcpCandidateSeed = seedBatch.find(({ sql }) => (
    sql.includes(`'${GAME_VIDEO_MCP_CANDIDATE_UPDATE_ID}'`)
    && /on conflict\(article_id\) do update/i.test(normalizedSql(sql))
  ));
  assert.ok(gameVideoMcpCandidateSeed, "the game and video MCP candidate update metadata must be seeded");
  assert.match(
    normalizedSql(gameVideoMcpCandidateSeed.sql),
    new RegExp(`${GAME_VIDEO_MCP_CANDIDATE_PUBLISHED_AT}.*${GAME_VIDEO_MCP_CANDIDATE_PUBLISHED_AT}`),
    "the candidate update must use one consistent local-release timestamp"
  );
  const gameVideoMcpCandidateTranslations = boundStatements.filter(({ params }) => (
    params[1] === GAME_VIDEO_MCP_CANDIDATE_UPDATE_ID
    && ["zh", "en", "ja"].includes(params[2])
  ));
  assert.equal(gameVideoMcpCandidateTranslations.length, 3, "the game and video MCP candidate update must include three translations");
  for (const { params } of gameVideoMcpCandidateTranslations) {
    assert.equal(params[6], GAME_VIDEO_MCP_CANDIDATE_PUBLISHED_AT, `${params[2]} translation created_at must match`);
    assert.equal(params[7], GAME_VIDEO_MCP_CANDIDATE_PUBLISHED_AT, `${params[2]} translation updated_at must match`);
    assert.match(params[5], /2048/);
    assert.match(params[5], /Hextris/);
    assert.match(params[5], /A Dark Room/);
    assert.match(params[5], /Life Restart|人生重开|Life Restart/);
    assert.match(params[5], /Kittens Game/);
    assert.match(params[5], /WET PAWS LICENSE/);
    assert.match(params[5], /NO_AGENT/);
    assert.match(params[5], /actionId/);
    assert.match(params[5], /games:play/);
    assert.match(params[5], /availableTransports/);
    assert.match(params[5], /YouTube/);
    assert.match(params[5], /Bilibili/);
    assert.match(params[5], /operationId/);
    assert.match(params[5], /expectedUpdatedAt/);
    assert.match(params[5], /confirm: true/);
    assert.match(params[5], /Base64/);
    assert.match(params[5], /local paths|本机路径|ローカルパス/);
    assert.match(params[5], /R2/);
    assert.match(params[5], /Quick Transfer/);
    assert.match(params[5], /v1\.0\.10/);
    assert.match(params[5], /This release adds|本次发布加入|今回の公開は/);
    assert.doesNotMatch(params[5], /not deployed|尚未部署|未展開/);
    assert.match(params[5], /setWebSocketAutoResponse/);
    assert.match(params[5], /ping/);
    assert.match(params[5], /pong/);
    assert.match(params[5], /377d494b-8f90-40ad-998f-863d209e1978/);
    assert.match(params[5], /GAME_BROWSER_DISCONNECTED/);
    assert.match(params[5], /production|生产|本番/);
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
