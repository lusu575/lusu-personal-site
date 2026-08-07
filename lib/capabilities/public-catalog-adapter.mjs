import { resourcesContent } from "../../js/data/resources-content.mjs";
import { listCapabilities } from "./registry.mjs";
import { JAPANESE_SUBTEXT_TOOL_CONTRACT } from "./tool-contracts/japanese-subtext.mjs";
import { QUICK_TRANSFER_TOOL_CONTRACT } from "./tool-contracts/quick-transfer.mjs";
import { WHITEBOARD_TOOL_CONTRACT } from "./tool-contracts/whiteboard.mjs";

const LANGUAGES = new Set(["zh", "en", "ja"]);
const TOOL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_GAME_ENTRY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*\/?$/;
const GITHUB_REPOSITORY_PATTERN = /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;
const AGENT_GAME_PROFILES = Object.freeze({
  "2048": Object.freeze({
    localSession: true,
    browserBridge: true,
    browserPairing: false,
    surface: "integrated"
  }),
  hextris: Object.freeze({
    localSession: true,
    browserBridge: false,
    browserPairing: false,
    surface: "dedicated-process"
  })
});
const NO_AGENT_GAME_PROFILE = Object.freeze({
  localSession: false,
  browserBridge: false,
  browserPairing: false,
  surface: "none"
});
const PUBLIC_TOOL_CONTRACTS = Object.freeze({
  whiteboard: WHITEBOARD_TOOL_CONTRACT,
  "quick-transfer": QUICK_TRANSFER_TOOL_CONTRACT,
  "japanese-subtext": JAPANESE_SUBTEXT_TOOL_CONTRACT
});
const PUBLIC_TOOL_IDS = Object.freeze(Object.keys(PUBLIC_TOOL_CONTRACTS));

export class PublicCatalogError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "PublicCatalogError";
    this.code = String(options.code || "invalid_catalog");
    this.status = Number(options.status || (this.code === "not_found" ? 404 : this.code === "invalid_input" ? 400 : 500));
  }
}

export function listPublicTools({ lang = "zh" } = {}) {
  const normalizedLang = normalizeLanguage(lang);
  const entries = resourcesContent?.resources;
  if (!Array.isArray(entries)) throw invalidCatalog("The public tool catalog is unavailable.");

  const seenIds = new Set();
  const tools = entries.filter((entry) => entry?.toolId !== undefined).map((entry) => {
    const tool = projectTool(entry, normalizedLang);
    if (seenIds.has(tool.id)) throw invalidCatalog(`Duplicate public tool id: ${tool.id}`);
    seenIds.add(tool.id);
    return tool;
  });
  if (tools.length !== PUBLIC_TOOL_IDS.length
    || PUBLIC_TOOL_IDS.some((id) => !seenIds.has(id))) {
    throw invalidCatalog("The public tool catalog does not match the fixed tool allowlist.");
  }
  return { lang: normalizedLang, tools };
}

export function getPublicTool(toolId, { lang = "zh" } = {}) {
  const id = normalizePublicId(toolId, "Tool id");
  const catalog = listPublicTools({ lang });
  const tool = catalog.tools.find((entry) => entry.id === id);
  if (!tool) {
    throw new PublicCatalogError(`Public tool not found: ${id}`, { code: "not_found", status: 404 });
  }
  return tool;
}

export function projectPublicGameCatalog(payload, { lang = "zh", agentOnly = false } = {}) {
  const normalizedLang = normalizeLanguage(lang);
  const normalizedAgentOnly = normalizeAgentOnly(agentOnly);
  if (!isRecord(payload) || !Array.isArray(payload.games) || payload.games.length > 50) {
    throw invalidCatalog("The public game catalog has an invalid shape.");
  }

  const seenIds = new Set();
  const games = payload.games.map((entry) => {
    const game = projectGame(entry, normalizedLang);
    if (seenIds.has(game.id)) throw invalidCatalog(`Duplicate public game id: ${game.id}`);
    seenIds.add(game.id);
    return game;
  }).filter((game) => !normalizedAgentOnly || game.agent.localSession);

  return {
    updated: optionalText(payload.updated, 32),
    lang: normalizedLang,
    agentOnly: normalizedAgentOnly,
    games
  };
}

