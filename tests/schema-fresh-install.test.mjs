import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { content } from "../js/data/content.mjs";
import {
  CHAT_COLUMN_MIGRATIONS,
  CHAT_HASH_TABLES,
  TRANSFER_COLUMN_MIGRATIONS,
  chatColumnMigrationSql,
  chatHashColumnMigrationSql,
  hasIpHashKeyId,
  transferColumnMigrationSql
} from "../scripts/d1-migrate-local.mjs";

const schema = readFileSync(new URL("../cloudflare/schema.sql", import.meta.url), "utf8");
const schemaIndexes = readFileSync(new URL("../cloudflare/schema-indexes.sql", import.meta.url), "utf8");
const mobileOsArticleId = "seed-update-2026-07-10-premium-interaction-mobile-os";
const aiAgentWorkflowArticleId = "seed-ai-agent-workflow-guide-2026-06-14";
const aiAgentWorkflowPinRepairKey = "article_ai_agent_workflow_pin_repair_v1";
const multiplayerWhiteboardArticleId = "seed-update-2026-07-30-multiplayer-whiteboard";
const serviceReliabilityArticleId = "seed-update-2026-08-01-service-reliability";
const passwordRoomGuideArticleId = "seed-site-guide-whiteboard-chat-password-rooms-2026-08-06";
const agentCapabilitiesUpdateId = "seed-update-2026-08-06-agent-capabilities";
const whiteboard2048AgentUpdateId = "seed-update-2026-08-06-whiteboard-2048-agent";
const agentReadBreadthUpdateId = "seed-update-2026-08-06-agent-read-breadth";
const japaneseAgentProgressUpdateId = "seed-update-2026-08-06-japanese-agent-progress";
const hextrisAgentUpdateId = "seed-update-2026-08-07-hextris-agent";
const lifeRestartAgentUpdateId = "seed-update-2026-08-07-life-restart-agent";
const remoteMcpOauthUpdateId = "seed-update-2026-08-07-remote-mcp-oauth";
const gameVideoMcpCandidateUpdateId = "seed-update-2026-08-09-game-video-mcp-candidate";
const motionPolishUpdateId = "seed-update-2026-08-09-motion-polish";
const wallpaperTimeSwitchUpdateId = "seed-update-2026-08-09-wallpaper-time-switch";
const wallpaperSwitchSlimDawnUpdateId = "seed-update-2026-08-10-wallpaper-switch-slim-dawn";
const h3AmbientWallpapersUpdateId = "seed-update-2026-08-10-h3-ambient-wallpapers-4k";
const ambientWallpaperBfcacheUpdateId = "seed-update-2026-08-11-ambient-wallpaper-bfcache-fix";
const h3FirstVersionUpdateId = "seed-update-2026-08-11-h3-first-version-video-sr-48fps";
const wallpaperGameDisplayUpdateId = "seed-update-2026-08-12-wallpaper-game-display-fix";
const wallpaperSwitchCeramicUpdateId = "seed-update-2026-08-10-wallpaper-switch-ceramic-roll";
const wallpaperSwitchCalmUpdateId = "seed-update-2026-08-10-wallpaper-switch-calm-redesign";
const wallpaperSwitchSceneUpdateId = "seed-update-2026-08-09-wallpaper-switch-scene-redesign";
const videoLinkAutofillUpdateId = "seed-update-2026-08-11-video-link-autofill";

