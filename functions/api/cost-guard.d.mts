export const COST_GUARD_VERSION: string;
export const COST_LIMITS: Readonly<{
  dynamic: { daily: number; monthly: number };
  cleanup: { daily: number; monthly: number };
  envelope: { d1: number; r2a: number; r2b: number; deletes: number; durable: number; storage: number; kv: number };
  storageBytes: number; maxUploadBytes: number; leaseMs: number; operationMs: number;
}>;
export class CostGuardError extends Error { code: string; status: number; constructor(code?: string); }
export function costGuardResponse(error?: CostGuardError): Response;
export function costGuardStatus(env: object): { version: string; mode: string; dynamicConfigured: boolean; cleanupConfigured: boolean; reviewExpiresAt: string | null; staticAvailable: boolean };
export function assertCostConfiguration(env: object, lane?: "dynamic" | "cleanup", feature?: string): void;
export function hasCostScope(env: object): boolean;
export function guardDurableStorage<T extends object>(storage: T, currentEnv: () => object): T;
export function admitCost<T extends object>(env: T, options?: { lane?: "dynamic" | "cleanup"; feature?: string; uploadBytes?: number }): Promise<T>;
