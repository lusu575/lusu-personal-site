const CAPABILITY_STATUSES = Object.freeze([
  "available",
  "existing-api",
  "adapter-planned",
  "restricted"
]);

const CAPABILITY_RISKS = Object.freeze(["low", "medium", "high", "critical"]);

const CAPABILITY_TRANSPORTS = Object.freeze([
  "site-api",
  "remote-mcp",
  "local-mcp",
  "cli",
  "browser-adapter"
]);

export const CAPABILITY_REGISTRY_VERSION = 1;

function defineCapability(capability) {
  const requiredKeys = [
    "id",
    "domain",
    "scope",
    "transport",
    "readOnly",
    "destructive",
    "idempotent",
    "risk",
    "status"
  ];
  for (const key of requiredKeys) {
    if (capability[key] === undefined) {
      throw new TypeError(`Capability ${capability.id || "<unknown>"} is missing ${key}.`);
    }
  }
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(capability.id)) {
    throw new TypeError(`Invalid capability id: ${capability.id}`);
  }
  if (!CAPABILITY_STATUSES.includes(capability.status)) {
    throw new TypeError(`Invalid capability status for ${capability.id}: ${capability.status}`);
  }
  if (!CAPABILITY_RISKS.includes(capability.risk)) {
    throw new TypeError(`Invalid capability risk for ${capability.id}: ${capability.risk}`);
  }
  if (!Array.isArray(capability.transport) || capability.transport.length === 0) {
    throw new TypeError(`Capability ${capability.id} must declare at least one transport.`);
  }
  for (const transport of capability.transport) {
    if (!CAPABILITY_TRANSPORTS.includes(transport)) {
      throw new TypeError(`Invalid capability transport for ${capability.id}: ${transport}`);
    }
  }
  const defaultAvailableTransports = capability.status === "existing-api"
    || capability.status === "restricted"
    ? capability.transport.filter((transport) => transport === "site-api")
    : [];
  const availableTransports = capability.availableTransports ?? defaultAvailableTransports;
  if (!Array.isArray(availableTransports)) {
    throw new TypeError(`Capability ${capability.id} availableTransports must be an array.`);
  }
  for (const transport of availableTransports) {
    if (!capability.transport.includes(transport)) {
      throw new TypeError(`Capability ${capability.id} cannot make undeclared transport available: ${transport}`);
    }
  }
  return Object.freeze({
    ...capability,
    transport: Object.freeze([...new Set(capability.transport)]),
    availableTransports: Object.freeze([...new Set(availableTransports)])
  });
}

