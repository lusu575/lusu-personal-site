import { WorkerHttpError } from "./security";

/** Private MCP identity is a stable database ID, never an email or role alias. */
export function assertPrivateOwner(env: { MCP_OWNER_USER_ID?: string }, userId: string): void {
  const ownerId = env.MCP_OWNER_USER_ID?.trim();
  if (!ownerId) {
    throw new WorkerHttpError("Private MCP owner is not configured.", 503, "MCP_OWNER_NOT_CONFIGURED");
  }
  if (!userId || userId !== ownerId) {
    throw new WorkerHttpError("This account cannot use the private MCP.", 403, "MCP_OWNER_REQUIRED");
  }
}
