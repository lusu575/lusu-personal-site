import { normalizeHistoricalArticleTags } from "./article-tags.mjs";

export const HISTORICAL_ARTICLE_BASELINE = "20260902-mobile-blog-retired-r1";
export const ARTICLE_SEED_VERSION = "20260908-site-review-r1";
export const ARTICLE_SEED_STATE_KEY = "article_seed_version";
export const ARTICLE_MIGRATION_LEASE_KEY = `${ARTICLE_SEED_STATE_KEY}:lease`;
const MIGRATION_LEASE_MS = 60_000;
const inflight = new WeakMap();
const complete = new WeakSet();

export class ContentMigrationError extends Error {
  constructor(code = "CONTENT_MIGRATION_BUSY") {
    super("内容正在更新，请稍后重试。");
    this.name = "ContentMigrationError";
    this.code = code;
    this.status = 503;
    this.retryAfter = 1;
  }
}

function assertUpgradeableVersion(value) {
  if (!value || value === ARTICLE_SEED_VERSION || value === HISTORICAL_ARTICLE_BASELINE) return;
  const date = value.match(/^(\d{8})-.+$/)?.[1];
  // Same-day unfamiliar releases are not ordered by their arbitrary label. Only
  // an explicitly older dated release may enter the compatibility migration.
  if (!date || date >= ARTICLE_SEED_VERSION.slice(0, 8)) {
    throw new ContentMigrationError("CONTENT_MIGRATION_NEWER_RELEASE");
  }
}

async function readVersion(env) {
  const state = await env.DB.prepare("select value from site_runtime_state where key = ?")
    .bind(ARTICLE_SEED_STATE_KEY).first();
  return String(state?.value || "");
}

// The same idempotent entry point is usable by an authenticated release runner.
// Runtime fallback is retained until production has an independent D1 deploy step.
export async function runArticleDataMigrations(env, helpers) {
  if (complete.has(env.DB)) return false;
  if (inflight.has(env.DB)) return inflight.get(env.DB);
  const job = applyArticleDataMigrations(env, helpers);
  inflight.set(env.DB, job);
  try {
    const result = await job;
    complete.add(env.DB);
    return result;
  } finally {
    inflight.delete(env.DB);
  }
}

async function applyArticleDataMigrations(env, helpers) {
  let version = await readVersion(env);
  if (version === ARTICLE_SEED_VERSION) return false;
  assertUpgradeableVersion(version);
  const owner = crypto.randomUUID();
  const claimedAt = new Date();
  const claimed = await env.DB.prepare(`
    insert into site_runtime_state (key, value, updated_at) values (?, ?, ?)
    on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
    where site_runtime_state.updated_at <= ?
  `).bind(ARTICLE_MIGRATION_LEASE_KEY, owner,
    new Date(claimedAt.getTime() + MIGRATION_LEASE_MS).toISOString(), claimedAt.toISOString()).run();
  if (Number(claimed?.meta?.changes || 0) !== 1) throw new ContentMigrationError();

  try {
    // Another isolate may have completed after the initial read and before claim.
    version = await readVersion(env);
    if (version === ARTICLE_SEED_VERSION) return false;
    assertUpgradeableVersion(version);
    await env.DB.prepare(`create table if not exists site_data_migrations (
      version text primary key,
      applied_at text not null,
      source text not null default 'release'
    )`).run();
    const historical = [];
    if (version !== HISTORICAL_ARTICLE_BASELINE) {
      const { articleSeedStatements } = await import("./article-seeds.mjs");
      historical.push(...articleSeedStatements(env, helpers));
    }
    const { articleReleaseSeedStatements } = await import("./article-release-seed.mjs");
    await normalizeHistoricalArticleTags(env);
    const now = new Date().toISOString();
    await env.DB.batch([
      // D1 batch is one transaction. This NOT NULL guard must run before any
      // content write, so a changed marker/lease aborts and rolls back everything.
      env.DB.prepare(`insert into site_data_migrations (version, applied_at, source)
        values (?, case when exists (
          select 1 from site_runtime_state where key = ? and value = ? and updated_at > ?
        ) and coalesce((select value from site_runtime_state where key = ?), '') = ?
          then ? else null end, 'release')
        on conflict(version) do nothing`)
        .bind(ARTICLE_SEED_VERSION, ARTICLE_MIGRATION_LEASE_KEY, owner, now,
          ARTICLE_SEED_STATE_KEY, version, now),
      ...historical,
      ...articleReleaseSeedStatements(env, helpers),
      env.DB.prepare(`
        insert into site_runtime_state (key, value, updated_at) values (?, ?, ?)
        on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
        where site_runtime_state.value <> excluded.value
      `).bind(ARTICLE_SEED_STATE_KEY, ARTICLE_SEED_VERSION, now)
    ]);
    return true;
  } finally {
    await env.DB.prepare("delete from site_runtime_state where key = ? and value = ?")
      .bind(ARTICLE_MIGRATION_LEASE_KEY, owner).run();
  }
}
