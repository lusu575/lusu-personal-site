import { describe, expect, it } from "vitest";
import {
  PUBLIC_ROOM_ID,
  ROOM_RETENTION_MS
} from "../src/constants";
import {
  markRoomEmpty,
  markRoomJoined,
  nextAlarmAt,
  shouldDeleteRoom
} from "../src/lifecycle";
import type { RoomMeta, RoomType } from "../src/types";

function meta(roomType: RoomType): RoomMeta {
  return {
    schemaVersion: 1,
    roomId:
      roomType === "public" ? PUBLIC_ROOM_ID : `wb_${"a".repeat(43)}`,
    roomType,
    createdAt: 1,
    lastActiveAt: 1,
    emptySince: null,
    deleteAt: null,
    onlineCount: 1,
    documentVersion: 0,
    snapshotVersion: 0,
    isLocked: false,
    resourceUsage: { bytes: 0, images: 0 },
    updateCount: 0,
    updateBytes: 0,
    cleanupRetryCount: 0
  };
}

describe("private room lifecycle", () => {
  it("starts an exact 24-hour retention window only after becoming empty", () => {
    const emptyAt = 20_000;
    const empty = markRoomEmpty(meta("private"), emptyAt);
    expect(empty.emptySince).toBe(emptyAt);
    expect(empty.deleteAt).toBe(emptyAt + ROOM_RETENTION_MS);
    expect(shouldDeleteRoom(empty, 0, empty.deleteAt! - 1)).toBe(false);
    expect(shouldDeleteRoom(empty, 1, empty.deleteAt!)).toBe(false);
    expect(shouldDeleteRoom(empty, 0, empty.deleteAt!)).toBe(true);
  });

  it("cancels deletion when anyone rejoins and restarts from a later departure", () => {
    const firstEmpty = markRoomEmpty(meta("private"), 20_000);
    const joined = markRoomJoined(firstEmpty, 30_000, 1);
    expect(joined.emptySince).toBeNull();
    expect(joined.deleteAt).toBeNull();
    expect(shouldDeleteRoom(joined, 0, 20_000 + ROOM_RETENTION_MS)).toBe(false);

    const secondEmpty = markRoomEmpty(joined, 40_000);
    expect(secondEmpty.deleteAt).toBe(40_000 + ROOM_RETENTION_MS);
  });

  it("never gives the public room a deletion alarm", () => {
    const empty = markRoomEmpty(meta("public"), 20_000);
    expect(empty.emptySince).toBeNull();
    expect(empty.deleteAt).toBeNull();
    expect(shouldDeleteRoom(empty, 0, Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(nextAlarmAt(empty, 0, 20_000)).toBeNull();
  });
});
