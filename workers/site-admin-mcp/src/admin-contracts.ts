import { z } from "zod";

const id = z.string().min(1).max(180);
const text = z.string().max(1000);
const timestamp = z.string().min(1).max(80);
const empty = z.object({}).strict();
const read = (query: any) => z.object({ query: query.optional() }).strict();
const write = (body: any = empty, target = false) => z.object({
  ...(target ? { id } : {}), confirm: z.literal(true), body: body === empty ? body.default({}) : body
}).strict();
const page = { limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).max(1000000).optional() };
const category = z.object({ slug: z.string().min(1).max(120), name_zh: z.string().min(1).max(80), name_en: z.string().max(80).optional(), name_ja: z.string().max(80).optional(), sort_order: z.number().int().optional(), enabled: z.boolean().optional() }).strict();
const rate = z.object({ pageViews: z.number().min(0).max(100).optional(), clicks: z.number().min(0).max(100).optional(), articleViews: z.number().min(0).max(100).optional() }).strict();
const switchBody = z.object({ enabled: z.boolean(), expectedUpdatedAt: timestamp }).strict();
const operationId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/);
const transferBounds: Record<string, [number, number]> = {
  normal_max_file_bytes: [1048576,99614720], normal_user_24h_bytes:[1048576,8589934592], normal_user_daily_files:[1,1000],
  normal_user_init_per_minute:[1,120], normal_user_concurrent_uploads:[1,8], normal_room_active_bytes:[1048576,8589934592],
  normal_room_active_items:[1,1000], normal_pool_active_bytes:[1073741824,9663676416], normal_pool_class_a_budget:[1000,900000],
  normal_pool_class_b_budget:[1000,9000000], normal_pool_storage_gb_month:[1,9], normal_pool_yellow_ratio:[0.25,0.95],
  normal_pool_red_ratio:[0.5,1], retention_hours:[1,24], text_max_chars:[100,10000], text_per_minute:[1,120],
  global_upload_enabled:[0,1], normal_upload_enabled:[0,1]
};

/** Deliberately closed contracts: no arbitrary URL, query or request-body passthrough. */
export const adminContracts: Record<string, any> = {
  whiteboards_list: read(z.object({ ...page, type: z.enum(["public","private"]).optional(), status: z.string().max(40).optional() }).strict()),
  whiteboard_public_lock: write(z.object({ locked: z.boolean() }).strict()),
  whiteboard_kick: write(z.object({ connectionId: id.optional(), anonymousId: id.optional() }).strict().refine(v => v.connectionId || v.anonymousId, "Supply a connection or anonymous ID"), true),
  whiteboard_ban: write(z.object({ kind: z.enum(["anonymousId","ipHash"]), key:id, durationSeconds:z.number().int().min(60).max(604800).optional(), reason:z.string().max(240).optional() }).strict(), true),
  transfer_rooms: read(z.object({ limit:page.limit, search:text.optional() }).strict()),
  transfer_items: read(z.object({ ...page, search:text.optional() }).strict()),
  transfer_uploads: read(z.object({ limit:page.limit }).strict()),
  transfer_settings_update: write(z.object({ ...Object.fromEntries(Object.entries(transferBounds).map(([key,[min,max]]) => [key,z.number().min(min).max(max).optional()])), alert_thresholds:z.array(z.number().positive().max(100)).max(20).optional(), expectedUpdatedAt:timestamp }).strict()),
  transfer_cleanup: write(z.object({ reconcile:z.boolean().optional(), limit:z.number().int().min(1).max(500).optional() }).strict()),
  transfer_normal_upload_switch: write(switchBody), transfer_global_upload_switch: write(switchBody),
  transfer_upload_abort: write(z.object({ sessionId:id, roomKey:id }).strict()),
  h3_jobs: read(z.object({ pageSize:z.number().int().min(1).max(50).optional(), offset:page.offset }).strict()),
  h3_job_cancel: write(z.object({ operationId }).strict(),true),
  h3_job_create: write(z.object({ operationId, runnerId:z.string().regex(/^runner_[A-Za-z0-9_-]{8,120}$/), projectTitle:z.string().min(1).max(120), sourceLanguage:z.string().min(2).max(32),
    job:z.object({ mode:z.enum(["t2v","i2v","r2v"]), workflowVariant:z.enum(["character-06","character-07","quality-28"]).nullable().optional(), durationSeconds:z.number().min(5/24).max(345/24).optional(), targetFrames:z.number().int().min(5).max(345).nullable().optional(), aspectRatio:z.enum(["16:9","9:16","1:1"]), preset:z.enum(["safe","preview_fast"]).optional(), prompt:z.string().min(1).max(10000), references:z.array(z.object({assetId:z.string().regex(/^asset_[A-Za-z0-9_-]{8,120}$/),role:z.enum(["first_frame","last_frame","ref_image","ref_video","ref_audio","storyboard_grid"])}).strict()).max(15).optional(), includeVideoAudio:z.boolean().optional(), seed:z.string().regex(/^(0|[1-9][0-9]{0,19})$/).nullable().optional() }).strict()
  }).strict()),
  analytics_get:read(z.object({days:z.number().int().min(1).max(90).optional()}).strict()),
  traffic_update:write(z.object({expectedUpdatedAt:timestamp, settings:z.object({analyticsEnabled:z.boolean().optional(), identifyEnabled:z.boolean().optional(), pageViewsEnabled:z.boolean().optional(), clicksEnabled:z.boolean().optional(), articleViewsEnabled:z.boolean().optional(), adaptiveProtectionEnabled:z.boolean().optional(), warningRows:z.number().int().min(1000).max(50000000).optional(), hardRows:z.number().int().min(2000).max(100000000).optional(), sampling:z.object({normal:rate.optional(),warning:rate.optional(),hard:rate.optional()}).strict().optional()}).strict()}).strict()),
  social_links_update:write(z.object({links:z.object({x:text,github:text,bilibili:text,instagram:text,discord:text}).strict()}).strict()),
  video_category_create:write(category), video_category_update:write(category,true),
  chat_manage_list:read(z.object({limit:page.limit,includeHidden:z.enum(["0","1"]).optional()}).strict()),
  chat_message_update:write(z.object({nickname:z.string().max(80).optional(),content:z.string().min(1).max(1000).optional(),hidden:z.boolean().optional()}).strict(),true),
  chat_ban_create:write(z.object({type:z.enum(["visitor","ip_hash"]),visitorId:id.optional(),messageId:id.optional(),reason:z.string().max(200).optional(),durationHours:z.number().min(0).optional()}).strict()),
  automation_update:write(z.object({enabled:z.boolean().optional(),autoPublish:z.boolean().optional(),expectedUpdatedAt:timestamp}).strict(),true)
};
for (const name of ["whiteboards_overview","transfer_overview","transfer_settings_get","h3_runners","accounts_list","traffic_get","social_links_get","videos_manage_list","video_categories_list","chat_bans_list"]) adminContracts[name] = empty;
for (const name of ["whiteboard_status","h3_job_get","automation_get"]) adminContracts[name] = z.object({id}).strict();
for (const name of ["whiteboard_public_clear"]) adminContracts[name] = write();
for (const name of ["whiteboard_room_delete","transfer_item_delete","transfer_room_clear","transfer_room_delete","video_delete","video_refresh_metadata","video_category_delete","chat_message_delete","chat_room_delete","chat_ban_delete"]) adminContracts[name] = write(empty,true);
