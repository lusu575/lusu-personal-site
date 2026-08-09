#!/usr/bin/env node

import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { createProxyAwareFetch } from "../../自动新闻/integrations/lusu-site/network-fetch.mjs";
import { SiteClient, SiteClientError } from "../../lib/capabilities/site-client.mjs";
import {
  PublicCatalogError,
  getPublicTool,
  listPublicTools
} from "../../lib/capabilities/public-catalog-adapter.mjs";
import { JapaneseSubtextCapabilityError } from "../../lib/capabilities/japanese-subtext-adapter.mjs";
import {
  GameSessionStoreError,
  createGameSessionStore
} from "../../lib/capabilities/game-session-store.mjs";
import { GameProtocolError } from "../../lib/capabilities/game-protocol.mjs";
import { deriveTransferRoomSecret } from "../../lib/capabilities/transfer-crypto.mjs";
import {
  downloadWhiteboardAssetHandle,
  drawWhiteboardHandle,
  exportWhiteboardHandle,
  inspectWhiteboardAssetPath,
  joinWhiteboardHandle,
  readWhiteboardHandle,
  uploadWhiteboardAssetHandle
} from "../../lib/capabilities/whiteboard-adapter.mjs";
import { WhiteboardSceneError } from "../../lib/capabilities/whiteboard-scene.mjs";
import {
  LocalStateError,
  loadRoomSecret,
  openNoClobberSink,
  readStoredCredential,
  resolveAllowRoots,
  resolveReadableFileRef,
  resolveSecretRef,
  resolveSiteAuthContext,
  resolveWritableFileRef,
  storeRoomHandle
} from "../../lib/capabilities/local-state.mjs";

const languageSchema = z.enum(["zh", "en", "ja"]).default("zh");
const videoIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/);
const publicToolIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const catalogGameIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const japaneseStageIdSchema = z.string().regex(/^L[1-5]-(?:00[1-9]|0[1-4][0-9]|050)$/);
const japaneseQuerySchema = z.string().max(200).trim().min(1).regex(/^[^\u0000-\u001F\u007F]+$/u);
const japaneseQuestionIdSchema = z.enum(["q1", "q2", "q3", "q4", "q5"]);
const japaneseOptionIdSchema = z.enum(["a", "b", "c", "d", "e", "f"]);
const japaneseAttemptAnswerSchema = z.object({
  questionId: japaneseQuestionIdSchema,
  optionIds: z.array(japaneseOptionIdSchema).min(1).max(6)
}).strict();
const roomHandleSchema = z.string().regex(/^room_[a-zA-Z0-9_-]{12,80}$/);
const boardHandleSchema = z.string().regex(/^board_[a-zA-Z0-9_-]{12,80}$/);
const itemIdSchema = z.string().min(16).max(80);
const fileRefSchema = z.string().min(1).max(1024);
const gameSessionIdSchema = z.string().regex(/^game_[a-z0-9][a-z0-9_-]{0,63}_[a-f0-9]{24,64}$/);
const clientActionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const lifeRestartTalentIdSchema = z.number().int().min(0).max(99_999_999);
const gameActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move"),
    direction: z.enum(["up", "down", "left", "right"])
  }).strict(),
  z.object({
    type: z.literal("choose_talents"),
    talentIds: z.array(lifeRestartTalentIdSchema).length(3)
  }).strict(),
  z.object({
    type: z.literal("allocate_properties"),
    properties: z.object({
      CHR: z.number().int().min(0).max(10),
      INT: z.number().int().min(0).max(10),
      STR: z.number().int().min(0).max(10),
      MNY: z.number().int().min(0).max(10)
    }).strict()
  }).strict(),
  z.object({
    type: z.literal("advance"),
    steps: z.literal(1)
  }).strict(),
  z.object({
    type: z.literal("restart_life"),
    inheritedTalentId: z.union([lifeRestartTalentIdSchema, z.null()])
  }).strict()
]);
const operationIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/);
const articleIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/);
const articleSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const articleCategorySchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const articleTagSchema = z.string().trim().min(1).max(40);
const articleTranslationInlineSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(500).optional(),
  contentMarkdown: z.string().trim().min(1).max(200_000)
}).strict();
const articleTranslationFileSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(500).optional(),
  contentFile: fileRefSchema
}).strict();
const articleInlineTranslationsSchema = z.object({
  zh: articleTranslationInlineSchema,
  en: articleTranslationInlineSchema,
  ja: articleTranslationInlineSchema
}).strict();
const articleFileTranslationsSchema = z.object({
  zh: articleTranslationFileSchema,
  en: articleTranslationFileSchema,
  ja: articleTranslationFileSchema
}).strict();
const articlePublishMetadataShape = {
  operationId: operationIdSchema,
  slug: articleSlugSchema,
  category: articleCategorySchema.default("note"),
  tags: z.array(articleTagSchema).max(12).default([]),
  coverImage: z.string().trim().max(500).optional(),
  isPinned: z.boolean().default(false),
  publishedAt: z.string().datetime({ offset: true }).optional()
};
const articlePartialTranslationsSchema = z.object({
  zh: articleTranslationInlineSchema.optional(),
  en: articleTranslationInlineSchema.optional(),
  ja: articleTranslationInlineSchema.optional()
}).strict();
const whiteboardStyleShape = {
  strokeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor: z.union([z.literal("transparent"), z.string().regex(/^#[0-9a-fA-F]{6}$/)]).optional(),
  fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).optional(),
  strokeWidth: z.number().min(1).max(8).optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  roughness: z.number().int().min(0).max(2).optional(),
  opacity: z.number().int().min(1).max(100).optional()
};
const whiteboardElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["rectangle", "ellipse", "diamond"]),
    x: z.number().min(-100_000).max(100_000),
    y: z.number().min(-100_000).max(100_000),
    width: z.number().min(1).max(10_000),
    height: z.number().min(1).max(10_000),
    ...whiteboardStyleShape
  }).strict(),
  z.object({
    type: z.literal("text"),
    x: z.number().min(-100_000).max(100_000),
    y: z.number().min(-100_000).max(100_000),
    text: z.string().min(1).max(2_000),
    fontSize: z.number().min(8).max(96).optional(),
    width: z.number().min(1).max(10_000).optional(),
    height: z.number().min(1).max(10_000).optional(),
    ...whiteboardStyleShape
  }).strict(),
  z.object({
    type: z.enum(["line", "arrow"]),
    points: z.array(z.object({
      x: z.number().min(-100_000).max(100_000),
      y: z.number().min(-100_000).max(100_000)
    }).strict()).min(2).max(50),
    startArrowhead: z.enum(["arrow", "bar", "dot", "triangle"]).nullable().optional(),
    endArrowhead: z.enum(["arrow", "bar", "dot", "triangle"]).nullable().optional(),
    ...whiteboardStyleShape
  }).strict(),
  z.object({
    type: z.literal("image"),
    assetId: z.string().regex(/^[a-f0-9]{32}$/),
    x: z.number().min(-100_000).max(100_000),
    y: z.number().min(-100_000).max(100_000),
    width: z.number().min(1).max(10_000).optional(),
    height: z.number().min(1).max(10_000).optional(),
    opacity: z.number().int().min(1).max(100).optional()
  }).strict()
]);