export function getPublicGame(payload, gameId, { lang = "zh" } = {}) {
  const id = normalizePublicId(gameId, "Game id", GAME_ID_PATTERN);
  const game = projectPublicGameCatalog(payload, { lang }).games.find((entry) => entry.id === id);
  if (!game) {
    throw new PublicCatalogError(`Public game not found: ${id}`, { code: "not_found", status: 404 });
  }
  return game;
}

function projectTool(entry, lang) {
  if (!isRecord(entry)) throw invalidCatalog("A public tool entry must be an object.");
  const id = normalizeCatalogId(entry.toolId, "toolId", TOOL_ID_PATTERN);
  const contract = PUBLIC_TOOL_CONTRACTS[id];
  if (!contract) throw invalidCatalog(`Unknown public tool id: ${id}`);
  const capabilityDomain = normalizeCatalogId(entry.capabilityDomain, "capabilityDomain", TOOL_ID_PATTERN);
  if (capabilityDomain !== contract.capabilityDomain) {
    throw invalidCatalog(`Public tool ${id} has an unexpected capability domain.`);
  }
  const capabilities = listCapabilities({ domain: capabilityDomain }).map((capability) => ({
    id: capability.id,
    scope: capability.scope,
    readOnly: capability.readOnly,
    destructive: capability.destructive,
    idempotent: capability.idempotent,
    risk: capability.risk,
    status: capability.status,
    availableTransports: [...capability.availableTransports]
  }));
  if (!capabilities.length) throw invalidCatalog(`No capabilities are registered for tool: ${id}`);

  const open = projectToolOpen(entry, contract);
  return {
    id,
    title: localizedText(entry.title, lang, `Tool ${id}`),
    description: localizedText(entry.desc, lang, ""),
    version: optionalText(entry.version, 32),
    updated: optionalText(entry.updated, 32),
    tags: Array.isArray(entry.tags)
      ? entry.tags.slice(0, 20).map((tag) => localizedText(tag, lang, "")).filter(Boolean)
      : [],
    open,
    capabilityDomain,
    capabilities
  };
}

function projectToolOpen(entry, contract) {
  if (contract.open.type === "path") {
    if (entry.url !== contract.open.path || entry.action !== undefined) {
      throw invalidCatalog("A public tool has an unexpected launch target.");
    }
    return { type: "path", path: contract.open.path };
  }
  if (entry.action !== contract.open.action || entry.url !== undefined) {
    throw invalidCatalog("A public tool has an unexpected launch target.");
  }
  return { type: "site-action", action: contract.open.action };
}