const capabilities = [
  {
    id: "content.articles.list",
    domain: "public-content",
    scope: "content:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "remote-mcp", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "content.articles.search",
    domain: "public-content",
    scope: "content:read",
    transport: ["remote-mcp", "local-mcp", "cli"],
    availableTransports: ["remote-mcp", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "content.articles.get",
    domain: "public-content",
    scope: "content:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "remote-mcp", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "content.daily-ai-news.get",
    domain: "public-content",
    scope: "content:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "remote-mcp", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "content.videos.list",
    domain: "public-content",
    scope: "content:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "content.videos.get",
    domain: "public-content",
    scope: "content:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "content.tools.catalog",
    domain: "public-content",
    scope: "content:read",
    transport: ["local-mcp", "cli"],
    availableTransports: ["local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "transfer.rooms.join",
    domain: "transfer",
    scope: "transfer:write",
    transport: ["site-api", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: false,
    risk: "medium",
    status: "available"
  },
  {
    id: "transfer.items.list",
    domain: "transfer",
    scope: "transfer:read",
    transport: ["site-api", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "available"
  },
  {
    id: "transfer.text.send",
    domain: "transfer",
    scope: "transfer:write",
    transport: ["site-api", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: false,
    risk: "medium",
    status: "available"
  },
  {
    id: "transfer.files.upload",
    domain: "transfer",
    scope: "transfer:write",
    transport: ["site-api", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: false,
    risk: "high",
    status: "available"
  },
  {
    id: "transfer.files.download",
    domain: "transfer",
    scope: "transfer:read",
    transport: ["site-api", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "high",
    status: "available"
  },
  {
    id: "transfer.items.delete",
    domain: "transfer",
    scope: "transfer:delete",
    transport: ["site-api", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: true,
    idempotent: true,
    risk: "high",
    status: "available"
  },
  {
    id: "whiteboard.rooms.join",
    domain: "whiteboard",
    scope: "whiteboard:read",
    transport: ["site-api", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: false,
    risk: "medium",
    status: "available"
  },
  {
    id: "whiteboard.scene.read",
    domain: "whiteboard",
    scope: "whiteboard:read",
    transport: ["site-api", "local-mcp", "cli", "browser-adapter"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "available"
  },
  {
    id: "whiteboard.scene.apply",
    domain: "whiteboard",
    scope: "whiteboard:write",
    transport: ["site-api", "local-mcp", "cli", "browser-adapter"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: true,
    risk: "high",
    status: "available"
  },
  {
    id: "whiteboard.assets.upload",
    domain: "whiteboard",
    scope: "whiteboard:assets",
    transport: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: false,
    risk: "high",
    status: "existing-api"
  },
  {
    id: "whiteboard.scene.export",
    domain: "whiteboard",
    scope: "whiteboard:read",
    transport: ["local-mcp", "cli", "browser-adapter"],
    availableTransports: ["local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "available"
  },
  {
    id: "japanese-subtext.levels.list",
    domain: "japanese-subtext",
    scope: "japanese-subtext:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "japanese-subtext.stages.list",
    domain: "japanese-subtext",
    scope: "japanese-subtext:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "japanese-subtext.stages.get",
    domain: "japanese-subtext",
    scope: "japanese-subtext:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "japanese-subtext.progress.get",
    domain: "japanese-subtext",
    scope: "japanese-subtext:progress:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "available"
  },
  {
    id: "japanese-subtext.attempts.submit",
    domain: "japanese-subtext",
    scope: "japanese-subtext:progress:write",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "available"
  },
  {
    id: "japanese-subtext.progress.update",
    domain: "japanese-subtext",
    scope: "japanese-subtext:progress:write",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "existing-api"
  },
  {
    id: "games.catalog.list",
    domain: "games",
    scope: "games:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "games.catalog.get",
    domain: "games",
    scope: "games:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    availableTransports: ["site-api", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "low",
    status: "available"
  },
  {
    id: "games.session.create",
    domain: "games",
    scope: "games:play",
    transport: ["local-mcp", "cli", "browser-adapter"],
    availableTransports: ["local-mcp", "cli", "browser-adapter"],
    readOnly: false,
    destructive: false,
    idempotent: false,
    risk: "medium",
    status: "available"
  },
  {
    id: "games.session.observe",
    domain: "games",
    scope: "games:play",
    transport: ["local-mcp", "cli", "browser-adapter"],
    availableTransports: ["local-mcp", "cli", "browser-adapter"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "available"
  },
  {
    id: "games.session.actions",
    domain: "games",
    scope: "games:play",
    transport: ["local-mcp", "cli", "browser-adapter"],
    availableTransports: ["local-mcp", "cli", "browser-adapter"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "available"
  },
  {
    id: "games.session.act",
    domain: "games",
    scope: "games:play",
    transport: ["local-mcp", "cli", "browser-adapter"],
    availableTransports: ["local-mcp", "cli", "browser-adapter"],
    readOnly: false,
    destructive: false,
    idempotent: true,
    risk: "high",
    status: "available"
  },
  {
    id: "games.session.close",
    domain: "games",
    scope: "games:play",
    transport: ["local-mcp", "cli"],
    availableTransports: ["local-mcp", "cli"],
    readOnly: false,
    destructive: true,
    idempotent: true,
    risk: "high",
    status: "available"
  },
  {
    id: "games.saves.get",
    domain: "games",
    scope: "game-saves:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "existing-api"
  },
  {
    id: "games.saves.update",
    domain: "games",
    scope: "game-saves:write",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: true,
    risk: "high",
    status: "existing-api"
  },
  {
    id: "chat.messages.list",
    domain: "chat",
    scope: "chat:read",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    readOnly: true,
    destructive: false,
    idempotent: true,
    risk: "medium",
    status: "existing-api"
  },
  {
    id: "chat.messages.send",
    domain: "chat",
    scope: "chat:write",
    transport: ["site-api", "remote-mcp", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: false,
    risk: "high",
    status: "existing-api"
  },
  {
    id: "automation.daily-ai-news.publish",
    domain: "automation",
    scope: "automation:daily-ai-news:publish",
    transport: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: true,
    risk: "critical",
    status: "restricted"
  },
  {
    id: "automation.tool-radar.publish",
    domain: "automation",
    scope: "automation:tool-radar:publish",
    transport: ["site-api", "local-mcp", "cli"],
    readOnly: false,
    destructive: false,
    idempotent: true,
    risk: "critical",
    status: "restricted"
  }
].map(defineCapability);

const capabilityIds = new Set();
for (const capability of capabilities) {
  if (capabilityIds.has(capability.id)) {
    throw new TypeError(`Duplicate capability id: ${capability.id}`);
  }
  capabilityIds.add(capability.id);
}

export const CAPABILITY_REGISTRY = Object.freeze(capabilities);
export const CAPABILITY_STATUS_VALUES = CAPABILITY_STATUSES;
export const CAPABILITY_RISK_VALUES = CAPABILITY_RISKS;
export const CAPABILITY_TRANSPORT_VALUES = CAPABILITY_TRANSPORTS;

const FILTER_KEYS = new Set([
  "id",
  "domain",
  "scope",
  "transport",
  "availableTransports",
  "readOnly",
  "destructive",
  "idempotent",
  "risk",
  "status"
]);

function matchesExpected(actual, expected) {
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  if (Array.isArray(actual)) {
    return expectedValues.some((value) => actual.includes(value));
  }
  return expectedValues.includes(actual);
}

export function filterCapabilities(filters = {}) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new TypeError("Capability filters must be an object.");
  }
  for (const key of Object.keys(filters)) {
    if (!FILTER_KEYS.has(key)) {
      throw new TypeError(`Unsupported capability filter: ${key}`);
    }
  }
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null);
  return CAPABILITY_REGISTRY.filter((capability) => (
    entries.every(([key, expected]) => matchesExpected(capability[key], expected))
  ));
}

export function listCapabilities(filters = {}) {
  return filterCapabilities(filters);
}

export function getCapability(id) {
  const normalizedId = String(id || "").trim();
  return CAPABILITY_REGISTRY.find((capability) => capability.id === normalizedId) || null;
}
