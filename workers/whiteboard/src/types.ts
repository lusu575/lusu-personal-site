import type { WhiteboardRoom } from "./index";

export type RoomType = "public" | "private";

export interface ResourceUsage {
  bytes: number;
  images: number;
}

export interface RoomMeta {
  schemaVersion: 1;
  roomId: string;
  roomType: RoomType;
  createdAt: number;
  lastActiveAt: number;
  emptySince: number | null;
  deleteAt: number | null;
  onlineCount: number;
  documentVersion: number;
  snapshotVersion: number;
  isLocked: boolean;
  resourceUsage: ResourceUsage;
  updateCount: number;
  updateBytes: number;
  cleanupRetryCount: number;
  lastError?: string;
  lastErrorAt?: number;
}

export interface ConnectionAttachment {
  version: 1;
  connectionId: string;
  presenceId: string;
  anonymousId: string;
  displayName: string;
  color: string;
  identityVersion: number;
  ticketJti: string;
  ipHash: string | null;
  connectedAt: number;
  lastSeenAt: number;
  rateWindowStartedAt: number;
  messagesInWindow: number;
  updatesInWindow: number;
  awarenessInWindow: number;
  bytesInWindow: number;
  focused: boolean;
  drawing: boolean;
}

export interface BanEntry {
  key: string;
  kind: "anonymousId" | "ipHash";
  expiresAt: number;
  createdAt: number;
}

export interface ImageMeta {
  assetId: string;
  roomId: string;
  key: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  byteLength: number;
  width: number;
  height: number;
  createdAt: number;
  createdBy: string;
}

export interface UploadRateState {
  windowStartedAt: number;
  count: number;
  bytes?: number;
  expiresAt?: number;
}

export interface AgentUpdateReceipt {
  version: 1;
  payloadSha256: string;
  documentVersion: number;
  createdAt: number;
  expiresAt: number;
}

export interface AgentAssetReceipt {
  version: 2;
  kind: "asset";
  status: "pending" | "committed";
  roomId: string;
  payloadSha256: string;
  asset: {
    assetId: string;
    contentType: ImageMeta["contentType"];
    byteLength: number;
    width: number;
    height: number;
    version: 1;
  };
  createdAt: number;
  expiresAt: number;
}

export type AgentReceipt = AgentUpdateReceipt | AgentAssetReceipt;

export interface WhiteboardEnv {
  WHITEBOARD_ROOMS: DurableObjectNamespace<WhiteboardRoom>;
  WHITEBOARD_BUCKET?: R2Bucket;
  DB?: D1Database;
  WHITEBOARD_INTERNAL_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

export interface Participant {
  presenceId: string;
  displayName: string;
  color: string;
  connectionCount: number;
  focused: boolean;
  drawing: boolean;
}

export interface ParsedImage {
  contentType: ImageMeta["contentType"];
  width: number;
  height: number;
}

export type AdminAction =
  | { action: "status" }
  | { action: "clear" }
  | { action: "set-lock"; locked: boolean }
  | {
      action: "kick";
      anonymousId?: string;
      connectionId?: string;
    }
  | {
      action: "ban";
      kind: "anonymousId" | "ipHash";
      key: string;
      durationSeconds: number;
    }
  | {
      action: "unban";
      kind: "anonymousId" | "ipHash";
      key: string;
    }
  | { action: "delete-room" };
