export const COST_GUARD_VERSION: string;
export const COST_LIMITS: Readonly<{
  dynamic: { daily: number; monthly: number; r2a: number };
  realtime: { daily: number; monthly: number; r2a: number };
  cleanup: { daily: number; monthly: number; r2a: number };
  "whiteboard-cleanup": { daily: number; monthly: number; r2a: number };
  "relay-cleanup": { daily: number; monthly: number; r2a: number };
  envelope: { d1: number; r2a: number; r2b: number; deletes: number; durable: number; storage: number; kv: number };
  storageBytes: number; maxUploadBytes: number; leaseMs: number; operationMs: number;
}>;
export class CostGuardError extends Error { code: string; status: number; constructor(code?: string); }
export function costGuardResponse(error?: CostGuardError): Response;
export function costGuardStatus(env: object): { version: string; mode: string; dynamicConfigured: boolean; cleanupConfigured: boolean; reviewExpiresAt: string | null; staticAvailable: boolean };
export function assertCostConfiguration(env: object, lane?: "dynamic" | "realtime" | "cleanup" | "whiteboard-cleanup" | "relay-cleanup", feature?: string): void;
export function hasCostScope(env: object): boolean;
export function guardDurableStorage<T extends object>(storage: T, currentEnv: () => object): T;
export function admitCost<T extends object>(env: T, options?: { lane?: "dynamic" | "realtime" | "cleanup" | "whiteboard-cleanup" | "relay-cleanup"; feature?: string; uploadBytes?: number }): Promise<T>;

export function admitRealtimeEvent<T extends object>(env: T, previous: T | undefined, feature: string): Promise<T>;
export function rearmCleanupAlarm(env: object, storage: { setAlarm(time: number): Promise<void> }, lane: "whiteboard-cleanup" | "relay-cleanup", error: unknown): Promise<boolean>;