test("D1 schema initializes an empty database and remains idempotent", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(schema);
    db.exec(schemaIndexes);

    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ?").get(mobileOsArticleId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(mobileOsArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ?").get(multiplayerWhiteboardArticleId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(multiplayerWhiteboardArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ?").get(serviceReliabilityArticleId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(serviceReliabilityArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-guides'").get(passwordRoomGuideArticleId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(passwordRoomGuideArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(agentCapabilitiesUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(agentCapabilitiesUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(whiteboard2048AgentUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(whiteboard2048AgentUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(agentReadBreadthUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(agentReadBreadthUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(japaneseAgentProgressUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(japaneseAgentProgressUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(hextrisAgentUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(hextrisAgentUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(lifeRestartAgentUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(lifeRestartAgentUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(remoteMcpOauthUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(remoteMcpOauthUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(gameVideoMcpCandidateUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(gameVideoMcpCandidateUpdateId).count,
      3
    );
    const gameVideoMcpCandidateTranslations = db.prepare(
      "select lang, content_markdown from article_translations where article_id = ? order by lang"
    ).all(gameVideoMcpCandidateUpdateId);
    assert.deepEqual(gameVideoMcpCandidateTranslations.map(({ lang }) => lang), ["en", "ja", "zh"]);
    for (const { content_markdown: contentMarkdown } of gameVideoMcpCandidateTranslations) {
      assert.match(contentMarkdown, /Quick Transfer/);
      assert.match(contentMarkdown, /v1\.0\.10/);
      assert.doesNotMatch(contentMarkdown, /not deployed|尚未部署|未展開/);
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-12-wallpaper-game-display-fix'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and published_at = '2026-08-12T07:30:00.000Z'
      `).get(wallpaperGameDisplayUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(wallpaperGameDisplayUpdateId).count,
      3
    );
    const wallpaperGameDisplayContent = content.updates.find(({ article_id: articleId }) => (
      articleId === wallpaperGameDisplayUpdateId
    ));
    assert.ok(wallpaperGameDisplayContent);
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown
        from article_translations
        where article_id = ? and lang = ?
      `).get(wallpaperGameDisplayUpdateId, lang);
      assert.equal(translation.title, wallpaperGameDisplayContent.title[lang]);
      assert.equal(translation.summary, wallpaperGameDisplayContent.summary[lang]);
      assert.equal(translation.content_markdown.replace(/\r\n/g, "\n"), wallpaperGameDisplayContent.content_markdown[lang]);
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-11-h3-first-version-video-sr-48fps'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and created_at = '2026-08-11T10:40:00.000Z'
          and updated_at = '2026-08-11T10:40:00.000Z'
          and published_at = '2026-08-11T10:40:00.000Z'
      `).get(h3FirstVersionUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(h3FirstVersionUpdateId).count,
      3
    );
    const h3FirstVersionContent = content.updates.find(({ article_id: articleId }) => (
      articleId === h3FirstVersionUpdateId
    ));
    assert.ok(h3FirstVersionContent);
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown, created_at, updated_at
        from article_translations
        where article_id = ? and lang = ?
      `).get(h3FirstVersionUpdateId, lang);
      assert.equal(translation.title, h3FirstVersionContent.title[lang]);
      assert.equal(translation.summary, h3FirstVersionContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        h3FirstVersionContent.content_markdown[lang]
      );
      assert.equal(translation.created_at, "2026-08-11T10:40:00.000Z");
      assert.equal(translation.updated_at, "2026-08-11T10:40:00.000Z");
      assert.match(translation.content_markdown, /48fps/);
      assert.match(translation.content_markdown, /248/);
      assert.match(translation.content_markdown, /0\.\.62 \+ 61\.\.1/);
      assert.match(translation.content_markdown, /RealESRGAN_x4plus_anime_6B/);
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-11-ambient-wallpaper-bfcache-fix'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and created_at = '2026-08-11T03:35:00.000Z'
          and updated_at = '2026-08-11T03:35:00.000Z'
          and published_at = '2026-08-11T03:35:00.000Z'
      `).get(ambientWallpaperBfcacheUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(ambientWallpaperBfcacheUpdateId).count,
      3
    );
    const ambientWallpaperBfcacheContent = content.updates.find(({ article_id: articleId }) => (
      articleId === ambientWallpaperBfcacheUpdateId
    ));
    assert.ok(ambientWallpaperBfcacheContent);
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown, created_at, updated_at
        from article_translations
        where article_id = ? and lang = ?
      `).get(ambientWallpaperBfcacheUpdateId, lang);
      assert.equal(translation.title, ambientWallpaperBfcacheContent.title[lang]);
      assert.equal(translation.summary, ambientWallpaperBfcacheContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        ambientWallpaperBfcacheContent.content_markdown[lang]
      );
      assert.equal(translation.created_at, "2026-08-11T03:35:00.000Z");
      assert.equal(translation.updated_at, "2026-08-11T03:35:00.000Z");
      assert.match(translation.content_markdown, /BFCache/);
      assert.match(translation.content_markdown, /pageshow/);
      assert.match(translation.content_markdown, /Save-Data/);
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-11-video-link-autofill'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and created_at = '2026-08-11T00:20:00.000Z'
          and updated_at = '2026-08-11T00:20:00.000Z'
          and published_at = '2026-08-11T00:20:00.000Z'
      `).get(videoLinkAutofillUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(videoLinkAutofillUpdateId).count,
      3
    );
    const videoLinkAutofillContent = content.updates.find(({ article_id: articleId }) => (
      articleId === videoLinkAutofillUpdateId
    ));
    assert.ok(videoLinkAutofillContent);
    assert.equal(videoLinkAutofillContent.title.en, "Publish a Video with AI from One Link");
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown, created_at, updated_at
        from article_translations
        where article_id = ? and lang = ?
      `).get(videoLinkAutofillUpdateId, lang);
      assert.equal(translation.title, videoLinkAutofillContent.title[lang]);
      assert.equal(translation.summary, videoLinkAutofillContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        videoLinkAutofillContent.content_markdown[lang]
      );
      assert.equal(translation.created_at, "2026-08-11T00:20:00.000Z");
      assert.equal(translation.updated_at, "2026-08-11T00:20:00.000Z");
      assert.match(translation.content_markdown, /video_publish/);
      assert.match(translation.content_markdown, /operationId/);
      assert.match(translation.content_markdown, /YouTube/);
      assert.match(translation.content_markdown, /Bilibili/);
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-10-h3-ambient-wallpapers-4k'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and created_at = '2026-08-10T08:10:00.000Z'
          and updated_at = '2026-08-10T08:10:00.000Z'
          and published_at = '2026-08-10T08:10:00.000Z'
      `).get(h3AmbientWallpapersUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(h3AmbientWallpapersUpdateId).count,
      3
    );
    const h3AmbientWallpapersContent = content.updates.find(({ article_id: articleId }) => (
      articleId === h3AmbientWallpapersUpdateId
    ));
    assert.ok(h3AmbientWallpapersContent);
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown
        from article_translations
        where article_id = ? and lang = ?
      `).get(h3AmbientWallpapersUpdateId, lang);
      assert.equal(translation.title, h3AmbientWallpapersContent.title[lang]);
      assert.equal(translation.summary, h3AmbientWallpapersContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        h3AmbientWallpapersContent.content_markdown[lang]
      );
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-10-wallpaper-switch-slim-dawn'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and created_at = '2026-08-10T02:30:00.000Z'
          and updated_at = '2026-08-10T04:10:00.000Z'
          and published_at = '2026-08-10T04:10:00.000Z'
      `).get(wallpaperSwitchSlimDawnUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(wallpaperSwitchSlimDawnUpdateId).count,
      3
    );
    const wallpaperSwitchSlimDawnContent = content.updates.find(({ article_id: articleId }) => (
      articleId === wallpaperSwitchSlimDawnUpdateId
    ));
    assert.ok(wallpaperSwitchSlimDawnContent);
    assert.deepEqual(wallpaperSwitchSlimDawnContent.title, {
      zh: "四段壁纸开关的细框晨曦精修",
      en: "Slim-Rim Dawn Polish for the Four-Stage Wallpaper Switch",
      ja: "壁紙4段スイッチの細枠・朝焼け調整"
    });
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown, created_at, updated_at
        from article_translations
        where article_id = ? and lang = ?
      `).get(wallpaperSwitchSlimDawnUpdateId, lang);
      assert.equal(translation.title, wallpaperSwitchSlimDawnContent.title[lang]);
      assert.equal(translation.summary, wallpaperSwitchSlimDawnContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        wallpaperSwitchSlimDawnContent.content_markdown[lang]
      );
      assert.equal(translation.created_at, "2026-08-10T02:30:00.000Z");
      assert.equal(translation.updated_at, "2026-08-10T04:10:00.000Z");
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-10-wallpaper-switch-ceramic-roll'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and created_at = '2026-08-10T00:20:00.000Z'
          and updated_at = '2026-08-10T00:20:00.000Z'
          and published_at = '2026-08-10T00:20:00.000Z'
      `).get(wallpaperSwitchCeramicUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(wallpaperSwitchCeramicUpdateId).count,
      3
    );
    const wallpaperSwitchCeramicContent = content.updates.find(({ article_id: articleId }) => (
      articleId === wallpaperSwitchCeramicUpdateId
    ));
    assert.ok(wallpaperSwitchCeramicContent);
    assert.deepEqual(wallpaperSwitchCeramicContent.title, {
      zh: "四段壁纸开关的陶瓷滚动重制",
      en: "Ceramic Rolling Redesign for the Four-Stage Wallpaper Switch",
      ja: "壁紙4段スイッチをセラミック調ローリング仕様に再設計"
    });
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown, created_at, updated_at
        from article_translations
        where article_id = ? and lang = ?
      `).get(wallpaperSwitchCeramicUpdateId, lang);
      assert.equal(translation.title, wallpaperSwitchCeramicContent.title[lang]);
      assert.equal(translation.summary, wallpaperSwitchCeramicContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        wallpaperSwitchCeramicContent.content_markdown[lang]
      );
      assert.equal(translation.created_at, "2026-08-10T00:20:00.000Z");
      assert.equal(translation.updated_at, "2026-08-10T00:20:00.000Z");
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-10-wallpaper-switch-calm-redesign'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and created_at = '2026-08-09T16:00:00.000Z'
          and updated_at = '2026-08-09T16:00:00.000Z'
          and published_at = '2026-08-09T16:00:00.000Z'
      `).get(wallpaperSwitchCalmUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(wallpaperSwitchCalmUpdateId).count,
      3
    );
    const wallpaperSwitchCalmContent = content.updates.find(({ article_id: articleId }) => (
      articleId === wallpaperSwitchCalmUpdateId
    ));
    assert.ok(wallpaperSwitchCalmContent);
    assert.deepEqual(wallpaperSwitchCalmContent.title, {
      zh: "四时段壁纸开关轻量重做",
      en: "Four-Stage Wallpaper Switch Calm Redesign",
      ja: "4段階壁紙スイッチの穏やかな再設計"
    });
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown, created_at, updated_at
        from article_translations
        where article_id = ? and lang = ?
      `).get(wallpaperSwitchCalmUpdateId, lang);
      assert.equal(translation.title, wallpaperSwitchCalmContent.title[lang]);
      assert.equal(translation.summary, wallpaperSwitchCalmContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        wallpaperSwitchCalmContent.content_markdown[lang]
      );
      assert.equal(translation.created_at, "2026-08-09T16:00:00.000Z");
      assert.equal(translation.updated_at, "2026-08-09T16:00:00.000Z");
    }
    assert.equal(
      db.prepare(`
        select count(*) as count
        from articles
        where article_id = ?
          and slug = '2026-08-09-wallpaper-switch-scene-redesign'
          and category = 'site-updates'
          and status = 'published'
          and is_pinned = 0
          and cover_image = ''
          and created_at = '2026-08-09T11:15:00.000Z'
          and updated_at = '2026-08-09T11:15:00.000Z'
          and published_at = '2026-08-09T11:15:00.000Z'
      `).get(wallpaperSwitchSceneUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(wallpaperSwitchSceneUpdateId).count,
      3
    );
    const wallpaperSwitchSceneContent = content.updates.find(({ article_id: articleId }) => (
      articleId === wallpaperSwitchSceneUpdateId
    ));
    assert.ok(wallpaperSwitchSceneContent);
    assert.deepEqual(wallpaperSwitchSceneContent.title, {
      zh: "四时段壁纸开关场景重做",
      en: "Four-Stage Wallpaper Switch Scene Redesign",
      ja: "4段階壁紙スイッチのシーン再設計"
    });
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown, created_at, updated_at
        from article_translations
        where article_id = ? and lang = ?
      `).get(wallpaperSwitchSceneUpdateId, lang);
      assert.equal(translation.title, wallpaperSwitchSceneContent.title[lang]);
      assert.equal(translation.summary, wallpaperSwitchSceneContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        wallpaperSwitchSceneContent.content_markdown[lang]
      );
      assert.equal(translation.created_at, "2026-08-09T11:15:00.000Z");
      assert.equal(translation.updated_at, "2026-08-09T11:15:00.000Z");
    }
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(motionPolishUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(motionPolishUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates' and published_at = '2026-08-09T05:40:00.000Z'").get(wallpaperTimeSwitchUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(wallpaperTimeSwitchUpdateId).count,
      3
    );
    const wallpaperTimeSwitchContent = content.updates.find(({ article_id: articleId }) => (
      articleId === wallpaperTimeSwitchUpdateId
    ));
    assert.ok(wallpaperTimeSwitchContent);
    for (const lang of ["zh", "en", "ja"]) {
      const translation = db.prepare(`
        select title, summary, content_markdown, created_at, updated_at
        from article_translations
        where article_id = ? and lang = ?
      `).get(wallpaperTimeSwitchUpdateId, lang);
      assert.equal(translation.title, wallpaperTimeSwitchContent.title[lang]);
      assert.equal(translation.summary, wallpaperTimeSwitchContent.summary[lang]);
      assert.equal(
        translation.content_markdown.replace(/\r\n/g, "\n"),
        wallpaperTimeSwitchContent.content_markdown[lang]
      );
      assert.equal(translation.created_at, "2026-08-09T05:40:00.000Z");
      assert.equal(translation.updated_at, "2026-08-09T05:40:00.000Z");
    }
    const trafficSettings = JSON.parse(
      db.prepare("select value from site_runtime_state where key = 'traffic_control_settings_v1'").get().value
    );
    assert.equal(trafficSettings.warningRows, 30000);
    assert.equal(trafficSettings.hardRows, 50000);
    assert.equal(trafficSettings.adaptiveProtectionEnabled, true);
    assert.equal(trafficSettings.sampling.hard.clicks, 0);
    assert.equal(
      db.prepare("select value from site_runtime_state where key = 'article_seed_version'").get().value,
      "20260813-hide-minimax-h3-tools-r1"
    );
    assert.deepEqual(
      db.prepare("pragma table_info(whiteboard_rooms)").all().map((column) => column.name),
      [
        "room_id", "room_type", "created_at", "last_active_at", "empty_since",
        "delete_at", "online_count", "document_version", "snapshot_version",
        "is_locked", "resource_usage", "resource_bytes", "resource_count",
        "object_count", "status", "epoch", "updated_at", "last_error"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(anonymous_identities)").all().map((column) => column.name),
      [
        "anonymous_id", "credential_hash", "legacy_visitor_id", "display_name",
        "color", "identity_version", "created_at", "updated_at",
        "name_changed_at", "name_window_start", "name_change_count", "revoked_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(agent_device_authorizations)").all().map((column) => column.name),
      [
        "device_id", "device_code_hash", "user_code_hash", "client_name",
        "requested_scopes", "granted_scopes", "user_id", "status", "csrf_hash",
        "ip_hash", "created_at", "expires_at", "approved_at", "consumed_at",
        "poll_count", "last_polled_at", "decision_event_id"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(agent_access_tokens)").all().map((column) => column.name),
      [
        "token_id", "token_hash", "token_hint", "user_id", "client_name", "scopes",
        "created_at", "expires_at", "last_used_at", "revoked_at", "revoked_event_id"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(agent_audit_log)").all().map((column) => column.name),
      [
        "event_id", "actor_user_id", "token_id", "action", "target_type",
        "target_id", "scopes", "result", "created_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(agent_article_receipts)").all().map((column) => column.name),
      [
        "receipt_id", "user_id", "operation_id", "action", "payload_hash",
        "article_id", "response_json", "created_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(agent_video_receipts)").all().map((column) => column.name),
      [
        "receipt_id", "user_id", "operation_id", "action", "payload_hash",
        "video_id", "response_json", "created_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(video_upload_sessions)").all().map((column) => column.name),
      [
        "upload_session_id", "user_id", "operation_id", "payload_hash", "video_id",
        "filename", "mime_type", "size_bytes", "sha256", "upload_token_hash",
        "object_key", "r2_upload_id", "part_size_bytes", "expected_parts",
        "uploaded_bytes", "status", "expires_at", "created_at", "updated_at",
        "completed_at", "aborted_at", "last_error"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(mcp_oauth_grants)").all().map((column) => column.name),
      [
        "grant_ref", "user_id", "client_id", "client_name", "resource",
        "authorized_scopes", "status", "created_at", "activated_at", "expires_at",
        "revoked_at", "revoked_reason", "last_used_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(mcp_oauth_audit_log)").all().map((column) => column.name),
      [
        "event_id", "user_id", "client_id", "grant_ref", "token_ref_hash",
        "resource", "capability_id", "tool_name", "operation_id", "target_type",
        "target_id_hash", "requested_scopes", "effective_scopes", "action",
        "result", "error_code", "ip_hash", "created_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(mcp_oauth_registration_limits)").all().map((column) => column.name),
      ["bucket_key", "request_count", "expires_at", "updated_at"]
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name in (
          'mcp_oauth_grants_user_status_idx',
          'mcp_oauth_grants_client_resource_idx',
          'mcp_oauth_audit_created_idx',
          'mcp_oauth_audit_grant_idx',
          'mcp_oauth_registration_limits_expires_idx'
        )
      `).get().count,
      5
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name in (
          'agent_device_status_expires_idx',
          'agent_device_ip_created_idx',
          'agent_access_tokens_user_idx',
          'agent_access_tokens_expires_idx',
          'agent_audit_created_idx',
          'agent_article_receipts_created_idx',
          'agent_video_receipts_created_idx',
          'video_upload_sessions_user_status_idx',
          'video_upload_sessions_status_expires_idx'
        )
      `).get().count,
      9
    );
    assert.equal(db.prepare("select count(*) as count from agent_access_tokens").get().count, 0);
    assert.deepEqual(
      db.prepare("pragma table_info(japanese_subtext_profiles)").all().map((column) => column.name),
      [
        "user_id", "schema_version", "content_version", "revision", "current_level",
        "current_stage", "settings_json", "last_agent_operation_id",
        "last_agent_payload_hash", "progress_updated_at", "settings_updated_at",
        "created_at", "updated_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(japanese_subtext_agent_attempts)").all().map((column) => column.name),
      [
        "attempt_id", "user_id", "token_id", "operation_id", "payload_hash",
        "stage_id", "stage_revision", "content_hash", "expected_revision",
        "resulting_revision", "answers_json", "score", "cleared", "medal",
        "attempt_mode", "used_translation", "used_kana", "used_listening_mode",
        "replay_count", "hint_count", "created_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(japanese_subtext_agent_receipts)").all().map((column) => column.name),
      ["user_id", "operation_id", "payload_hash", "attempt_id", "response_json", "created_at"]
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name in (
          'japanese_subtext_agent_attempts_created_idx',
          'japanese_subtext_agent_receipts_created_idx'
        )
      `).get().count,
      2
    );
    assert.equal(db.prepare("select count(*) as count from japanese_subtext_agent_attempts").get().count, 0);
    assert.equal(db.prepare("select count(*) as count from japanese_subtext_agent_receipts").get().count, 0);
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("whiteboard_rooms_live_overview_idx").count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("whiteboard_bans_scope_subject_idx").count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("whiteboard_bans_active_scope_subject_idx").count,
      0
    );
    assert.equal(
      db.prepare("select is_pinned from articles where article_id = ?").get(aiAgentWorkflowArticleId).is_pinned,
      0
    );
    assert.equal(
      db.prepare("select count(*) as count from site_runtime_state where key = ?")
        .get(aiAgentWorkflowPinRepairKey).count,
      1
    );
    assert.deepEqual(
      { ...db.prepare(`
        select channel_key, category, enabled, auto_publish, token_hash
        from article_delivery_channels where channel_key = 'daily-ai-news'
      `).get() },
      {
        channel_key: "daily-ai-news",
        category: "daily-ai-news",
        enabled: 0,
        auto_publish: 0,
        token_hash: ""
      }
    );
    assert.deepEqual(
      { ...db.prepare(`
        select channel_key, category, enabled, auto_publish, token_hash
        from article_delivery_channels where channel_key = 'tool-radar'
      `).get() },
      {
        channel_key: "tool-radar",
        category: "tool-radar",
        enabled: 0,
        auto_publish: 0,
        token_hash: ""
      }
    );
    assert.ok(
      db.prepare("pragma table_info(article_delivery_channels)").all()
        .some((column) => column.name === "auto_publish" && column.notnull === 1)
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name = 'article_delivery_events_channel_created_idx'
      `).get().count,
      1
    );
    assert.ok(
      db.prepare("pragma table_info(article_delivery_events)").all()
        .some((column) => column.name === "payload_hash" && column.notnull === 1)
    );
    assert.deepEqual(
      db.prepare("pragma table_info(tool_radar_catalog)").all()
        .map((column) => column.name),
      ["tool_key", "canonical_url", "name", "article_id", "created_at"]
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name = 'tool_radar_catalog_created_idx'
      `).get().count,
      1
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from articles
        where article_id = 'seed-daily-ai-news-test-placeholder'
      `).get().count,
      0
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from article_translations
        where article_id = 'seed-daily-ai-news-test-placeholder'
      `).get().count,
      0
    );
    assert.ok(
      db.prepare("pragma table_info(anonymous_chat_messages)").all().some((column) => column.name === "ip_hash_key_id")
    );
    assert.ok(
      db.prepare("pragma table_info(chat_bans)").all().some((column) => column.name === "ip_hash_key_id")
    );
    assert.ok(
      db.prepare("pragma table_info(anonymous_chat_messages)").all().some((column) => column.name === "client_request_id")
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name in (?, ?)")
        .get("anonymous_chat_messages_room_ip_generation_idx", "chat_bans_active_ip_generation_idx").count,
      2
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("anonymous_chat_messages_request_idx").count,
      1
    );

    db.prepare("update articles set is_pinned = 1, updated_at = ? where article_id = ?")
      .run("2026-07-28T05:30:00.000Z", aiAgentWorkflowArticleId);
    db.exec(schema);
    db.exec(schemaIndexes);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(mobileOsArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(multiplayerWhiteboardArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(serviceReliabilityArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from article_delivery_channels where channel_key = 'daily-ai-news'").get().count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_delivery_channels where channel_key = 'tool-radar'").get().count,
      1
    );
    assert.deepEqual(
      { ...db.prepare("select is_pinned, updated_at from articles where article_id = ?").get(aiAgentWorkflowArticleId) },
      {
        is_pinned: 1,
        updated_at: "2026-07-28T05:30:00.000Z"
      },
      "reapplying schema seeds must preserve later admin pin choices and row revisions"
    );
  } finally {
    db.close();
  }
});

test("D1 chat hash migration upgrades legacy tables without losing historical rows", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      create table anonymous_chat_messages (
        message_id text primary key,
        visitor_id text not null,
        client_id text not null default '',
        nickname text not null,
        content text not null,
        created_at text not null,
        edited_at text,
        hidden integer not null default 0,
        ip_hash text not null,
        ip_prefix text not null default '',
        room_key text not null default 'public',
        encrypted integer not null default 0
      );
      create table chat_bans (
        ban_id text primary key,
        ban_type text not null,
        visitor_id text not null default '',
        ip_hash text not null default '',
        ip_prefix text not null default '',
        reason text not null default '',
        active integer not null default 1,
        created_by text not null,
        created_at text not null,
        expires_at text
      );
      insert into anonymous_chat_messages (
        message_id, visitor_id, nickname, content, created_at, ip_hash
      ) values (
        'legacy-message', 'legacy-visitor', 'Legacy', 'kept', '2026-01-01T00:00:00.000Z', 'legacy-message-hash'
      );
      insert into chat_bans (
        ban_id, ban_type, ip_hash, created_by, created_at
      ) values (
        'legacy-ban', 'ip', 'legacy-ban-hash', 'admin', '2026-01-01T00:00:00.000Z'
      );
    `);

    db.exec(schema);
    for (const table of CHAT_HASH_TABLES) {
      const columns = db.prepare(`pragma table_info('${table}')`).all();
      assert.equal(hasIpHashKeyId(columns), false);
      db.exec(chatHashColumnMigrationSql(table));
      assert.equal(hasIpHashKeyId(db.prepare(`pragma table_info('${table}')`).all()), true);
    }
    for (const [table, migration] of Object.entries(CHAT_COLUMN_MIGRATIONS)) {
      const columns = db.prepare(`pragma table_info('${table}')`).all();
      assert.equal(columns.some((column) => column.name === migration.column), false);
      db.exec(chatColumnMigrationSql(table));
      assert.equal(db.prepare(`pragma table_info('${table}')`).all().some((column) => column.name === migration.column), true);
    }

    db.exec(schemaIndexes);
    db.exec(schema);
    db.exec(schemaIndexes);

    assert.equal(
      db.prepare("select ip_hash_key_id from anonymous_chat_messages where message_id = ?")
        .get("legacy-message").ip_hash_key_id,
      "legacy"
    );
    assert.equal(
      db.prepare("select ip_hash_key_id from chat_bans where ban_id = ?").get("legacy-ban").ip_hash_key_id,
      "legacy"
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name in (?, ?)")
        .get("anonymous_chat_messages_room_ip_generation_idx", "chat_bans_active_ip_generation_idx").count,
      2
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("anonymous_chat_messages_request_idx").count,
      1
    );
    assert.throws(() => chatHashColumnMigrationSql("articles"), /Unsupported chat hash table/);
    assert.throws(() => chatColumnMigrationSql("articles"), /Unsupported chat table/);
  } finally {
    db.close();
  }
});

test("D1 transfer migration adds cursor generation and idempotency before dependent indexes", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      create table transfer_rooms (
        id text primary key,
        status text not null default 'open',
        last_activity_at text not null
      );
      create table transfer_items (
        id text primary key,
        room_id text not null,
        uploader_user_id text not null,
        uploader_role_snapshot text not null default 'user',
        upload_status text not null,
        created_at text not null,
        expires_at text not null
      );
      insert into transfer_rooms (id, last_activity_at) values ('legacy-room', '2026-01-01T00:00:00.000Z');
      insert into transfer_items (
        id, room_id, uploader_user_id, upload_status, created_at, expires_at
      ) values (
        'legacy-item', 'legacy-room', 'legacy-user', 'ready',
        '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'
      );
    `);

    db.exec(schema);
    for (const [table, migration] of Object.entries(TRANSFER_COLUMN_MIGRATIONS)) {
      const columns = db.prepare(`pragma table_info('${table}')`).all();
      assert.equal(columns.some((column) => column.name === migration.column), false);
      db.exec(transferColumnMigrationSql(table));
    }
    db.exec(schemaIndexes);

    assert.equal(db.prepare("select sync_generation from transfer_rooms where id = 'legacy-room'").get().sync_generation, 0);
    assert.equal(db.prepare("select idempotency_key from transfer_items where id = 'legacy-item'").get().idempotency_key, "");
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = 'transfer_items_idempotency_idx'").get().count,
      1
    );
    assert.throws(() => transferColumnMigrationSql("articles"), /Unsupported transfer table/);

    db.exec(schema);
    db.exec(schemaIndexes);
    assert.equal(db.prepare("select count(*) as count from transfer_items where id = 'legacy-item'").get().count, 1);
  } finally {
    db.close();
  }
});

