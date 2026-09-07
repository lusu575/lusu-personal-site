// Only projects existing operational records; never infers worker liveness from delivery history.
export async function readAdminWorkbench(db, adminUserId) {
  const tables = new Set(((await db.prepare("select name from sqlite_master where type = 'table'").all()).results || []).map((row) => row.name));
  const countsAvailability = {};
  const sources = {};
  const optionalCount = async (key, table, sql, ...values) => {
    if (!tables.has(table)) { countsAvailability[key] = "unavailable"; return null; }
    try {
      const row = await db.prepare(sql).bind(...values).first();
      countsAvailability[key] = "available";
      return Number(row?.count || 0);
    } catch { countsAvailability[key] = "unavailable"; return null; }
  };
  const optionalRows = async (key, requiredTables, sql, ...values) => {
    if (!requiredTables.every((table) => tables.has(table))) { sources[key] = "unavailable"; return []; }
    try {
      const result = await db.prepare(sql).bind(...values).all();
      sources[key] = "available";
      return result.results || [];
    } catch { sources[key] = "unavailable"; return []; }
  };
  const [draftArticleCount, videoNeedsMetadataCount, whiteboardCleanupFailedCount, transferPendingDeletionCount,
    h3FailedJobCount, deliveryEvents, whiteboardEvents, transferEvents, h3Events, channels, cleanupRuns, alerts] = await Promise.all([
    optionalCount("draftArticleCount", "articles", "select count(*) as count from articles where status = 'draft'"),
    optionalCount("videoNeedsMetadataCount", "videos", "select count(*) as count from videos where trim(title) = '' or trim(thumbnail_url) = '' or coalesce(metadata_error, '') <> ''"),
    optionalCount("whiteboardCleanupFailedCount", "whiteboard_rooms", "select count(*) as count from whiteboard_rooms where status = 'deleting'"),
    optionalCount("transferPendingDeletionCount", "transfer_items", "select count(*) as count from transfer_items where upload_status = 'deleting'"),
    optionalCount("h3FailedJobCount", "minimax_h3_jobs", "select count(*) as count from minimax_h3_jobs where owner_user_id = ? and state = 'failed'", adminUserId),
    optionalRows("delivery", ["article_delivery_events"], "select event_id as id, channel_key as source, 'article-delivered' as action, status, created_at as createdAt from article_delivery_events order by created_at desc, event_id desc limit 20"),
    optionalRows("whiteboard", ["whiteboard_admin_audit"], "select audit_id as id, 'whiteboard' as source, action, 'recorded' as status, created_at as createdAt from whiteboard_admin_audit order by created_at desc, audit_id desc limit 20"),
    optionalRows("transfer", ["transfer_audit_log"], "select id, 'transfer' as source, action, 'recorded' as status, created_at as createdAt from transfer_audit_log order by created_at desc, id desc limit 20"),
    optionalRows("h3", ["minimax_h3_jobs", "minimax_h3_job_events"], "select e.event_id as id, 'h3' as source, e.event_type as action, e.to_state as status, e.code, e.created_at as createdAt from minimax_h3_job_events e join minimax_h3_jobs j on j.job_id = e.job_id where j.owner_user_id = ? order by e.created_at desc, e.event_id desc limit 20", adminUserId),
    optionalRows("automation", ["article_delivery_channels"], `select channel_key as channelKey, enabled, auto_publish as autoPublish, last_used_at as lastUsedAt, updated_at as updatedAt,
      ${tables.has("article_delivery_events") ? "(select max(created_at) from article_delivery_events where article_delivery_events.channel_key = article_delivery_channels.channel_key)" : "null"} as lastDeliveryAt
      from article_delivery_channels order by channel_key`),
    optionalRows("cleanup", ["transfer_cleanup_runs"], "select id, started_at as startedAt, finished_at as finishedAt, status, failed_operations as failedOperations from transfer_cleanup_runs order by started_at desc limit 5"),
    optionalRows("alerts", ["transfer_alerts"], "select id, alert_type as type, status, created_at as createdAt, sent_at as sentAt from transfer_alerts order by created_at desc limit 10")
  ]);
  return {
    generatedAt: new Date().toISOString(),
    draftArticleCount, videoNeedsMetadataCount, whiteboardCleanupFailedCount, transferPendingDeletionCount, h3FailedJobCount,
    countsAvailability,
    countDefinitions: { whiteboardCleanupFailedCount: "删除尚未完成的画板房间，包含进行中或待重试状态。", transferPendingDeletionCount: "删除尚未完成的互传条目，包含进行中或待重试状态。" },
    recentOperations: [...deliveryEvents, ...whiteboardEvents, ...transferEvents, ...h3Events].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(b.id).localeCompare(String(a.id))).slice(0, 30),
    operationSources: sources,
    operationHistoryNote: "近期记录来自投递、画板、互传与本人 H3 的既有事件；不是全部后台修改的完整审计日志。",
    tasks: {
      automation: channels.map((channel) => ({ ...channel, enabled: Boolean(channel.enabled), autoPublish: Boolean(channel.autoPublish), executionState: "unknown", lastDeliveryAt: channel.lastDeliveryAt || null })),
      transferCleanup: cleanupRuns, transferAlerts: alerts,
      note: "投递事件只能证明收到稿件。采集启动、执行阶段、调度器心跳与失败原因未接入，不能据此判断外部任务正常或失败。"
    }
  };
}