export async function createLocalMcpServer(options = {}) {
  const env = options.env || process.env;
  const stateOptions = {
    env,
    homeDir: options.homeDir,
    crypto: options.crypto,
    secretResolver: options.resolveSecretRef || resolveSecretRef
  };
  const credential = options.credential === undefined
    ? await readStoredCredential(stateOptions)
    : options.credential;
  const explicitAccessTokenProvided = Object.prototype.hasOwnProperty.call(options, "accessToken");
  const siteAuth = resolveSiteAuthContext({
    baseUrl: options.baseUrl,
    env,
    credential,
    defaultBaseUrl: "https://lusu575.com",
    explicitAccessToken: options.accessToken,
    explicitAccessTokenProvided
  });
  const client = options.client || new SiteClient({
    fetch: options.fetch,
    baseUrl: siteAuth.baseUrl,
    accessToken: siteAuth.accessToken
  });
  const allowRoots = options.allowRoots || await resolveAllowRoots({
    env,
    allowRoots: options.allowRoots,
    defaultRoot: options.defaultRoot || process.cwd()
  });
  const gameStore = options.gameStore || createGameSessionStore(stateOptions);
  const server = new McpServer(
    { name: "lusu-personal-site-local", version: "0.8.0" },
    { capabilities: { tools: {} } }
  );

  registerTool(server, "capabilities_list", {
    title: "List LuSu site capabilities",
    description: "Lists the governed capability registry for local CLI and MCP planning.",
    inputSchema: z.object({
      domain: z.string().max(80).optional(),
      scope: z.string().max(120).optional(),
      transport: z.enum(["site-api", "remote-mcp", "local-mcp", "cli", "browser-adapter"]).optional(),
      status: z.enum(["available", "existing-api", "adapter-planned", "restricted"]).optional(),
      risk: z.enum(["low", "medium", "high", "critical"]).optional()
    }),
    annotations: readOnlyAnnotations()
  }, async (input) => ({ capabilities: client.capabilities(compactObject(input)) }));

  registerTool(server, "content_list", {
    title: "List public site articles",
    description: "Lists published article metadata by language and optional category.",
    inputSchema: z.object({
      lang: languageSchema,
      category: z.string().max(80).optional(),
      limit: z.number().int().min(1).max(500).default(100)
    }),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, (input) => client.listArticles(input));

  registerTool(server, "content_search", {
    title: "Search public site articles",
    description: "Searches public trilingual article metadata. This is read-only.",
    inputSchema: z.object({
      query: z.string().min(1).max(300),
      lang: languageSchema,
      category: z.string().max(80).optional(),
      limit: z.number().int().min(1).max(100).default(20)
    }),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, (input) => client.searchArticles(input));

  registerTool(server, "content_get", {
    title: "Read a public site article",
    description: "Reads one public article by slug and language.",
    inputSchema: z.object({ slug: z.string().min(1).max(180), lang: languageSchema }),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ slug, lang }) => client.getArticle(slug, { lang }));

  registerTool(server, "article_manage_list", {
    title: "List managed knowledge-base articles",
    description: "Lists draft and published article metadata for the authenticated site administrator. Requires content:write.",
    inputSchema: z.object({
      status: z.enum(["draft", "published", "archived"]).optional(),
      category: articleCategorySchema.optional(),
      limit: z.number().int().min(1).max(200).default(50)
    }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, (input) => client.listManagedArticles(input));

  registerTool(server, "article_manage_get", {
    title: "Read a managed knowledge-base article",
    description: "Reads full zh/en/ja source and the current updatedAt revision for one administrator-managed article. Requires content:write.",
    inputSchema: z.object({ articleId: articleIdSchema }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ articleId }) => client.getManagedArticle(articleId));

  registerTool(server, "article_publish", {
    title: "Atomically publish a trilingual article",
    description: "Atomically publishes metadata plus complete zh/en/ja Markdown in one server transaction. operationId makes exact retries idempotent. Requires an administrator-approved content:write token.",
    inputSchema: z.object({
      ...articlePublishMetadataShape,
      translations: articleInlineTranslationsSchema
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: true })
  }, (input) => client.publishArticle(input));

  registerTool(server, "article_publish_files", {
    title: "Atomically publish trilingual Markdown files",
    description: "Reads three non-symlink UTF-8 Markdown files inside LUSU_MCP_ALLOW_ROOT, then atomically publishes the complete article. Local paths never leave the MCP process. Requires content:write.",
    inputSchema: z.object({
      ...articlePublishMetadataShape,
      translations: articleFileTranslationsSchema
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: true })
  }, async (input) => {
    const translations = Object.fromEntries(await Promise.all(
      Object.entries(input.translations).map(async ([lang, translation]) => [
        lang,
        {
          title: translation.title,
          ...(translation.summary ? { summary: translation.summary } : {}),
          contentMarkdown: await readArticleMarkdownFile(translation.contentFile, allowRoots)
        }
      ])
    ));
    return client.publishArticle({ ...input, translations });
  });

  registerTool(server, "article_update", {
    title: "Atomically update a knowledge-base article",
    description: "Updates metadata and/or selected language sources with expectedUpdatedAt CAS and an idempotent operationId. Requires content:write; governed automation categories are excluded.",
    inputSchema: z.object({
      articleId: articleIdSchema,
      operationId: operationIdSchema,
      expectedUpdatedAt: z.string().datetime({ offset: true }),
      slug: articleSlugSchema.optional(),
      category: articleCategorySchema.optional(),
      tags: z.array(articleTagSchema).max(12).optional(),
      coverImage: z.string().trim().max(500).optional(),
      isPinned: z.boolean().optional(),
      publishedAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
      translations: articlePartialTranslationsSchema.optional()
    }).strict(),
    annotations: writeAnnotations({ destructiveHint: true, idempotentHint: true })
  }, ({ articleId, ...payload }) => client.updateArticle(articleId, payload));

  registerTool(server, "article_delete", {
    title: "Delete a knowledge-base article",
    description: "Permanently deletes one article only when confirm is true and expectedUpdatedAt still matches. Exact retries use operationId. Requires the separately approved content:delete scope.",
    inputSchema: z.object({
      articleId: articleIdSchema,
      operationId: operationIdSchema,
      expectedUpdatedAt: z.string().datetime({ offset: true }),
      confirm: z.literal(true)
    }).strict(),
    annotations: writeAnnotations({ destructiveHint: true, idempotentHint: true })
  }, ({ articleId, ...payload }) => client.deleteArticle(articleId, payload));

  registerTool(server, "daily_news_get", {
    title: "Read Daily AI News",
    description: "Reads the latest or date-matched published Daily AI News issue.",
    inputSchema: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      lang: languageSchema
    }),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, (input) => client.getDailyNews(input));

  registerTool(server, "videos_list", {
    title: "List public videos",
    description: "Lists and filters videos published on the LuSu site.",
    inputSchema: z.object({
      lang: languageSchema,
      query: z.string().max(300).optional(),
      categories: z.array(z.string().max(80)).max(20).optional(),
      limit: z.number().int().min(1).max(80).default(80)
    }),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, (input) => client.listVideos(input));

  registerTool(server, "video_get", {
    title: "Read one public video",
    description: "Reads one published video record by its stable site video id.",
    inputSchema: z.object({ videoId: videoIdSchema }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ videoId }) => client.getVideo(videoId));

  registerTool(server, "tools_list", {
    title: "List AI-ready site tools",
    description: "Lists the bounded local catalog of real site tools that currently have an AI capability surface.",
    inputSchema: z.object({ lang: languageSchema }).strict(),
    annotations: readOnlyAnnotations()
  }, ({ lang }) => listPublicTools({ lang }));

  registerTool(server, "tools_get", {
    title: "Read one AI-ready site tool",
    description: "Reads one safe public tool-catalog projection by stable tool id.",
    inputSchema: z.object({ toolId: publicToolIdSchema, lang: languageSchema }).strict(),
    annotations: readOnlyAnnotations()
  }, ({ toolId, lang }) => getPublicTool(toolId, { lang }));

  registerTool(server, "games_list", {
    title: "List public site games",
    description: "Lists safe public game metadata and optionally keeps only games with an available Agent adapter.",
    inputSchema: z.object({
      lang: languageSchema,
      agentOnly: z.boolean().default(false)
    }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ lang, agentOnly }) => client.listGames({ lang, agentOnly }));

  registerTool(server, "game_get", {
    title: "Read one public site game",
    description: "Reads one safe public game-catalog projection by stable game id.",
    inputSchema: z.object({ gameId: catalogGameIdSchema, lang: languageSchema }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ gameId, lang }) => client.getGame(gameId, { lang }));

  registerTool(server, "japanese_subtext_levels", {
    title: "List Japanese Subtext course levels",
    description: "Lists the five validated public course levels without exposing internal content paths.",
    inputSchema: z.object({ lang: languageSchema }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ lang }) => client.listJapaneseSubtextLevels({ lang }));

  registerTool(server, "japanese_subtext_stages", {
    title: "List Japanese Subtext stages",
    description: "Lists a bounded set of validated stage summaries for one course level.",
    inputSchema: z.object({
      level: z.number().int().min(1).max(5),
      query: japaneseQuerySchema.optional(),
      limit: z.number().int().min(1).max(50).default(50),
      lang: languageSchema
    }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ level, query, limit, lang }) => client.listJapaneseSubtextStages({ level, query, limit, lang }));

  registerTool(server, "japanese_subtext_stage_get", {
    title: "Read one Japanese Subtext stage",
    description: "Reads one validated, text-locked public learning stage by stable stage id.",
    inputSchema: z.object({ stageId: japaneseStageIdSchema, lang: languageSchema }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ stageId, lang }) => client.getJapaneseSubtextStage(stageId, { lang }));

  registerTool(server, "japanese_subtext_progress_get", {
    title: "Read Japanese Subtext progress",
    description: "Reads a bounded projection of the authenticated account's Japanese Subtext progress. Requires japanese-subtext:progress:read.",
    inputSchema: z.object({
      stageId: japaneseStageIdSchema.optional(),
      days: z.number().int().min(1).max(90).optional()
    }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, (input) => client.getJapaneseSubtextProgress(input));

  registerTool(server, "japanese_subtext_attempt_submit", {
    title: "Submit a Japanese Subtext attempt",
    description: "Submits answers for server-side scoring and progress advancement. Requires japanese-subtext:progress:write and an idempotent operationId.",
    inputSchema: z.object({
      stageId: japaneseStageIdSchema,
      stageRevision: z.number().int().min(1).max(1_000_000),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      answers: z.array(japaneseAttemptAnswerSchema).min(1).max(5),
      expectedRevision: z.number().int().min(1).max(1_000_000),
      operationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/)
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: true })
  }, (input) => client.submitJapaneseSubtextAttempt(input));

  registerTool(server, "transfer_join", {
    title: "Join a Quick Transfer room",
    description: "Derives a room locally from an environment-backed secretRef and returns only an opaque roomHandle. The passphrase never enters MCP arguments or output.",
    inputSchema: z.object({ secretRef: z.string().regex(/^env:[A-Z][A-Z0-9_]{2,80}$/) }),
    annotations: writeAnnotations({ idempotentHint: false })
  }, async ({ secretRef }) => {
    const passphrase = await stateOptions.secretResolver(secretRef, stateOptions);
    const secret = await deriveTransferRoomSecret(passphrase, stateOptions);
    const joined = await client.joinTransferRoom(secret);
    const roomHandle = await storeRoomHandle(secret, { ...stateOptions, secretRef });
    return { roomHandle, room: joined.room };
  });

  registerTool(server, "transfer_list", {
    title: "List Quick Transfer room items",
    description: "Lists a room through an opaque local roomHandle and decrypts text locally when possible.",
    inputSchema: z.object({
      roomHandle: roomHandleSchema,
      cursor: z.string().max(2048).optional(),
      limit: z.number().int().min(1).max(100).default(100)
    }),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, async ({ roomHandle, cursor, limit }) => {
    const secret = await loadRoomSecret(roomHandle, stateOptions);
    return sanitizeTransferListing(await client.listTransferItems(secret, { cursor, limit }));
  });

  registerTool(server, "transfer_send_text", {
    title: "Send encrypted Quick Transfer text",
    description: "Encrypts text locally with the stored room secret before sending it.",
    inputSchema: z.object({ roomHandle: roomHandleSchema, text: z.string().min(1).max(40_000) }),
    annotations: writeAnnotations({ idempotentHint: false })
  }, async ({ roomHandle, text }) => {
    const secret = await loadRoomSecret(roomHandle, stateOptions);
    const payload = await client.sendTransferText(secret, text);
    return { item: sanitizeTransferItem(payload.item) };
  });

  registerTool(server, "transfer_upload", {
    title: "Upload an allow-root file",
    description: "Uploads one non-empty file identified by fileRef. The path must resolve inside LUSU_MCP_ALLOW_ROOT.",
    inputSchema: z.object({
      roomHandle: roomHandleSchema,
      fileRef: fileRefSchema,
      mimeType: z.string().max(160).optional()
    }),
    annotations: writeAnnotations({ idempotentHint: false })
  }, async ({ roomHandle, fileRef, mimeType }) => {
    const secret = await loadRoomSecret(roomHandle, stateOptions);
    const file = await resolveReadableFileRef(fileRef, allowRoots);
    if (file.sizeBytes <= 0) throw new LocalStateError("The upload file is empty.", "TRANSFER_UPLOAD_FILE_EMPTY");
    const payload = await client.uploadTransferFile(secret, {
      filename: path.basename(file.path),
      mimeType: mimeType || inferMimeType(file.path),
      sizeBytes: file.sizeBytes,
      body: createReadStream(file.path)
    });
    return { fileRef, item: sanitizeTransferItem(payload.item) };
  });

  registerTool(server, "transfer_download", {
    title: "Download into an allow-root file",
    description: "Streams a room item into fileRef. The destination must be inside LUSU_MCP_ALLOW_ROOT and must not already exist.",
    inputSchema: z.object({
      roomHandle: roomHandleSchema,
      itemId: itemIdSchema,
      fileRef: fileRefSchema
    }),
    annotations: writeAnnotations({ idempotentHint: false })
  }, async ({ roomHandle, itemId, fileRef }) => {
    const secret = await loadRoomSecret(roomHandle, stateOptions);
    const destination = await resolveWritableFileRef(fileRef, allowRoots);
    const opened = await openNoClobberSink(destination);
    try {
      const download = await client.downloadTransferFile(secret, itemId, opened.sink);
      return { fileRef, ...download };
    } catch (error) {
      await opened.cleanup();
      throw error;
    }
  });

  registerTool(server, "transfer_delete", {
    title: "Delete a Quick Transfer item",
    description: "Deletes an item through a stored roomHandle. This operation is destructive and cannot be undone.",
    inputSchema: z.object({ roomHandle: roomHandleSchema, itemId: itemIdSchema }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    }
  }, async ({ roomHandle, itemId }) => {
    const secret = await loadRoomSecret(roomHandle, stateOptions);
    return client.deleteTransferItem(secret, itemId);
  });

  registerTool(server, "whiteboard_join", {
    title: "Join an online whiteboard",
    description: "Joins the public whiteboard or a private room via an environment-backed secretRef. Returns only an opaque local boardHandle; passwords and room tokens never enter tool output.",
    inputSchema: z.discriminatedUnion("roomType", [
      z.object({ roomType: z.literal("public") }).strict(),
      z.object({
        roomType: z.literal("private"),
        secretRef: z.string().regex(/^env:[A-Z][A-Z0-9_]{2,80}$/)
      }).strict()
    ]),
    annotations: writeAnnotations({ idempotentHint: false })
  }, async ({ roomType, secretRef }) => {
    const password = roomType === "private"
      ? await stateOptions.secretResolver(secretRef, stateOptions)
      : undefined;
    return joinWhiteboardHandle(client, {
      type: roomType,
      ...(roomType === "private" ? { password, secretRef } : {})
    }, stateOptions);
  });

  registerTool(server, "whiteboard_scene", {
    title: "Read an online whiteboard scene",
    description: "Returns a bounded, structured summary of the current whiteboard elements. Room credentials stay behind the opaque boardHandle.",
    inputSchema: z.object({ boardHandle: boardHandleSchema }).strict(),
    annotations: readOnlyAnnotations({ openWorldHint: true })
  }, ({ boardHandle }) => readWhiteboardHandle(client, boardHandle, stateOptions));

  registerTool(server, "whiteboard_asset_upload", {
    title: "Upload an allow-root whiteboard image",
    description: "Uploads one real, non-symlink PNG, JPEG, or WebP file of at most 5 MiB into the room behind boardHandle. Requires whiteboard:write and whiteboard:assets; credentials never enter output.",
    inputSchema: z.object({
      boardHandle: boardHandleSchema,
      fileRef: fileRefSchema,
      operationId: operationIdSchema
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: true })
  }, async ({ boardHandle, fileRef, operationId }) => {
    const file = await resolveWhiteboardAssetInput(fileRef, allowRoots);
    return uploadWhiteboardAssetHandle(
      client,
      boardHandle,
      file,
      operationId,
      stateOptions
    );
  });

  registerTool(server, "whiteboard_asset_download", {
    title: "Download a whiteboard image into an allow-root file",
    description: "Downloads one current-room PNG, JPEG, or WebP asset of at most 5 MiB into a new non-symlink allow-root path. Requires whiteboard:assets plus whiteboard:read or whiteboard:write; existing files are never overwritten.",
    inputSchema: z.object({
      boardHandle: boardHandleSchema,
      assetId: z.string().regex(/^[a-f0-9]{32}$/),
      fileRef: fileRefSchema
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: false })
  }, async ({ boardHandle, assetId, fileRef }) => {
    const destination = await resolveWhiteboardAssetDestination(fileRef, allowRoots);
    const opened = await openNoClobberSink(destination);
    try {
      const downloaded = await downloadWhiteboardAssetHandle(
        client,
        boardHandle,
        assetId,
        opened.sink,
        stateOptions
      );
      return { fileRef: relativeAllowRootRef(destination, allowRoots), ...downloaded };
    } catch (error) {
      await opened.cleanup();
      throw error;
    }
  });

  registerTool(server, "whiteboard_draw", {
    title: "Add safe elements to an online whiteboard",
    description: "Adds up to 50 safe high-level shapes, text, lines, arrows, or current-room image asset references. Images require whiteboard:assets and are GET-verified through this boardHandle; URL/base64/link/customData and all existing-element changes remain forbidden. Reuse operationId only for an exact retry.",
    inputSchema: z.object({
      boardHandle: boardHandleSchema,
      operationId: operationIdSchema,
      elements: z.array(whiteboardElementSchema).min(1).max(50)
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: true })
  }, ({ boardHandle, operationId, elements }) => drawWhiteboardHandle(
    client,
    boardHandle,
    { operationId, elements },
    stateOptions
  ));

  registerTool(server, "whiteboard_export", {
    title: "Export an online whiteboard",
    description: "Exports the current scene as Excalidraw JSON, simplified SVG, or PNG into a new allow-root file. Existing destinations are never overwritten; image assets are reported but not embedded.",
    inputSchema: z.object({
      boardHandle: boardHandleSchema,
      fileRef: fileRefSchema,
      format: z.enum(["json", "svg", "png"])
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: false })
  }, async ({ boardHandle, fileRef, format }) => {
    const destination = await resolveWritableFileRef(fileRef, allowRoots);
    const exported = await exportWhiteboardHandle(client, boardHandle, format, stateOptions);
    const opened = await openNoClobberSink(destination);
    try {
      await opened.sink.write(exported.bytes);
      await opened.close();
    } catch (error) {
      await opened.cleanup();
      throw error;
    }
    return {
      fileRef,
      format,
      mediaType: exported.mediaType,
      bytesWritten: exported.bytes.byteLength,
      warnings: exported.warnings,
      documentVersion: exported.documentVersion,
      elementCount: exported.elementCount
    };
  });

  registerTool(server, "game_create", {
    title: "Create an isolated AI game session",
    description: "Creates a bounded local 2048 or Life Restart session for an AI agent. It never takes over an already-open browser game.",
    inputSchema: z.object({ gameId: z.enum(["2048", "life-restart"]) }).strict(),
    annotations: writeAnnotations({ idempotentHint: false, openWorldHint: false })
  }, ({ gameId }) => gameStore.createSession(gameId));

  registerTool(server, "game_observe", {
    title: "Observe an isolated game session",
    description: "Returns a bounded structured observation for a local AI game session, including its phase, revision, and game-specific semantic state.",
    inputSchema: z.object({ sessionId: gameSessionIdSchema }).strict(),
    annotations: readOnlyAnnotations()
  }, ({ sessionId }) => gameStore.observeSession(sessionId));

  registerTool(server, "game_actions", {
    title: "List legal semantic game actions",
    description: "Lists bounded semantic actions for a local AI game session. It never returns selectors, scripts, URLs, or raw key events.",
    inputSchema: z.object({ sessionId: gameSessionIdSchema }).strict(),
    annotations: readOnlyAnnotations()
  }, ({ sessionId }) => gameStore.actionsForSession(sessionId));

  registerTool(server, "game_act", {
    title: "Apply one semantic game action",
    description: "Applies one CAS-guarded 2048 or Life Restart semantic action. clientActionId makes exact retries idempotent; selectors, scripts, URLs, paths, saves, and raw keys are rejected.",
    inputSchema: z.object({
      sessionId: gameSessionIdSchema,
      expectedRevision: z.number().int().min(0).max(1_000_000_000),
      clientActionId: clientActionIdSchema,
      action: gameActionSchema
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: true, openWorldHint: false })
  }, ({ sessionId, expectedRevision, clientActionId, action }) => gameStore.actSession(sessionId, {
    expectedRevision,
    clientActionId,
    action
  }));

  registerTool(server, "game_reset", {
    title: "Reset an isolated game session",
    description: "Discards the current isolated game run and starts again. This destructive action requires confirm=true and remains CAS-guarded and retry-safe.",
    inputSchema: z.object({
      sessionId: gameSessionIdSchema,
      expectedRevision: z.number().int().min(0).max(1_000_000_000),
      clientActionId: clientActionIdSchema,
      confirm: z.literal(true)
    }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  }, ({ sessionId, expectedRevision, clientActionId, confirm }) => gameStore.actSession(sessionId, {
    expectedRevision,
    clientActionId,
    action: { type: "reset", confirm }
  }));

  registerTool(server, "game_close", {
    title: "Close an isolated game session",
    description: "Permanently removes one local AI game session. Explicit confirmation is required.",
    inputSchema: z.object({ sessionId: gameSessionIdSchema, confirm: z.literal(true) }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  }, ({ sessionId, confirm }) => gameStore.closeSession(sessionId, { confirm }));

  return server;
}

export function startLocalMcpServer(options = {}) {
  const network = options.client || options.fetch
    ? null
    : createProxyAwareFetch({ environment: options.env || process.env });
  const handle = serveStdio(
    () => createLocalMcpServer({ ...options, fetch: options.fetch || network?.fetch }),
    {
      legacy: "serve",
      transport: options.transport,
      onerror: () => {
        process.stderr.write(`${JSON.stringify({ error: "Local MCP transport error", code: "MCP_TRANSPORT_ERROR" })}\n`);
      }
    }
  );
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await handle.close();
    await network?.close();
  };
  if (network) process.once("beforeExit", () => { void close(); });
  return { close };
}

function registerTool(server, name, config, handler) {
  server.registerTool(name, config, async (input) => {
    try {
      const result = await handler(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: { result }
      };
    } catch (error) {
      const payload = safeToolError(error);
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: { result: payload }
      };
    }
  });
}

function safeToolError(error) {
  if (error instanceof SiteClientError) return error.toJSON();
  if (error instanceof PublicCatalogError) {
    return { error: error.message, code: error.code, status: Number(error.status || 0) };
  }
  if (error instanceof JapaneseSubtextCapabilityError) {
    return { error: error.message, code: error.code, status: Number(error.status || 0) };
  }
  if (error instanceof LocalStateError || error instanceof WhiteboardSceneError) {
    return { error: error.message, code: error.code, status: 0 };
  }
  if (error instanceof GameProtocolError || error instanceof GameSessionStoreError) {
    return { error: error.message, code: error.code, status: 0 };
  }
  return { error: "The local MCP operation failed.", code: "LOCAL_MCP_OPERATION_FAILED", status: 0 };
}

function sanitizeTransferListing(payload) {
  return {
    room: payload.room,
    items: (payload.items || []).map(sanitizeTransferItem),
    nextCursor: payload.nextCursor || "",
    hasMore: Boolean(payload.hasMore),
    resetRequired: Boolean(payload.resetRequired),
    syncMode: payload.syncMode || ""
  };
}

function sanitizeTransferItem(item) {
  if (!item) return null;
  return compactObject({
    id: item.id,
    type: item.type,
    text: item.text,
    decryptionError: item.decryptionError,
    filename: item.filename,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    uploader: item.uploader,
    canDelete: item.canDelete,
    createdAt: item.createdAt,
    completedAt: item.completedAt,
    expiresAt: item.expiresAt
  });
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function readOnlyAnnotations(overrides = {}) {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    ...overrides
  };
}

function writeAnnotations(overrides = {}) {
  return {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
    ...overrides
  };
}

async function readArticleMarkdownFile(fileRef, allowRoots) {
  const requested = requestedFileRefPath(fileRef, allowRoots);
  const requestedStat = await fs.lstat(requested).catch((error) => {
    throw new LocalStateError("The Markdown file does not exist.", "ARTICLE_FILE_NOT_FOUND", { cause: error });
  });
  if (requestedStat.isSymbolicLink()) {
    throw new LocalStateError("Article Markdown may not be a symbolic link.", "ARTICLE_FILE_SYMLINK_FORBIDDEN");
  }
  const extension = path.extname(requested).toLowerCase();
  if (![".md", ".markdown"].includes(extension)) {
    throw new LocalStateError("Article files must use .md or .markdown.", "ARTICLE_FILE_EXTENSION_INVALID");
  }
  const file = await resolveReadableFileRef(fileRef, allowRoots);
  const requestedReal = await fs.realpath(requested);
  if (!sameLocalPath(requested, requestedReal) || !sameLocalPath(file.path, requestedReal)) {
    throw new LocalStateError("Article Markdown may not traverse a symbolic link.", "ARTICLE_FILE_SYMLINK_FORBIDDEN");
  }
  if (file.sizeBytes < 1 || file.sizeBytes > 200_000) {
    throw new LocalStateError("Article Markdown must contain 1-200000 UTF-8 bytes.", "ARTICLE_FILE_SIZE_INVALID");
  }
  const bytes = await fs.readFile(file.path);
  if (bytes.byteLength !== file.sizeBytes) {
    throw new LocalStateError("The Article Markdown changed while it was read.", "ARTICLE_FILE_CHANGED");
  }
  let content;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/u, "");
  } catch (error) {
    throw new LocalStateError("Article Markdown must be valid UTF-8.", "ARTICLE_FILE_UTF8_INVALID", { cause: error });
  }
  if (!content.trim() || content.length > 200_000) {
    throw new LocalStateError("Article Markdown content is empty or too long.", "ARTICLE_FILE_CONTENT_INVALID");
  }
  return content;
}

async function resolveWhiteboardAssetInput(fileRef, allowRoots) {
  const requested = requestedFileRefPath(fileRef, allowRoots);
  const file = await resolveReadableFileRef(fileRef, allowRoots);
  const requestedReal = await fs.realpath(requested);
  const requestedStat = await fs.lstat(requested);
  if (requestedStat.isSymbolicLink() || !sameLocalPath(requested, requestedReal)) {
    throw new LocalStateError("Whiteboard image fileRef may not traverse a symbolic link.", "FILE_REF_SYMLINK_FORBIDDEN");
  }
  if (file.sizeBytes < 1 || file.sizeBytes > 5 * 1024 * 1024) {
    throw new LocalStateError("The whiteboard image must contain 1-5242880 bytes.", "WHITEBOARD_ASSET_FILE_SIZE_INVALID");
  }
  const inspected = await inspectWhiteboardAssetPath(file.path);
  if (!sameLocalPath(file.path, inspected.path)) {
    throw new LocalStateError("The whiteboard image changed during inspection.", "WHITEBOARD_ASSET_FILE_CHANGED");
  }
  return { ...file, ...inspected };
}

async function resolveWhiteboardAssetDestination(fileRef, allowRoots) {
  const requested = requestedFileRefPath(fileRef, allowRoots);
  const requestedParent = path.dirname(requested);
  const realParent = await fs.realpath(requestedParent).catch((error) => {
    throw new LocalStateError("The destination directory does not exist.", "FILE_REF_PARENT_NOT_FOUND", { cause: error });
  });
  const parentStat = await fs.stat(realParent);
  if (!parentStat.isDirectory()) {
    throw new LocalStateError("The destination parent is not a directory.", "FILE_REF_PARENT_NOT_FOUND");
  }
  if (!sameLocalPath(requestedParent, realParent)) {
    throw new LocalStateError("Whiteboard image destinations may not traverse a symbolic link.", "FILE_REF_SYMLINK_FORBIDDEN");
  }
  return resolveWritableFileRef(fileRef, allowRoots);
}

function requestedFileRefPath(fileRef, allowRoots) {
  const reference = String(fileRef || "").trim().replace(/^file:/, "");
  const requested = path.isAbsolute(reference)
    ? path.resolve(reference)
    : path.resolve(allowRoots[0], reference);
  assertPortableFilePath(requested);
  return requested;
}

function assertPortableFilePath(filePath) {
  const parsed = path.parse(filePath);
  const remainder = filePath.slice(parsed.root.length);
  const components = remainder.split(/[\\/]+/u).filter(Boolean);
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
  if (/^[\\/]{2}[.?][\\/]/u.test(filePath)
    || components.some((component) => component.includes(":")
      || /[. ]$/u.test(component)
      || reserved.test(component))) {
    throw new LocalStateError("fileRef uses a reserved or unsafe filesystem path.", "FILE_REF_UNSAFE_PATH");
  }
}

function sameLocalPath(left, right) {
  const normalize = (value) => process.platform === "win32"
    ? path.normalize(value).toLowerCase()
    : path.normalize(value);
  return normalize(left) === normalize(right);
}

function relativeAllowRootRef(destination, allowRoots) {
  for (const root of allowRoots) {
    const relative = path.relative(root, destination);
    if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
      return relative.replaceAll(path.sep, "/");
    }
  }
  return path.basename(destination);
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".txt": "text/plain", ".md": "text/markdown", ".json": "application/json",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".pdf": "application/pdf",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm",
    ".zip": "application/zip"
  })[extension] || "application/octet-stream";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocalMcpServer();
}