test("D1 whiteboard ban migration replaces the legacy partial index and deduplicates safely", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(schema);
    db.exec(`
      create unique index whiteboard_bans_active_scope_subject_idx
        on whiteboard_bans(room_id, subject_type, subject_value)
        where active = 1;

      insert into whiteboard_bans (
        ban_id, room_id, subject_type, subject_value, reason, expires_at,
        active, created_by, created_at, updated_at
      ) values
        (
          'legacy-inactive-old', 'public-v1', 'anonymous_id',
          'anonymous_target_identifier_legacy', 'old', '2000-01-01T00:00:00.000Z',
          0, 'admin', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
        ),
        (
          'legacy-inactive-new', 'public-v1', 'anonymous_id',
          'anonymous_target_identifier_legacy', 'new', '2099-01-01T00:00:00.000Z',
          0, 'admin', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
        );
    `);

    db.exec(schemaIndexes);
    db.exec(schemaIndexes);

    assert.equal(
      db.prepare(`
        select count(*) as count
        from sqlite_master
        where type = 'index' and name = 'whiteboard_bans_active_scope_subject_idx'
      `).get().count,
      0
    );
    assert.equal(
      db.prepare(`
        select count(*) as count
        from sqlite_master
        where type = 'index' and name = 'whiteboard_bans_scope_subject_idx'
      `).get().count,
      1
    );
    assert.deepEqual(
      {
        ...db.prepare(`
          select ban_id, reason
          from whiteboard_bans
          where room_id = 'public-v1'
            and subject_type = 'anonymous_id'
            and subject_value = 'anonymous_target_identifier_legacy'
        `).get()
      },
      { ban_id: "legacy-inactive-new", reason: "new" }
    );
    assert.throws(
      () => db.prepare(`
        insert into whiteboard_bans (
          ban_id, room_id, subject_type, subject_value, expires_at,
          active, created_by, created_at, updated_at
        ) values (
          'duplicate-blocked', 'public-v1', 'anonymous_id',
          'anonymous_target_identifier_legacy', '2099-01-01T00:00:00.000Z',
          0, 'admin', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'
        )
      `).run(),
      /UNIQUE constraint failed/
    );
  } finally {
    db.close();
  }
});
