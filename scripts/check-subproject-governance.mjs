import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const governanceRoots = ["docs/whiteboard", "docs/transfer"];

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function git(args, { optional = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", optional ? "ignore" : "pipe"],
    }).trim();
  } catch (error) {
    if (optional) return "";
    throw error;
  }
}

function gitSucceeds(args) {
  try {
    execFileSync("git", args, {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function parseVersion(value, label) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  if (!match) throw new Error(`${label} must be an exact major.minor.patch version`);
  return match.slice(1).map(Number);
}

function resolveBaseRef() {
  const explicit = String(process.env.SUBPROJECT_BASE_REF || "").trim();
  if (explicit && !/^0+$/.test(explicit) && gitSucceeds(["cat-file", "-e", `${explicit}^{commit}`])) {
    return explicit;
  }
  const branch = git(["branch", "--show-current"], { optional: true });
  if (!branch || branch === "main") return "";
  if (!gitSucceeds(["cat-file", "-e", "origin/main^{commit}"])) return "";
  return git(["merge-base", "HEAD", "origin/main"], { optional: true });
}

function pathIsTracked(path, trackedPaths) {
  return trackedPaths.some((trackedPath) => (
    trackedPath.endsWith("/") ? path.startsWith(trackedPath) : path === trackedPath
  ));
}

export function checkSubprojectGovernance() {
  const errors = [];
  const projects = governanceRoots.map((governanceRoot) => {
    const project = JSON.parse(read(`${governanceRoot}/project.json`));
    const version = read(`${governanceRoot}/VERSION`).trim();
    try {
      parseVersion(version, `${project.id} VERSION`);
    } catch (error) {
      errors.push(error.message);
    }
    if (project.version !== version) errors.push(`${project.id} project.json version must equal VERSION`);
    if (project.versionStep !== "0.0.1") errors.push(`${project.id} versionStep must stay 0.0.1`);
    if (project.governanceRoot !== governanceRoot) errors.push(`${project.id} governanceRoot is inconsistent`);
    if (!Array.isArray(project.trackedPaths) || project.trackedPaths.length === 0) {
      errors.push(`${project.id} must declare trackedPaths`);
    }
    for (const document of ["README.md", "AGENT.md", "AGENTS.md", "CHANGELOG.md", "VERSION"]) {
      if (!project.documents?.includes(document)) errors.push(`${project.id} project.json must list ${document}`);
      if (!existsSync(resolve(root, governanceRoot, document))) errors.push(`${project.id} is missing ${document}`);
    }
    const readme = read(`${governanceRoot}/README.md`);
    const changelog = read(`${governanceRoot}/CHANGELOG.md`);
    const agent = read(`${governanceRoot}/AGENT.md`);
    const agents = read(`${governanceRoot}/AGENTS.md`);
    if (!readme.includes(version)) errors.push(`${project.id} README must show version ${version}`);
    if (!changelog.includes(`## ${version} -`)) errors.push(`${project.id} CHANGELOG must lead with version ${version}`);
    if (!agent.includes("AGENTS.md")) errors.push(`${project.id} AGENT.md must point to AGENTS.md`);
    for (const token of ["0.0.1", "VERSION", "project.json", "CHANGELOG.md", "README.md"]) {
      if (!agents.includes(token)) errors.push(`${project.id} AGENTS.md must require ${token}`);
    }
    for (const visibleFile of project.visibleVersionFiles || []) {
      if (!read(visibleFile).includes(version)) {
        errors.push(`${project.id} visible version ${version} is missing from ${visibleFile}`);
      }
    }
    return { governanceRoot, project, version };
  });

  const rootAgents = read("AGENTS.md");
  for (const { governanceRoot, project } of projects) {
    if (!rootAgents.includes(`${governanceRoot}/AGENTS.md`)) {
      errors.push(`root AGENTS.md must route ${project.id} work to ${governanceRoot}/AGENTS.md`);
    }
  }

  const baseRef = resolveBaseRef();
  if (baseRef) {
    const changedPaths = git(["diff", "--name-only", baseRef, "--"]).split(/\r?\n/).filter(Boolean);
    for (const { governanceRoot, project, version } of projects) {
      const versionPath = `${governanceRoot}/VERSION`;
      if (!gitSucceeds(["cat-file", "-e", `${baseRef}:${versionPath}`])) continue;
      const changed = changedPaths.some((path) => pathIsTracked(path.replaceAll("\\", "/"), project.trackedPaths));
      if (!changed) continue;
      const previousVersion = git(["show", `${baseRef}:${versionPath}`]);
      if (previousVersion === version) {
        errors.push(`${project.id} changed without the required +0.0.1 version bump`);
        continue;
      }
      try {
        const previous = parseVersion(previousVersion, `${project.id} previous version`);
        const current = parseVersion(version, `${project.id} current version`);
        if (current[0] !== previous[0] || current[1] !== previous[1] || current[2] !== previous[2] + 1) {
          errors.push(`${project.id} must move exactly from ${previousVersion} to ${previous[0]}.${previous[1]}.${previous[2] + 1}`);
        }
      } catch (error) {
        errors.push(error.message);
      }
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return projects.map(({ project, version }) => `${project.id}@${version}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projects = checkSubprojectGovernance();
  console.log(`subproject-governance: ok (${projects.join(", ")})`);
}