function projectGame(entry, lang) {
  if (!isRecord(entry)) throw invalidCatalog("A public game entry must be an object.");
  const id = normalizeCatalogId(entry.id, "game id", GAME_ID_PATTERN);
  const entryPath = String(entry.entry || "").trim();
  if (!SAFE_GAME_ENTRY_PATTERN.test(entryPath) || entryPath.includes("..")) {
    throw invalidCatalog(`Game ${id} has an unsafe entry path.`);
  }
  if (!isRecord(entry.languageSupport)
    || !["zh", "en", "ja"].every((key) => typeof entry.languageSupport[key] === "boolean")) {
    throw invalidCatalog(`Game ${id} has invalid language support metadata.`);
  }
  if (!isRecord(entry.license)) throw invalidCatalog(`Game ${id} has invalid license metadata.`);
  if (!isRecord(entry.storage)
    || (entry.storage.scoreOnly !== undefined && typeof entry.storage.scoreOnly !== "boolean")
    || (entry.storage.keys !== undefined && (!Array.isArray(entry.storage.keys)
      || entry.storage.keys.length > 100
      || entry.storage.keys.some((key) => typeof key !== "string" || !key.trim() || key.length > 256)))) {
    throw invalidCatalog(`Game ${id} has invalid cloud-save metadata.`);
  }

  const repo = normalizeGithubRepository(entry.repo, `Game ${id} repository`);
  const licenseUrl = normalizeGithubRepository(entry.license.url, `Game ${id} license URL`);
  const normalizedEntry = entryPath.replace(/\/+$/, "");
  const launchQuery = new URLSearchParams({ lang });
  const agentProfile = AGENT_GAME_PROFILES[id] || NO_AGENT_GAME_PROFILE;

  return {
    id,
    title: localizedText(entry.titles, lang, requiredCatalogText(entry.title, `Game ${id} title`, 200)),
    summary: localizedText(entry.summaries, lang, ""),
    languageSupport: {
      zh: entry.languageSupport.zh,
      en: entry.languageSupport.en,
      ja: entry.languageSupport.ja
    },
    launchPath: `/games/${normalizedEntry}/?${launchQuery}`,
    license: {
      name: requiredCatalogText(entry.license.name, `Game ${id} license name`, 200),
      url: licenseUrl
    },
    repo,
    cloudSaveSupported: entry.storage.scoreOnly === true || Boolean(entry.storage.keys?.length),
    agent: { ...agentProfile }
  };
}

function normalizeGithubRepository(value, label) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw invalidCatalog(`${label} must be a GitHub repository URL.`);
  }
  if (url.protocol !== "https:" || (url.hostname !== "github.com" && url.hostname !== "www.github.com")
    || url.port || url.username || url.password || !GITHUB_REPOSITORY_PATTERN.test(url.pathname)) {
    throw invalidCatalog(`${label} must be a GitHub repository URL.`);
  }
  url.hostname = "github.com";
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizeLanguage(value) {
  const lang = String(value || "").trim().toLowerCase();
  if (!LANGUAGES.has(lang)) {
    throw new PublicCatalogError("Language must be zh, en, or ja.", {
      code: "invalid_input",
      status: 400
    });
  }
  return lang;
}

function normalizeAgentOnly(value) {
  if (typeof value !== "boolean") {
    throw new PublicCatalogError("agentOnly must be a boolean.", {
      code: "invalid_input",
      status: 400
    });
  }
  return value;
}

function localizedText(value, lang, fallback = "") {
  if (typeof value === "string") return boundedText(value, fallback, 4000);
  if (!isRecord(value)) return boundedText(fallback, "", 4000);
  return boundedText(value[lang] ?? value.zh ?? value.en ?? value.ja, fallback, 4000);
}

function boundedText(value, fallback, maxLength) {
  const text = String(value ?? fallback ?? "").normalize("NFKC").trim();
  if (text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    throw invalidCatalog("The public catalog contains invalid text.");
  }
  return text;
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") return "";
  return boundedText(value, "", maxLength);
}

function requiredCatalogText(value, label, maxLength) {
  const text = boundedText(value, "", maxLength);
  if (!text) throw invalidCatalog(`${label} is required.`);
  return text;
}

function normalizePublicId(value, label, pattern = TOOL_ID_PATTERN) {
  const id = String(value || "").trim();
  if (!pattern.test(id)) {
    throw new PublicCatalogError(`${label} is invalid.`, { code: "invalid_input", status: 400 });
  }
  return id;
}

function normalizeCatalogId(value, label, pattern) {
  const id = String(value || "").trim();
  if (!pattern.test(id)) throw invalidCatalog(`The public catalog contains an invalid ${label}.`);
  return id;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidCatalog(message, cause) {
  return new PublicCatalogError(message, { code: "invalid_catalog", status: 500, cause });
}
