import { mkdir, open, rm } from "node:fs/promises";
import { dirname } from "node:path";

export async function acquireSingleInstanceLock(lockPath) {
  await mkdir(dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, "wx");
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("Another MiniMax H3 Runner instance already owns the local lock.");
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await handle.close();
    await rm(lockPath, { force: true });
  };
}
