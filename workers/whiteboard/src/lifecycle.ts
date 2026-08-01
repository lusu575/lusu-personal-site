import {
  CLEANUP_RETRY_BASE_MS,
  CLEANUP_RETRY_MAX_MS,
  CONNECTION_SWEEP_INTERVAL_MS,
  CONNECTION_STALE_MS,
  ROOM_RETENTION_MS
} from "./constants";
import type { RoomMeta } from "./types";

export function markRoomJoined(
  meta: RoomMeta,
  now: number,
  onlineCount: number
): RoomMeta {
  return {
    ...meta,
    lastActiveAt: now,
    emptySince: null,
    deleteAt: null,
    onlineCount,
    cleanupRetryCount: 0
  };
}

export function markRoomEmpty(meta: RoomMeta, now: number): RoomMeta {
  if (meta.roomType === "public") {
    return {
      ...meta,
      lastActiveAt: now,
      emptySince: null,
      deleteAt: null,
      onlineCount: 0,
      cleanupRetryCount: 0
    };
  }
  return {
    ...meta,
    lastActiveAt: now,
    emptySince: now,
    deleteAt: now + ROOM_RETENTION_MS,
    onlineCount: 0,
    cleanupRetryCount: 0
  };
}

export function shouldDeleteRoom(
  meta: RoomMeta,
  actualConnectionCount: number,
  now: number
): boolean {
  return (
    meta.roomType === "private" &&
    actualConnectionCount === 0 &&
    meta.emptySince !== null &&
    meta.deleteAt !== null &&
    now >= meta.deleteAt &&
    now - meta.emptySince >= ROOM_RETENTION_MS
  );
}

export function nextCleanupRetryAt(meta: RoomMeta, now: number): number {
  const exponent = Math.min(meta.cleanupRetryCount, 6);
  return now + Math.min(CLEANUP_RETRY_BASE_MS * 2 ** exponent, CLEANUP_RETRY_MAX_MS);
}

export function nextAlarmAt(
  meta: RoomMeta,
  actualConnectionCount: number,
  now: number
): number | null {
  if (actualConnectionCount > 0) {
    return now + CONNECTION_SWEEP_INTERVAL_MS;
  }
  if (meta.roomType === "private" && meta.deleteAt !== null) {
    return Math.max(now + 1_000, meta.deleteAt);
  }
  return null;
}

export function isConnectionStale(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt > CONNECTION_STALE_MS;
}
