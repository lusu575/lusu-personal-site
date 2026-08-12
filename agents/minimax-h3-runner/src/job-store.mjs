import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export async function writeJsonAtomic(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", flag: "wx" });
  await rename(temporary, target);
}

export async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

export function jobPaths(config, jobId) {
  const root = resolve(config.stateRoot);
  return {
    root,
    job: join(root, "jobs", `${jobId}.json`),
    plan: join(root, "plans", `${jobId}.json`),
    resultDir: join(root, "results", jobId),
    result: join(root, "results", jobId, "result.mp4")
  };
}

export async function persistClaim(config, job, plan, paths) {
  await writeJsonAtomic(paths.job, { ...job, localState: "claimed", planPath: paths.plan });
  await writeJsonAtomic(paths.plan, plan);
}

export async function copyVerifiedResult(sourcePath, targetPath, expectedSha256) {
  const source = resolve(sourcePath);
  const target = resolve(targetPath);
  const sourceInfo = await stat(source);
  if (!sourceInfo.isFile() || sourceInfo.size <= 0) throw new Error("Controller returned an empty or non-file result.");
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.part-${process.pid}-${Date.now()}`;
  await copyFile(source, temporary);
  const targetInfo = await stat(temporary);
  if (targetInfo.size !== sourceInfo.size) {
    await rm(temporary, { force: true });
    throw new Error("Local result copy size did not match the controller result.");
  }
  const actualSha256 = await sha256File(temporary);
  if (actualSha256 !== expectedSha256) {
    await rm(temporary, { force: true });
    throw new Error("Local result hash did not match the controller result.");
  }
  await rename(temporary, target);
  return { bytes: targetInfo.size, sha256: actualSha256 };
}

export async function sha256File(path) {
  const { createHash } = await import("node:crypto");
  const { createReadStream } = await import("node:fs");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(resolve(path))) hash.update(chunk);
  return hash.digest("hex");
}
