import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  GAME_AGENT_MAX_REVISION,
  GameProtocolError,
  assertExactKeys,
  cloneBoundedJson,
  deepFreezeJson
} from "../game-protocol.mjs";

// Semantic behavior is adapted from VickScarlet/remake at the pinned commit
// below under MIT. See games/life-restart/NOTICE.md and source/LICENSE.txt.

export const LIFE_RESTART_GAME_ID = "life-restart";
export const LIFE_RESTART_STATE_VERSION = 2;
export const LIFE_RESTART_MODE = "custom";
export const LIFE_RESTART_SOURCE_COMMIT = "a10861eed93296c96d0e0fca98c82e86f4dfda4b";
export const LIFE_RESTART_DATA_SHA256 = Object.freeze({
  age: "c0d398c4dd2bd5552f746ec24a4113389dfe014c80e493df9246dabbd6187a23",
  talents: "715353f26504335b86837ac43b980c537021fb5889d99330507449e6613de32d",
  events: "c06b3d7893f3774b0e8d294cce9038b04660cd250eb9ce5cd18effdfbea40bf3"
});

const DEFAULT_NON_ZERO_SEED = 0x6d2b79f5;
const OFFERED_TALENT_COUNT = 10;
const SELECTED_TALENT_COUNT = 3;
const DEFAULT_PROPERTY_POINTS = 20;
const DEFAULT_SPIRIT = 5;
const MAX_EVENT_CHAIN = 24;
const MAX_HISTORY = 24;
const MAX_ACTIVE_TALENTS = 64;
const MAX_SEEN_EVENTS = 5_000;
const MAX_PROPERTY_ABS = 1_000_000_000;
const MAX_GENERATION = 1_000_000;
const MAX_COMPLETED_LIVES = 1_000_000;
const MAX_CURRENT_LIFE_ADVANCES = 2_048;
const MAX_STATE_BYTES = 64 * 1024;
const MAX_OBSERVATION_BYTES = 56 * 1024;
const PROPERTY_ALLOCATION_KEYS = Object.freeze(["CHR", "INT", "STR", "MNY"]);
const VISIBLE_PROPERTY_KEYS = Object.freeze(["AGE", "CHR", "INT", "STR", "MNY", "SPR", "LIF"]);
const EXTREME_PROPERTY_KEYS = Object.freeze(["AGE", "CHR", "INT", "STR", "MNY", "SPR"]);
const CONDITION_PROPERTIES = new Set([
  "AEVT", "AGE", "CHR", "EVT", "INT", "MNY", "SPR", "STR", "TLT", "TMS"
]);
const EFFECT_PROPERTIES = new Set(["AGE", "CHR", "INT", "LIF", "MNY", "RDM", "SPR", "STR"]);
const PHASES = new Set(["talent-selection", "property-allocation", "trajectory", "summary"]);
const CHECKPOINT_ORIGINS = new Set(["create", "reset", "restart"]);
const TOP_LEVEL_STATE_KEYS = Object.freeze([
  "version",
  "mode",
  "sourceCommit",
  "dataHashes",
  "calendarYear",
  "initialSeed",
  "rngState",
  "revision",
  "generation",
  "completedLives",
  "currentLifeCheckpoint",
  "phase",
  "inheritedTalentId",
  "offeredTalentIds",
  "selectedTalentIds",
  "activeTalentIds",
  "propertyPoints",
  "allocation",
  "properties",
  "lows",
  "highs",
  "seenEventIds",
  "allSeenEventIds",
  "talentTriggerCounts",
  "history",
  "summary"
]);

let officialDataCache;

export function createLifeRestartAdapter(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw lifeError("Adapter options must be an object.", "ADAPTER_OPTIONS_INVALID");
  }
  const allowedOptionKeys = new Set(["seedFactory", "calendarYearFactory", "data", "allowTestData"]);
  if (Object.keys(options).some((key) => !allowedOptionKeys.has(key))) {
    throw lifeError("Adapter options contain unsupported fields.", "ADAPTER_OPTIONS_INVALID");
  }
  if (options.seedFactory !== undefined && typeof options.seedFactory !== "function") {
    throw lifeError("seedFactory must be a function.", "ADAPTER_OPTIONS_INVALID");
  }
  if (options.calendarYearFactory !== undefined && typeof options.calendarYearFactory !== "function") {
    throw lifeError("calendarYearFactory must be a function.", "ADAPTER_OPTIONS_INVALID");
  }
  if (options.data !== undefined && options.allowTestData !== true) {
    throw lifeError("Injected data is reserved for explicit test fixtures.", "ADAPTER_TEST_DATA_NOT_ALLOWED");
  }

  let injectedData;
  const getData = () => {
    if (options.data === undefined) return loadOfficialDataSet();
    injectedData ||= normalizeInjectedDataSet(options.data);
    return injectedData;
  };

  return Object.freeze({
    gameId: LIFE_RESTART_GAME_ID,

    create(createOptions = {}) {
      const normalized = normalizeCreateOptions(createOptions, options);
      return createSelectionState(getData(), {
        calendarYear: normalized.calendarYear,
        initialSeed: normalized.seed,
        rngState: normalized.seed,
        revision: 0,
        generation: 1,
        completedLives: 0,
        origin: "create",
        inheritedTalentId: null,
        allSeenEventIds: []
      });
    },

    restore(value) {
      return restoreLifeRestartState(value, getData());
    },

    serialize(value) {
      const state = restoreLifeRestartState(value, getData());
      return cloneBoundedJson(state, {
        label: "Life Restart state",
        maxBytes: MAX_STATE_BYTES,
        maxDepth: 12,
        maxNodes: 12_000
      });
    },

    revision(value) {
      return restoreLifeRestartState(value, getData()).revision;
    },

    observe(value) {
      return observeLifeRestartState(restoreLifeRestartState(value, getData()), getData());
    },

    actions(value) {
      return actionsForLifeRestartState(restoreLifeRestartState(value, getData()), getData());
    },

    normalizeAction(action) {
      return normalizeLifeRestartAction(action);
    },

    act(value, action) {
      const data = getData();
      const state = restoreLifeRestartState(value, data);
      const normalizedAction = normalizeLifeRestartAction(action);
      return applyLifeRestartAction(state, normalizedAction, data);
    }
  });
}

export function normalizeLifeRestartAction(action) {
  const normalized = cloneBoundedJson(action, {
    label: "Life Restart action",
    maxBytes: 2 * 1024,
    maxDepth: 4,
    maxNodes: 48
  });
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw lifeError("The Life Restart action must be an object.", "ACTION_INVALID");
  }

  switch (normalized.type) {
    case "choose_talents": {
      assertExactKeys(normalized, ["type", "talentIds"], lifeCode("ACTION_INVALID"));
      if (!Array.isArray(normalized.talentIds) || normalized.talentIds.length !== SELECTED_TALENT_COUNT) {
        throw lifeError("Exactly three talent ids are required.", "ACTION_INVALID");
      }
      const talentIds = normalized.talentIds.map((value) => normalizeActionId(value, "talent id"));
      if (new Set(talentIds).size !== SELECTED_TALENT_COUNT) {
        throw lifeError("Talent ids must be unique.", "ACTION_INVALID");
      }
      return deepFreezeJson({ type: "choose_talents", talentIds });
    }
    case "allocate_properties": {
      assertExactKeys(normalized, ["type", "properties"], lifeCode("ACTION_INVALID"));
      const properties = normalizeAllocation(normalized.properties);
      return deepFreezeJson({ type: "allocate_properties", properties });
    }
    case "advance":
      assertExactKeys(normalized, ["type", "steps"], lifeCode("ACTION_INVALID"));
      if (normalized.steps !== 1) {
        throw lifeError("Life Restart advances exactly one year per action.", "ACTION_INVALID");
      }
      return Object.freeze({ type: "advance", steps: 1 });
    case "restart_life": {
      assertExactKeys(normalized, ["type", "inheritedTalentId"], lifeCode("ACTION_INVALID"));
      const inheritedTalentId = normalized.inheritedTalentId === null
        ? null
        : normalizeActionId(normalized.inheritedTalentId, "inherited talent id");
      return Object.freeze({ type: "restart_life", inheritedTalentId });
    }
    case "reset": {
      const keys = Object.keys(normalized);
      if (keys.some((key) => key !== "type" && key !== "confirm") || !keys.includes("type")) {
        throw lifeError("The reset action contains unsupported fields.", "ACTION_INVALID");
      }
      if (Object.hasOwn(normalized, "confirm") && typeof normalized.confirm !== "boolean") {
        throw lifeError("Reset confirmation must be a boolean.", "ACTION_INVALID");
      }
      return Object.freeze({ type: "reset", confirm: normalized.confirm === true });
    }
    default:
      throw lifeError("Unsupported Life Restart action type.", "ACTION_UNSUPPORTED");
  }
}

export const lifeRestartAdapter = createLifeRestartAdapter();

function loadOfficialDataSet() {
  if (officialDataCache) return officialDataCache;
  const raw = {};
  const parsed = {};
  for (const name of ["age", "talents", "events"]) {
    const url = new URL(`../../../games/life-restart/source/data/zh-cn/${name}.json`, import.meta.url);
    const bytes = readFileSync(url);
    const hash = sha256(bytes);
    if (hash !== LIFE_RESTART_DATA_SHA256[name]) {
      throw lifeError(`The bundled ${name}.json integrity check failed.`, "DATA_INTEGRITY_FAILED");
    }
    raw[name] = bytes;
    try {
      parsed[name] = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      throw lifeError(`The bundled ${name}.json is invalid.`, "DATA_INVALID", error);
    }
  }
  officialDataCache = normalizeDataSet(parsed, LIFE_RESTART_DATA_SHA256);
  return officialDataCache;
}

function normalizeInjectedDataSet(value) {
  const cloned = cloneBoundedJson(value, {
    label: "Life Restart fixture data",
    maxBytes: 3 * 1024 * 1024,
    maxDepth: 12,
    maxNodes: 250_000
  });
  assertExactKeys(cloned, ["age", "talents", "events"], lifeCode("DATA_INVALID"));
  const hashes = {};
  for (const name of ["age", "talents", "events"]) {
    hashes[name] = sha256(Buffer.from(JSON.stringify(cloned[name]), "utf8"));
  }
  return normalizeDataSet(cloned, hashes);
}

function normalizeDataSet(raw, hashes) {
  const talents = normalizeTalentData(raw.talents);
  const events = normalizeEventData(raw.events);
  const ages = normalizeAgeData(raw.age);
  if (Object.values(talents).filter((talent) => !talent.exclusive).length < OFFERED_TALENT_COUNT) {
    throw lifeError("Life Restart needs at least ten selectable talents.", "DATA_INVALID");
  }
  for (const age of Object.values(ages)) {
    for (const [eventId] of age.events) {
      if (!events[eventId]) throw lifeError("Age data references an unknown event.", "DATA_INVALID");
    }
    for (const talentId of age.talents) {
      if (!talents[talentId]) throw lifeError("Age data references an unknown talent.", "DATA_INVALID");
    }
  }
  for (const talent of Object.values(talents)) {
    for (const excludedId of talent.exclude) {
      if (!talents[excludedId]) throw lifeError("A talent exclusion references an unknown talent.", "DATA_INVALID");
    }
    for (const [targetId] of talent.replacement?.talent || []) {
      if (!talents[targetId]) throw lifeError("A talent replacement references an unknown talent.", "DATA_INVALID");
    }
  }
  for (const event of Object.values(events)) {
    for (const branch of event.branches) {
      if (!events[branch.next]) throw lifeError("An event branch references an unknown event.", "DATA_INVALID");
    }
  }
  return Object.freeze({
    ages,
    talents,
    events,
    hashes: deepFreezeJson({ ...hashes })
  });
}

function normalizeAgeData(value) {
  if (!isPlainObject(value) || !Object.keys(value).length || Object.keys(value).length > 1_001) {
    throw lifeError("Age data must be a bounded object.", "DATA_INVALID");
  }
  const ages = Object.create(null);
  for (const [key, rawAge] of Object.entries(value)) {
    if (!isPlainObject(rawAge)) throw lifeError("An age record is invalid.", "DATA_INVALID");
    const allowed = new Set(["age", "event", "talent"]);
    if (Object.keys(rawAge).some((field) => !allowed.has(field))) {
      throw lifeError("An age record contains unsupported fields.", "DATA_INVALID");
    }
    const age = normalizeBoundedInteger(rawAge.age, "age", 0, 1_000);
    if (String(age) !== String(Number(key))) throw lifeError("An age record key is inconsistent.", "DATA_INVALID");
    if (!Array.isArray(rawAge.event) || !rawAge.event.length || rawAge.event.length > 4_096) {
      throw lifeError("An age event list is invalid.", "DATA_INVALID");
    }
    const events = rawAge.event.map(normalizeWeightedId);
    const talents = rawAge.talent === undefined
      ? []
      : normalizeIdArray(rawAge.talent, "age talents", MAX_ACTIVE_TALENTS);
    ages[age] = deepFreezeJson({ age, events, talents });
  }
  return Object.freeze(ages);
}

function normalizeTalentData(value) {
  if (!isPlainObject(value) || !Object.keys(value).length || Object.keys(value).length > 1_000) {
    throw lifeError("Talent data must be a bounded object.", "DATA_INVALID");
  }
  const talents = Object.create(null);
  const allowed = new Set([
    "id", "name", "description", "grade", "exclude", "effect", "status", "condition", "replacement", "exclusive"
  ]);
  for (const [key, rawTalent] of Object.entries(value)) {
    if (!isPlainObject(rawTalent) || Object.keys(rawTalent).some((field) => !allowed.has(field))) {
      throw lifeError("A talent record is invalid.", "DATA_INVALID");
    }
    const id = normalizeId(rawTalent.id ?? key, "talent id");
    if (id !== Number(key) || talents[id]) throw lifeError("A talent id is inconsistent or duplicated.", "DATA_INVALID");
    const condition = normalizeCondition(rawTalent.condition);
    const talent = {
      id,
      name: normalizeText(rawTalent.name, "talent name", 256),
      description: normalizeText(rawTalent.description, "talent description", 1_024),
      grade: normalizeBoundedInteger(rawTalent.grade ?? 0, "talent grade", 0, 3),
      exclude: rawTalent.exclude === undefined ? [] : normalizeIdArray(rawTalent.exclude, "talent exclusions", 64),
      effect: normalizeEffect(rawTalent.effect),
      status: normalizeBoundedInteger(rawTalent.status ?? 0, "talent status", -40, 40),
      condition,
      maxTriggers: extractMaxTriggers(condition),
      replacement: normalizeReplacement(rawTalent.replacement),
      exclusive: normalizeBooleanFlag(rawTalent.exclusive, "talent exclusive flag")
    };
    talents[id] = deepFreezeJson(talent);
  }
  return Object.freeze(talents);
}

function normalizeEventData(value) {
  if (!isPlainObject(value) || !Object.keys(value).length || Object.keys(value).length > 5_000) {
    throw lifeError("Event data must be a bounded object.", "DATA_INVALID");
  }
  const events = Object.create(null);
  const allowed = new Set(["id", "event", "effect", "NoRandom", "branch", "exclude", "postEvent", "grade", "include"]);
  for (const [key, rawEvent] of Object.entries(value)) {
    if (!isPlainObject(rawEvent) || Object.keys(rawEvent).some((field) => !allowed.has(field))) {
      throw lifeError("An event record is invalid.", "DATA_INVALID");
    }
    const id = normalizeId(rawEvent.id ?? key, "event id");
    if (id !== Number(key) || events[id]) throw lifeError("An event id is inconsistent or duplicated.", "DATA_INVALID");
    let branches = [];
    if (rawEvent.branch !== undefined) {
      if (!Array.isArray(rawEvent.branch) || rawEvent.branch.length > MAX_EVENT_CHAIN) {
        throw lifeError("An event branch list is invalid.", "DATA_INVALID");
      }
      branches = rawEvent.branch.map((entry) => {
        const text = normalizeText(entry, "event branch", 512);
        const separator = text.lastIndexOf(":");
        if (separator <= 0 || separator === text.length - 1) {
          throw lifeError("An event branch is invalid.", "DATA_INVALID");
        }
        return deepFreezeJson({
          condition: normalizeCondition(text.slice(0, separator)),
          next: normalizeId(text.slice(separator + 1), "branch event id")
        });
      });
    }
    events[id] = deepFreezeJson({
      id,
      description: normalizeText(rawEvent.event, "event description", 2_048),
      postEvent: rawEvent.postEvent === undefined ? null : normalizeText(rawEvent.postEvent, "post-event text", 2_048),
      grade: normalizeBoundedInteger(rawEvent.grade ?? 0, "event grade", 0, 3),
      noRandom: normalizeBooleanFlag(rawEvent.NoRandom, "event no-random flag"),
      include: normalizeCondition(rawEvent.include),
      exclude: normalizeCondition(rawEvent.exclude),
      effect: normalizeEffect(rawEvent.effect),
      branches
    });
  }
  return Object.freeze(events);
}

function normalizeReplacement(value) {
  if (value === undefined) return null;
  if (!isPlainObject(value) || Object.keys(value).some((key) => key !== "grade" && key !== "talent")) {
    throw lifeError("A talent replacement is invalid.", "DATA_INVALID");
  }
  const normalizeList = (entries, label, gradeOnly = false) => {
    if (!Array.isArray(entries) || !entries.length || entries.length > 256) {
      throw lifeError(`${label} is invalid.`, "DATA_INVALID");
    }
    return entries.map((entry) => {
      const [id, weight] = normalizeWeightedId(entry);
      if (gradeOnly && (id < 0 || id > 3)) throw lifeError("A replacement grade is invalid.", "DATA_INVALID");
      return Object.freeze([id, weight]);
    });
  };
  const replacement = {
    grade: value.grade === undefined ? [] : normalizeList(value.grade, "replacement grades", true),
    talent: value.talent === undefined ? [] : normalizeList(value.talent, "replacement talents")
  };
  if (!replacement.grade.length && !replacement.talent.length) {
    throw lifeError("A talent replacement cannot be empty.", "DATA_INVALID");
  }
  return deepFreezeJson(replacement);
}

function normalizeEffect(value) {
  if (value === undefined) return null;
  if (!isPlainObject(value) || Object.keys(value).length > EFFECT_PROPERTIES.size) {
    throw lifeError("An effect is invalid.", "DATA_INVALID");
  }
  const effect = {};
  for (const [property, delta] of Object.entries(value)) {
    if (!EFFECT_PROPERTIES.has(property)) throw lifeError("An effect property is unsupported.", "DATA_INVALID");
    const numeric = Number(delta);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || Math.abs(numeric) > 1_000_000) {
      throw lifeError("An effect delta is invalid.", "DATA_INVALID");
    }
    effect[property] = numeric;
  }
  return deepFreezeJson(effect);
}

function normalizeCondition(value) {
  if (value === undefined || value === null || value === "") return null;
  const condition = normalizeText(value, "condition", 512);
  const parsed = parseCondition(condition);
  validateParsedCondition(parsed);
  return condition;
}

function parseCondition(condition) {
  const root = [];
  const stack = [root];
  let cursor = 0;
  const catchString = (index) => {
    const text = condition.slice(cursor, index).trim();
    cursor = index;
    if (text) stack[0].push(text);
  };
  for (let index = 0; index < condition.length; index += 1) {
    const character = condition[index];
    if (character === " ") continue;
    if (character === "(") {
      catchString(index);
      cursor += 1;
      const sub = [];
      stack[0].push(sub);
      stack.unshift(sub);
    } else if (character === ")") {
      if (stack.length === 1) throw lifeError("A condition has unbalanced parentheses.", "DATA_INVALID");
      catchString(index);
      cursor += 1;
      stack.shift();
    } else if (character === "|" || character === "&") {
      catchString(index);
      catchString(index + 1);
    }
  }
  if (stack.length !== 1) throw lifeError("A condition has unbalanced parentheses.", "DATA_INVALID");
  catchString(condition.length);
  return root;
}

function validateParsedCondition(value) {
  if (Array.isArray(value)) {
    if (!value.length || value.length % 2 === 0) throw lifeError("A condition expression is invalid.", "DATA_INVALID");
    value.forEach((entry, index) => {
      if (index % 2 === 1) {
        if (entry !== "&" && entry !== "|") throw lifeError("A condition operator is invalid.", "DATA_INVALID");
      } else {
        validateParsedCondition(entry);
      }
    });
    return;
  }
  const match = /^([A-Z]{2,8})(>=|<=|!=|>|<|=|\?|!)(-?\d+(?:\.\d+)?|\[(?:-?\d+(?:\.\d+)?(?:,\s*-?\d+(?:\.\d+)?)*)?\])$/.exec(value);
  if (!match || !CONDITION_PROPERTIES.has(match[1])) {
    throw lifeError("A condition atom is invalid.", "DATA_INVALID");
  }
  if ((match[2] === "?" || match[2] === "!") && !match[3].startsWith("[")) {
    throw lifeError("A condition membership operand is invalid.", "DATA_INVALID");
  }
}

function checkCondition(condition, state) {
  if (!condition) return true;
  return checkParsedCondition(parseCondition(condition), state);
}

function checkParsedCondition(value, state) {
  if (!Array.isArray(value)) return checkConditionAtom(value, state);
  if (value.length === 1) return checkParsedCondition(value[0], state);
  let result = checkParsedCondition(value[0], state);
  for (let index = 1; index < value.length; index += 2) {
    if (value[index] === "&") {
      if (result) result = checkParsedCondition(value[index + 1], state);
    } else if (result) {
      return true;
    } else {
      result = checkParsedCondition(value[index + 1], state);
    }
  }
  return result;
}

function checkConditionAtom(atom, state) {
  const match = /^([A-Z]{2,8})(>=|<=|!=|>|<|=|\?|!)(.+)$/.exec(atom);
  if (!match) return false;
  const [, property, operator, operandText] = match;
  const propertyValue = conditionProperty(state, property);
  let operand;
  try {
    operand = operandText.startsWith("[") ? JSON.parse(operandText) : Number(operandText);
  } catch {
    return false;
  }
  switch (operator) {
    case ">": return propertyValue > operand;
    case "<": return propertyValue < operand;
    case ">=": return propertyValue >= operand;
    case "<=": return propertyValue <= operand;
    case "=": return Array.isArray(propertyValue) ? propertyValue.includes(operand) : propertyValue == operand;
    case "!=": return Array.isArray(propertyValue) ? !propertyValue.includes(operand) : propertyValue != operand;
    case "?": return Array.isArray(propertyValue)
      ? propertyValue.some((entry) => operand.includes(entry))
      : operand.includes(propertyValue);
    case "!": return Array.isArray(propertyValue)
      ? propertyValue.every((entry) => !operand.includes(entry))
      : !operand.includes(propertyValue);
    default: return false;
  }
}

function conditionProperty(state, property) {
  if (VISIBLE_PROPERTY_KEYS.includes(property)) return state.properties?.[property] ?? 0;
  if (property === "TLT") return state.activeTalentIds;
  if (property === "EVT") return state.seenEventIds;
  if (property === "AEVT") return state.allSeenEventIds;
  if (property === "TMS") return state.completedLives;
  return 0;
}

function normalizeCreateOptions(value, adapterOptions) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw lifeError("Create options must be an object.", "CREATE_OPTIONS_INVALID");
  }
  if (Object.keys(value).some((key) => key !== "seed" && key !== "calendarYear")) {
    throw lifeError("Create options contain unsupported fields.", "CREATE_OPTIONS_INVALID");
  }
  const seedValue = value.seed ?? adapterOptions.seedFactory?.() ?? createRandomSeed();
  const calendarYearValue = value.calendarYear ?? adapterOptions.calendarYearFactory?.() ?? new Date().getFullYear();
  return {
    seed: normalizeSeed(seedValue),
    calendarYear: normalizeBoundedInteger(calendarYearValue, "calendarYear", 1, 9_999)
  };
}

function createSelectionState(data, input, internalOptions = {}) {
  const mutable = {
    version: LIFE_RESTART_STATE_VERSION,
    mode: LIFE_RESTART_MODE,
    sourceCommit: LIFE_RESTART_SOURCE_COMMIT,
    dataHashes: { ...data.hashes },
    calendarYear: input.calendarYear,
    initialSeed: input.initialSeed,
    rngState: input.rngState,
    revision: input.revision,
    generation: input.generation,
    completedLives: input.completedLives,
    currentLifeCheckpoint: {
      origin: input.origin,
      revision: input.revision,
      rngState: input.rngState,
      generation: input.generation,
      completedLives: input.completedLives,
      inheritedTalentId: input.inheritedTalentId,
      allSeenEventCount: input.allSeenEventIds.length,
      allSeenEventSha256: hashEventIdList(input.allSeenEventIds)
    },
    phase: "talent-selection",
    inheritedTalentId: input.inheritedTalentId,
    offeredTalentIds: [],
    selectedTalentIds: [],
    activeTalentIds: [],
    propertyPoints: null,
    allocation: null,
    properties: null,
    lows: null,
    highs: null,
    seenEventIds: [],
    allSeenEventIds: [...input.allSeenEventIds],
    talentTriggerCounts: {},
    history: [],
    summary: null
  };
  mutable.offeredTalentIds = drawTalents(mutable, data, input.inheritedTalentId);
  if (!findLegalTalentTriple(mutable.offeredTalentIds, data)) {
    throw lifeError("The talent offer has no legal three-talent selection.", "TALENT_OFFER_UNPLAYABLE");
  }
  return restoreLifeRestartState(mutable, data, internalOptions);
}

function drawTalents(state, data, inheritedTalentId) {
  const pools = { 0: [], 1: [], 2: [], 3: [] };
  for (const talent of Object.values(data.talents)) {
    if (!talent.exclusive && talent.id !== inheritedTalentId) pools[talent.grade].push(talent.id);
  }
  const offered = [];
  if (inheritedTalentId !== null) {
    const inherited = data.talents[inheritedTalentId];
    if (!inherited || inherited.exclusive) throw lifeError("The inherited talent is unavailable.", "INHERITED_TALENT_INVALID");
    offered.push(inheritedTalentId);
  }
  while (offered.length < OFFERED_TALENT_COUNT) {
    const gradeRoll = Math.floor(nextRandom(state) * 1_000);
    let grade = gradeRoll < 1 ? 3 : gradeRoll < 11 ? 2 : gradeRoll < 111 ? 1 : 0;
    while (grade >= 0 && pools[grade].length === 0) grade -= 1;
    if (grade < 0) {
      grade = [0, 1, 2, 3].find((candidate) => pools[candidate].length > 0) ?? -1;
    }
    if (grade < 0) throw lifeError("The talent pool was exhausted.", "TALENT_POOL_EXHAUSTED");
    const pool = pools[grade];
    const index = Math.min(pool.length - 1, Math.floor(nextRandom(state) * pool.length));
    offered.push(pool.splice(index, 1)[0]);
  }
  return offered;
}

function restoreLifeRestartState(value, data, internalOptions = {}) {
  const state = cloneBoundedJson(value, {
    label: "Life Restart state",
    maxBytes: MAX_STATE_BYTES,
    maxDepth: 12,
    maxNodes: 12_000
  });
  if (!isPlainObject(state)) throw lifeError("The Life Restart state must be an object.", "STATE_INVALID");
  assertExactKeys(state, TOP_LEVEL_STATE_KEYS, lifeCode("STATE_INVALID"));
  if (state.version !== LIFE_RESTART_STATE_VERSION) throw lifeError("The state version is unsupported.", "STATE_VERSION_UNSUPPORTED");
  if (state.mode !== LIFE_RESTART_MODE || state.sourceCommit !== LIFE_RESTART_SOURCE_COMMIT) {
    throw lifeError("The state engine identity is invalid.", "STATE_INVALID");
  }
  if (!isPlainObject(state.dataHashes)) throw lifeError("The state data identity is invalid.", "STATE_INVALID");
  assertExactKeys(state.dataHashes, ["age", "talents", "events"], lifeCode("STATE_INVALID"));
  for (const name of ["age", "talents", "events"]) {
    if (state.dataHashes[name] !== data.hashes[name]) throw lifeError("The state data identity is invalid.", "STATE_DATA_MISMATCH");
  }
  state.calendarYear = normalizeStateInteger(state.calendarYear, "calendarYear", 1, 9_999);
  state.initialSeed = normalizeStoredSeed(state.initialSeed);
  state.rngState = normalizeStoredSeed(state.rngState);
  state.revision = normalizeStateInteger(state.revision, "revision", 0, GAME_AGENT_MAX_REVISION);
  state.generation = normalizeStateInteger(state.generation, "generation", 1, MAX_GENERATION);
  state.completedLives = normalizeStateInteger(state.completedLives, "completedLives", 0, MAX_COMPLETED_LIVES);
  state.currentLifeCheckpoint = normalizeCurrentLifeCheckpoint(state.currentLifeCheckpoint, data);
  if (!PHASES.has(state.phase)) throw lifeError("The state phase is invalid.", "STATE_INVALID");
  state.inheritedTalentId = state.inheritedTalentId === null ? null : normalizeKnownTalentId(state.inheritedTalentId, data);
  state.offeredTalentIds = normalizeKnownTalentIds(state.offeredTalentIds, data, "offered talents", OFFERED_TALENT_COUNT, OFFERED_TALENT_COUNT);
  if (state.offeredTalentIds.some((id) => data.talents[id].exclusive)) {
    throw lifeError("The offer contains an exclusive talent.", "STATE_INVALID");
  }
  if (state.inheritedTalentId !== null && state.offeredTalentIds[0] !== state.inheritedTalentId) {
    throw lifeError("The inherited talent is not pinned to the offer.", "STATE_INVALID");
  }
  state.selectedTalentIds = normalizeKnownTalentIds(state.selectedTalentIds, data, "selected talents", 0, SELECTED_TALENT_COUNT);
  state.activeTalentIds = normalizeKnownTalentIds(state.activeTalentIds, data, "active talents", 0, MAX_ACTIVE_TALENTS);
  state.seenEventIds = normalizeKnownEventIds(state.seenEventIds, data, "seen events");
  state.allSeenEventIds = normalizeKnownEventIds(state.allSeenEventIds, data, "all seen events");
  validateCurrentLifeCheckpoint(state);
  if (state.seenEventIds.some((id) => !state.allSeenEventIds.includes(id))) {
    throw lifeError("Current events must be included in cumulative events.", "STATE_INVALID");
  }
  state.talentTriggerCounts = normalizeTriggerCounts(state.talentTriggerCounts, data);
  if (Object.keys(state.talentTriggerCounts).some((id) => !state.activeTalentIds.includes(Number(id)))) {
    throw lifeError("A trigger count references an inactive talent.", "STATE_INVALID");
  }
  state.history = normalizeHistory(state.history, data, state.calendarYear);

  const hasLife = state.phase === "trajectory" || state.phase === "summary";
  if (state.phase === "talent-selection") {
    assertSelectionPhaseEmpty(state);
  } else {
    if (state.selectedTalentIds.length !== SELECTED_TALENT_COUNT || !state.selectedTalentIds.every((id) => state.offeredTalentIds.includes(id))) {
      throw lifeError("The selected talents are inconsistent.", "STATE_INVALID");
    }
    if (findTalentConflict(state.selectedTalentIds, data)) throw lifeError("The selected talents conflict.", "STATE_INVALID");
    if (state.activeTalentIds.length < SELECTED_TALENT_COUNT || !state.selectedTalentIds.every((id) => state.activeTalentIds.includes(id))) {
      throw lifeError("The active talents are inconsistent.", "STATE_INVALID");
    }
    state.propertyPoints = normalizeStateInteger(state.propertyPoints, "propertyPoints", 0, 40);
    if (state.propertyPoints !== calculatePropertyPoints(state.activeTalentIds, data)) {
      throw lifeError("The property point total is inconsistent.", "STATE_INVALID");
    }
  }

  if (!hasLife) {
    if (state.allocation !== null || state.properties !== null || state.lows !== null || state.highs !== null || state.summary !== null) {
      throw lifeError("Pre-life state contains trajectory fields.", "STATE_INVALID");
    }
    if (state.phase === "property-allocation" && (state.seenEventIds.length || state.history.length || Object.keys(state.talentTriggerCounts).length)) {
      throw lifeError("Property allocation state contains trajectory progress.", "STATE_INVALID");
    }
  } else {
    state.allocation = normalizeAllocation(state.allocation, "state");
    if (sumValues(state.allocation) !== state.propertyPoints) throw lifeError("The allocation total is inconsistent.", "STATE_INVALID");
    state.properties = normalizePropertyRecord(state.properties, true);
    state.lows = normalizeExtremeRecord(state.lows);
    state.highs = normalizeExtremeRecord(state.highs);
    for (const key of EXTREME_PROPERTY_KEYS) {
      if (state.lows[key] > state.highs[key] || state.properties[key] < state.lows[key] || state.properties[key] > state.highs[key]) {
        throw lifeError("The property extrema are inconsistent.", "STATE_INVALID");
      }
    }
    if (state.phase === "trajectory") {
      if (state.properties.LIF < 1 || state.summary !== null) throw lifeError("The trajectory terminal state is inconsistent.", "STATE_INVALID");
    } else {
      if (state.properties.LIF >= 1) throw lifeError("The summary state is not terminal.", "STATE_INVALID");
      state.summary = normalizeSummary(state.summary);
      if (JSON.stringify(state.summary) !== JSON.stringify(buildSummary(state))) {
        throw lifeError("The life summary is inconsistent.", "STATE_INVALID");
      }
    }
    const lastRecord = state.history.at(-1);
    if (lastRecord) {
      if (JSON.stringify(lastRecord.properties) !== JSON.stringify(state.properties)) {
        throw lifeError("The latest history properties are inconsistent.", "STATE_INVALID");
      }
      if (lastRecord.terminal !== (state.phase === "summary")) {
        throw lifeError("The latest history terminal marker is inconsistent.", "STATE_INVALID");
      }
    } else if (state.phase === "summary") {
      throw lifeError("A terminal state must retain its final history record.", "STATE_INVALID");
    }
  }
  if (internalOptions.skipReplayValidation !== true) validateCurrentLifeReplay(state, data);
  return deepFreezeJson(state);
}

function normalizeCurrentLifeCheckpoint(value, data) {
  if (!isPlainObject(value)) throw lifeError("The current-life checkpoint is invalid.", "STATE_INVALID");
  assertExactKeys(value, [
    "origin",
    "revision",
    "rngState",
    "generation",
    "completedLives",
    "inheritedTalentId",
    "allSeenEventCount",
    "allSeenEventSha256"
  ], lifeCode("STATE_INVALID"));
  const allSeenEventSha256 = normalizeStateText(
    value.allSeenEventSha256,
    "checkpoint event digest",
    64
  );
  if (!/^[0-9a-f]{64}$/.test(allSeenEventSha256)) {
    throw lifeError("The checkpoint event digest is invalid.", "STATE_INVALID");
  }
  if (!CHECKPOINT_ORIGINS.has(value.origin)) {
    throw lifeError("The checkpoint origin is invalid.", "STATE_INVALID");
  }
  return {
    origin: value.origin,
    revision: normalizeStateInteger(value.revision, "checkpoint revision", 0, GAME_AGENT_MAX_REVISION),
    rngState: normalizeStoredSeed(value.rngState),
    generation: normalizeStateInteger(value.generation, "checkpoint generation", 1, MAX_GENERATION),
    completedLives: normalizeStateInteger(value.completedLives, "checkpoint completed lives", 0, MAX_COMPLETED_LIVES),
    inheritedTalentId: value.inheritedTalentId === null ? null : normalizeKnownTalentId(value.inheritedTalentId, data),
    allSeenEventCount: normalizeStateInteger(value.allSeenEventCount, "checkpoint event count", 0, MAX_SEEN_EVENTS),
    allSeenEventSha256
  };
}

function validateCurrentLifeCheckpoint(state) {
  const checkpoint = state.currentLifeCheckpoint;
  if (
    checkpoint.revision > state.revision
    || checkpoint.generation !== state.generation
    || checkpoint.completedLives !== state.completedLives
    || checkpoint.inheritedTalentId !== state.inheritedTalentId
    || state.completedLives > state.generation - 1
    || checkpoint.allSeenEventCount > state.allSeenEventIds.length
  ) {
    throw lifeError("The current-life checkpoint is inconsistent.", "STATE_INVALID");
  }
  const baselineEvents = state.allSeenEventIds.slice(0, checkpoint.allSeenEventCount);
  if (hashEventIdList(baselineEvents) !== checkpoint.allSeenEventSha256) {
    throw lifeError("The current-life event checkpoint is inconsistent.", "STATE_INVALID");
  }
  if (
    checkpoint.origin === "create"
    && (
      state.generation !== 1
      || checkpoint.revision !== 0
      || checkpoint.rngState !== state.initialSeed
      || checkpoint.completedLives !== 0
      || checkpoint.inheritedTalentId !== null
      || checkpoint.allSeenEventCount !== 0
    )
  ) {
    throw lifeError("The first-life checkpoint is inconsistent.", "STATE_INVALID");
  }
  if (
    checkpoint.origin === "reset"
    && (
      state.generation < 2
      || checkpoint.revision < 1
      || checkpoint.completedLives !== 0
      || checkpoint.inheritedTalentId !== null
      || checkpoint.allSeenEventCount !== 0
    )
  ) {
    throw lifeError("The reset checkpoint is inconsistent.", "STATE_INVALID");
  }
  if (
    checkpoint.origin === "restart"
    && (
      state.generation < 2
      || checkpoint.revision < 1
      || checkpoint.completedLives < 1
    )
  ) {
    throw lifeError("The restart checkpoint is inconsistent.", "STATE_INVALID");
  }
}

function validateCurrentLifeReplay(state, data) {
  const checkpoint = state.currentLifeCheckpoint;
  const baselineEvents = state.allSeenEventIds.slice(0, checkpoint.allSeenEventCount);
  let replay = createSelectionState(data, {
    calendarYear: state.calendarYear,
    initialSeed: state.initialSeed,
    rngState: checkpoint.rngState,
    revision: checkpoint.revision,
    generation: checkpoint.generation,
    completedLives: checkpoint.completedLives,
    origin: checkpoint.origin,
    inheritedTalentId: checkpoint.inheritedTalentId,
    allSeenEventIds: baselineEvents
  }, { skipReplayValidation: true });

  if (state.phase !== "talent-selection") {
    replay = applyReplayAction(replay, {
      type: "choose_talents",
      talentIds: state.selectedTalentIds
    }, data);
  }
  if (state.phase === "trajectory" || state.phase === "summary") {
    replay = applyReplayAction(replay, {
      type: "allocate_properties",
      properties: state.allocation
    }, data);
    const advanceCount = state.revision - checkpoint.revision - 2;
    if (
      advanceCount < 0
      || advanceCount > MAX_CURRENT_LIFE_ADVANCES
      || (state.phase === "summary" && advanceCount === 0)
    ) {
      throw lifeError("The replay advance count is invalid.", "STATE_REPLAY_MISMATCH");
    }
    for (let index = 0; index < advanceCount; index += 1) {
      if (replay.phase !== "trajectory") {
        throw lifeError("The replay reached a terminal state too early.", "STATE_REPLAY_MISMATCH");
      }
      replay = applyReplayAction(replay, { type: "advance", steps: 1 }, data);
    }
  }

  if (!isDeepStrictEqual(replay, state)) {
    throw lifeError("The state does not match its deterministic current-life replay.", "STATE_REPLAY_MISMATCH");
  }
}

function applyReplayAction(state, action, data) {
  const outcome = applyLifeRestartAction(state, action, data, { skipReplayValidation: true });
  if (outcome.status !== "applied") {
    throw lifeError("The current-life replay action was rejected.", "STATE_REPLAY_MISMATCH");
  }
  return outcome.state;
}

function assertSelectionPhaseEmpty(state) {
  if (
    state.selectedTalentIds.length
    || state.activeTalentIds.length
    || state.propertyPoints !== null
    || state.allocation !== null
    || state.properties !== null
    || state.lows !== null
    || state.highs !== null
    || state.seenEventIds.length
    || Object.keys(state.talentTriggerCounts).length
    || state.history.length
    || state.summary !== null
  ) {
    throw lifeError("The talent-selection state contains later-phase data.", "STATE_INVALID");
  }
}

function observeLifeRestartState(state, data) {
  const observation = {
    phase: state.phase,
    terminal: state.phase === "summary",
    score: {
      current: state.summary?.totalScore ?? currentScore(state),
      best: state.summary?.totalScore ?? currentScore(state)
    },
    state: {
      mode: state.mode,
      calendarYear: state.calendarYear,
      generation: state.generation,
      completedLives: state.completedLives,
      data: {
        language: "zh-cn",
        sourceCommit: state.sourceCommit,
        hashes: { ...state.dataHashes }
      },
      inheritedTalentId: state.inheritedTalentId,
      offeredTalents: state.offeredTalentIds.map((id) => projectTalent(data.talents[id])),
      selectedTalents: state.selectedTalentIds.map((id) => projectTalent(data.talents[id])),
      activeTalents: state.activeTalentIds.map((id) => projectTalent(data.talents[id])),
      propertyPoints: state.propertyPoints,
      allocation: state.allocation ? { ...state.allocation } : null,
      properties: state.properties ? { ...state.properties } : null,
      lows: state.lows ? { ...state.lows } : null,
      highs: state.highs ? { ...state.highs } : null,
      recentHistory: state.history.slice(-12).map(cloneHistoryRecord),
      summary: state.summary ? cloneSummary(state.summary) : null
    }
  };
  return deepFreezeJson(cloneBoundedJson(observation, {
    label: "Life Restart observation",
    maxBytes: MAX_OBSERVATION_BYTES,
    maxDepth: 12,
    maxNodes: 8_000
  }));
}

function actionsForLifeRestartState(state, data) {
  const actions = [];
  if (state.phase === "talent-selection") {
    const example = findLegalTalentTriple(state.offeredTalentIds, data);
    actions.push({
      id: "choose-talents",
      action: { type: "choose_talents", talentIds: example },
      parameters: { talentIds: { type: "array", items: "integer", minItems: 3, maxItems: 3 } },
      constraints: { offeredOnly: true, unique: true, noConflicts: true },
      risk: "low",
      requiresConfirmation: false
    });
  } else if (state.phase === "property-allocation") {
    actions.push({
      id: "allocate-properties",
      action: { type: "allocate_properties", properties: exampleAllocation(state.propertyPoints) },
      parameters: {
        properties: {
          type: "object",
          required: [...PROPERTY_ALLOCATION_KEYS],
          minimum: 0,
          maximum: 10,
          integer: true
        }
      },
      constraints: { exactTotal: state.propertyPoints },
      risk: "low",
      requiresConfirmation: false
    });
  } else if (state.phase === "trajectory") {
    actions.push({
      id: "advance-one-year",
      action: { type: "advance", steps: 1 },
      parameters: { steps: { const: 1 } },
      constraints: { exactlyOneYear: true },
      risk: "low",
      requiresConfirmation: false
    });
  } else {
    actions.push({
      id: "restart-life",
      action: { type: "restart_life", inheritedTalentId: null },
      parameters: { inheritedTalentId: { type: ["integer", "null"] } },
      constraints: { allowedTalentIds: [...state.selectedTalentIds], nullable: true },
      risk: "medium",
      requiresConfirmation: false
    });
  }
  actions.push({
    id: "reset",
    action: { type: "reset", confirm: true },
    parameters: { confirm: { const: true } },
    constraints: { clearsSessionProgress: true },
    risk: "high",
    requiresConfirmation: true
  });
  return deepFreezeJson(cloneBoundedJson(actions, {
    label: "Life Restart actions",
    maxBytes: 16 * 1024,
    maxDepth: 10,
    maxNodes: 1_000
  }));
}

function applyLifeRestartAction(state, action, data, internalOptions = {}) {
  if (action.type === "reset") {
    if (!action.confirm) return unchangedOutcome(state, "rejected", "confirmation-required");
    assertRevisionCanAdvance(state);
    const mutable = mutableState(state);
    const next = createSelectionState(data, {
      calendarYear: state.calendarYear,
      initialSeed: state.initialSeed,
      rngState: mutable.rngState,
      revision: state.revision + 1,
      generation: Math.min(MAX_GENERATION, state.generation + 1),
      completedLives: 0,
      origin: "reset",
      inheritedTalentId: null,
      allSeenEventIds: []
    }, internalOptions);
    return appliedOutcome(next, "reset", [{ type: "game_reset" }]);
  }

  if (action.type === "choose_talents") {
    if (state.phase !== "talent-selection") return unchangedOutcome(state, "rejected", "wrong-phase");
    if (!action.talentIds.every((id) => state.offeredTalentIds.includes(id))) {
      return unchangedOutcome(state, "rejected", "talent-not-offered");
    }
    const conflict = findTalentConflict(action.talentIds, data);
    if (conflict) return unchangedOutcome(state, "rejected", "talent-conflict");
    assertRevisionCanAdvance(state);
    const mutable = mutableState(state);
    mutable.selectedTalentIds = [...action.talentIds];
    mutable.activeTalentIds = [...action.talentIds];
    const replacements = replaceTalents(mutable, data);
    mutable.propertyPoints = calculatePropertyPoints(mutable.activeTalentIds, data);
    mutable.phase = "property-allocation";
    mutable.revision += 1;
    const next = restoreLifeRestartState(mutable, data, internalOptions);
    return appliedOutcome(next, "talents-chosen", [{
      type: "talents_chosen",
      selectedTalentIds: [...next.selectedTalentIds],
      activeTalentIds: [...next.activeTalentIds],
      replacements
    }]);
  }

  if (action.type === "allocate_properties") {
    if (state.phase !== "property-allocation") return unchangedOutcome(state, "rejected", "wrong-phase");
    if (sumValues(action.properties) !== state.propertyPoints) {
      return unchangedOutcome(state, "rejected", "allocation-total-mismatch");
    }
    assertRevisionCanAdvance(state);
    const mutable = mutableState(state);
    mutable.allocation = { ...action.properties };
    mutable.properties = {
      AGE: -1,
      CHR: action.properties.CHR,
      INT: action.properties.INT,
      STR: action.properties.STR,
      MNY: action.properties.MNY,
      SPR: DEFAULT_SPIRIT,
      LIF: 1
    };
    const talentTriggers = triggerTalents(mutable, data, false);
    mutable.lows = Object.fromEntries(EXTREME_PROPERTY_KEYS.map((key) => [key, mutable.properties[key]]));
    mutable.highs = { ...mutable.lows };
    mutable.phase = "trajectory";
    mutable.revision += 1;
    const next = restoreLifeRestartState(mutable, data, internalOptions);
    return appliedOutcome(next, "life-started", [{
      type: "life_started",
      allocation: { ...next.allocation },
      properties: { ...next.properties },
      talentTriggers
    }]);
  }

  if (action.type === "advance") {
    if (state.phase !== "trajectory") return unchangedOutcome(state, "rejected", "wrong-phase");
    if (state.revision - state.currentLifeCheckpoint.revision - 2 >= MAX_CURRENT_LIFE_ADVANCES) {
      throw lifeError("The current life reached its advance limit.", "LIFETIME_LIMIT");
    }
    assertRevisionCanAdvance(state);
    const mutable = mutableState(state);
    const record = advanceOneYear(mutable, data);
    mutable.revision += 1;
    const next = restoreLifeRestartState(mutable, data, internalOptions);
    return appliedOutcome(next, record.terminal ? "life-ended" : "year-advanced", [{
      type: "year_advanced",
      ...cloneHistoryRecord(record)
    }]);
  }

  if (action.type === "restart_life") {
    if (state.phase !== "summary") return unchangedOutcome(state, "rejected", "wrong-phase");
    if (action.inheritedTalentId !== null && !state.selectedTalentIds.includes(action.inheritedTalentId)) {
      return unchangedOutcome(state, "rejected", "inherited-talent-invalid");
    }
    if (state.generation >= MAX_GENERATION || state.completedLives >= MAX_COMPLETED_LIVES) {
      throw lifeError("The lifetime limit was reached.", "LIFETIME_LIMIT");
    }
    assertRevisionCanAdvance(state);
    const next = createSelectionState(data, {
      calendarYear: state.calendarYear,
      initialSeed: state.initialSeed,
      rngState: state.rngState,
      revision: state.revision + 1,
      generation: state.generation + 1,
      completedLives: state.completedLives + 1,
      origin: "restart",
      inheritedTalentId: action.inheritedTalentId,
      allSeenEventIds: state.allSeenEventIds
    }, internalOptions);
    return appliedOutcome(next, "life-restarted", [{
      type: "life_restarted",
      generation: next.generation,
      inheritedTalentId: next.inheritedTalentId
    }]);
  }

  throw lifeError("Unsupported Life Restart action type.", "ACTION_UNSUPPORTED");
}

function replaceTalents(state, data) {
  const original = [...state.selectedTalentIds];
  const active = [...original];
  const replacements = [];
  for (const sourceId of original) {
    const targetId = resolveTalentReplacement(sourceId, active, state, data, []);
    if (targetId !== sourceId) {
      if (!active.includes(targetId)) active.push(targetId);
      replacements.push({ sourceTalentId: sourceId, targetTalentId: targetId });
    }
  }
  if (active.length > MAX_ACTIVE_TALENTS) throw lifeError("Too many active talents.", "TALENT_LIMIT");
  state.activeTalentIds = active;
  return replacements;
}

function resolveTalentReplacement(talentId, currentTalents, state, data, chain) {
  if (chain.length >= 16 || chain.includes(talentId)) {
    throw lifeError("A talent replacement chain is cyclic or too deep.", "TALENT_REPLACEMENT_LIMIT");
  }
  const replacement = data.talents[talentId].replacement;
  if (!replacement) return talentId;
  const candidates = [];
  for (const [grade, weight] of replacement.grade) {
    for (const candidate of Object.values(data.talents)) {
      if (candidate.exclusive || candidate.grade !== grade || findTalentConflict([...currentTalents, candidate.id], data)) continue;
      candidates.push([candidate.id, weight]);
    }
  }
  for (const [candidateId, weight] of replacement.talent) {
    if (!findTalentConflict([...currentTalents, candidateId], data)) candidates.push([candidateId, weight]);
  }
  if (!candidates.length) return talentId;
  const selected = weightedRandom(candidates, state);
  return resolveTalentReplacement(selected, [...currentTalents, selected], state, data, [...chain, talentId]);
}

function advanceOneYear(state, data) {
  changeProperty(state, "AGE", 1, true);
  const yearAge = state.properties.AGE;
  const age = data.ages[yearAge];
  if (!age) throw lifeError("No age data is available for the next year.", "AGE_DATA_UNAVAILABLE");
  for (const talentId of age.talents) {
    if (!state.activeTalentIds.includes(talentId)) state.activeTalentIds.push(talentId);
  }
  if (state.activeTalentIds.length > MAX_ACTIVE_TALENTS) throw lifeError("Too many active talents.", "TALENT_LIMIT");
  const talentTriggers = triggerTalents(state, data, true);
  const candidates = age.events.filter(([eventId]) => isRandomEventEligible(data.events[eventId], state));
  if (!candidates.length) throw lifeError("No eligible event is available for this age.", "EVENT_UNAVAILABLE");
  const firstEventId = weightedRandom(candidates, state);
  const lifeEvents = applyEventChain(state, firstEventId, data);
  const terminal = state.properties.LIF < 1;
  const record = {
    age: yearAge,
    talentTriggers,
    lifeEvents,
    properties: { ...state.properties },
    terminal
  };
  state.history.push(record);
  if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY);
  if (terminal) {
    state.phase = "summary";
    state.summary = buildSummary(state);
  }
  return record;
}

function triggerTalents(state, data, trackExtremes) {
  const output = [];
  for (const talentId of state.activeTalentIds) {
    const talent = data.talents[talentId];
    const count = state.talentTriggerCounts[talentId] || 0;
    if (count >= talent.maxTriggers || (talent.condition && !checkCondition(talent.condition, state))) continue;
    const description = formatText(talent.description, state);
    state.talentTriggerCounts[talentId] = count + 1;
    output.push({ id: talent.id, name: talent.name, description, grade: talent.grade });
    applyEffect(state, talent.effect, trackExtremes);
  }
  return output;
}

function isRandomEventEligible(event, state) {
  if (event.noRandom) return false;
  if (event.exclude && checkCondition(event.exclude, state)) return false;
  return !event.include || checkCondition(event.include, state);
}

function applyEventChain(state, firstEventId, data) {
  const output = [];
  let eventId = firstEventId;
  for (let depth = 0; depth < MAX_EVENT_CHAIN; depth += 1) {
    const event = data.events[eventId];
    if (!event) throw lifeError("An event chain references missing data.", "EVENT_INVALID");
    let next = null;
    for (const branch of event.branches) {
      if (checkCondition(branch.condition, state)) {
        next = branch.next;
        break;
      }
    }
    addUniqueBounded(state.seenEventIds, eventId, MAX_SEEN_EVENTS, "current event history");
    addUniqueBounded(state.allSeenEventIds, eventId, MAX_SEEN_EVENTS, "cumulative event history");
    applyEffect(state, event.effect, true);
    output.push({
      id: event.id,
      description: formatText(event.description, state),
      postEvent: next === null && event.postEvent ? formatText(event.postEvent, state) : null,
      grade: event.grade
    });
    if (next === null) return output;
    eventId = next;
  }
  throw lifeError("An event chain exceeded its depth bound.", "EVENT_CHAIN_LIMIT");
}

function applyEffect(state, effect, trackExtremes) {
  if (!effect) return;
  for (const [sourceProperty, delta] of Object.entries(effect)) {
    const property = sourceProperty === "RDM"
      ? ["CHR", "INT", "STR", "MNY", "SPR"][Math.min(4, Math.floor(nextRandom(state) * 5))]
      : sourceProperty;
    changeProperty(state, property, delta, trackExtremes);
  }
}

function changeProperty(state, property, delta, trackExtremes) {
  const next = state.properties[property] + delta;
  if (!Number.isSafeInteger(next) || Math.abs(next) > MAX_PROPERTY_ABS) {
    throw lifeError("A property exceeded its supported bound.", "PROPERTY_LIMIT");
  }
  state.properties[property] = next;
  if (trackExtremes && EXTREME_PROPERTY_KEYS.includes(property)) {
    state.lows[property] = Math.min(state.lows[property], next);
    state.highs[property] = Math.max(state.highs[property], next);
  }
}

function buildSummary(state) {
  const properties = Object.fromEntries(PROPERTY_ALLOCATION_KEYS.concat("SPR").map((key) => [key, state.properties[key]]));
  const highs = Object.fromEntries(EXTREME_PROPERTY_KEYS.map((key) => [key, state.highs[key]]));
  return {
    age: state.highs.AGE,
    properties,
    highs,
    totalScore: Math.floor(
      (state.highs.CHR + state.highs.INT + state.highs.STR + state.highs.MNY + state.highs.SPR) * 2
      + state.highs.AGE / 2
    )
  };
}

function currentScore(state) {
  if (!state.highs) return 0;
  return Math.floor(
    (state.highs.CHR + state.highs.INT + state.highs.STR + state.highs.MNY + state.highs.SPR) * 2
    + state.highs.AGE / 2
  );
}

function mutableState(state) {
  return JSON.parse(JSON.stringify(state));
}

function appliedOutcome(state, reason, events) {
  return Object.freeze({ status: "applied", reason, state, events: deepFreezeJson(events) });
}

function unchangedOutcome(state, status, reason) {
  return Object.freeze({ status, reason, state, events: Object.freeze([]) });
}

function assertRevisionCanAdvance(state) {
  if (state.revision >= GAME_AGENT_MAX_REVISION) throw lifeError("The revision limit was reached.", "REVISION_LIMIT");
}

function findLegalTalentTriple(offeredIds, data) {
  for (let first = 0; first < offeredIds.length - 2; first += 1) {
    for (let second = first + 1; second < offeredIds.length - 1; second += 1) {
      for (let third = second + 1; third < offeredIds.length; third += 1) {
        const ids = [offeredIds[first], offeredIds[second], offeredIds[third]];
        if (!findTalentConflict(ids, data)) return ids;
      }
    }
  }
  return null;
}

function findTalentConflict(talentIds, data) {
  for (let index = 0; index < talentIds.length; index += 1) {
    const current = data.talents[talentIds[index]];
    if (!current) return [talentIds[index], null];
    for (let other = index + 1; other < talentIds.length; other += 1) {
      const candidate = data.talents[talentIds[other]];
      if (!candidate || current.exclude.includes(candidate.id) || candidate.exclude.includes(current.id)) {
        return [current.id, candidate?.id ?? null];
      }
    }
  }
  return null;
}

function calculatePropertyPoints(talentIds, data) {
  const total = DEFAULT_PROPERTY_POINTS + talentIds.reduce((sum, id) => sum + data.talents[id].status, 0);
  if (!Number.isInteger(total) || total < 0 || total > 40) {
    throw lifeError("The selected talents produce an unsupported property point total.", "PROPERTY_POINTS_INVALID");
  }
  return total;
}

function exampleAllocation(total) {
  let remaining = total;
  const allocation = {};
  for (const key of PROPERTY_ALLOCATION_KEYS) {
    allocation[key] = Math.min(10, remaining);
    remaining -= allocation[key];
  }
  if (remaining !== 0) throw lifeError("A valid example allocation cannot be produced.", "PROPERTY_POINTS_INVALID");
  return allocation;
}

function weightedRandom(entries, state) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  if (!Number.isFinite(total) || total <= 0) throw lifeError("A weighted choice is invalid.", "WEIGHT_INVALID");
  let roll = nextRandom(state) * total;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return entries.at(-1)[0];
}

function nextRandom(state) {
  let value = normalizeSeed(state.rngState);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  value >>>= 0;
  if (value === 0) value = DEFAULT_NON_ZERO_SEED;
  state.rngState = value;
  return value / 0x100000000;
}

function createRandomSeed() {
  return randomBytes(4).readUInt32LE(0) || DEFAULT_NON_ZERO_SEED;
}

function normalizeSeed(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffffffff) {
    throw lifeError("The random seed is invalid.", "SEED_INVALID");
  }
  return (numeric >>> 0) || DEFAULT_NON_ZERO_SEED;
}

function normalizeStoredSeed(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 0xffffffff) {
    throw lifeError("A stored random seed is invalid.", "STATE_INVALID");
  }
  return numeric >>> 0;
}

function normalizeWeightedId(value) {
  const parts = String(value).split("*");
  if (parts.length > 2) throw lifeError("A weighted id is invalid.", "DATA_INVALID");
  const id = normalizeId(parts[0], "weighted id");
  const weight = parts.length === 1 ? 1 : Number(parts[1]);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1e300) {
    throw lifeError("A weight is invalid.", "DATA_INVALID");
  }
  return Object.freeze([id, weight]);
}

function normalizeId(value, label) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric > 1_000_000_000) {
    throw lifeError(`The ${label} is invalid.`, "DATA_INVALID");
  }
  return numeric;
}

function normalizeActionId(value, label) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) {
    throw lifeError(`The ${label} is invalid.`, "ACTION_INVALID");
  }
  return value;
}

function normalizeIdArray(value, label, maxLength) {
  if (!Array.isArray(value) || value.length > maxLength) throw lifeError(`The ${label} list is invalid.`, "DATA_INVALID");
  const ids = value.map((entry) => normalizeId(entry, label));
  if (new Set(ids).size !== ids.length) throw lifeError(`The ${label} list contains duplicates.`, "DATA_INVALID");
  return ids;
}

function normalizeKnownTalentId(value, data) {
  const id = normalizeStateInteger(value, "talent id", 0, 1_000_000_000);
  if (!data.talents[id]) throw lifeError("The state references an unknown talent.", "STATE_INVALID");
  return id;
}

function normalizeKnownTalentIds(value, data, label, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw lifeError(`The ${label} list is invalid.`, "STATE_INVALID");
  const ids = value.map((entry) => normalizeKnownTalentId(entry, data));
  if (new Set(ids).size !== ids.length) throw lifeError(`The ${label} list contains duplicates.`, "STATE_INVALID");
  return ids;
}

function normalizeKnownEventIds(value, data, label) {
  if (!Array.isArray(value) || value.length > MAX_SEEN_EVENTS) throw lifeError(`The ${label} list is invalid.`, "STATE_INVALID");
  const ids = value.map((entry) => {
    const id = normalizeStateInteger(entry, "event id", 0, 1_000_000_000);
    if (!data.events[id]) throw lifeError("The state references an unknown event.", "STATE_INVALID");
    return id;
  });
  if (new Set(ids).size !== ids.length) throw lifeError(`The ${label} list contains duplicates.`, "STATE_INVALID");
  return ids;
}

function normalizeTriggerCounts(value, data) {
  if (!isPlainObject(value) || Object.keys(value).length > MAX_ACTIVE_TALENTS) {
    throw lifeError("Talent trigger counts are invalid.", "STATE_INVALID");
  }
  const counts = {};
  for (const [key, rawCount] of Object.entries(value)) {
    const id = normalizeId(key, "talent id");
    if (!data.talents[id]) throw lifeError("A trigger count references an unknown talent.", "STATE_INVALID");
    const count = normalizeStateInteger(rawCount, "talent trigger count", 1, data.talents[id].maxTriggers);
    counts[id] = count;
  }
  return counts;
}

function normalizeHistory(value, data, calendarYear) {
  if (!Array.isArray(value) || value.length > MAX_HISTORY) throw lifeError("Life history is invalid.", "STATE_INVALID");
  return value.map((record) => {
    if (!isPlainObject(record)) throw lifeError("A life history record is invalid.", "STATE_INVALID");
    assertExactKeys(record, ["age", "talentTriggers", "lifeEvents", "properties", "terminal"], lifeCode("STATE_INVALID"));
    const age = normalizeStateInteger(record.age, "history age", -1_000, 10_000);
    if (!Array.isArray(record.talentTriggers) || record.talentTriggers.length > MAX_ACTIVE_TALENTS) {
      throw lifeError("History talent triggers are invalid.", "STATE_INVALID");
    }
    const talentTriggers = record.talentTriggers.map((entry) => normalizeTalentOutput(entry, data, calendarYear));
    if (!Array.isArray(record.lifeEvents) || !record.lifeEvents.length || record.lifeEvents.length > MAX_EVENT_CHAIN) {
      throw lifeError("History life events are invalid.", "STATE_INVALID");
    }
    const lifeEvents = record.lifeEvents.map((entry) => normalizeEventOutput(entry, data, calendarYear));
    return {
      age,
      talentTriggers,
      lifeEvents,
      properties: normalizePropertyRecord(record.properties, true),
      terminal: normalizeStateBoolean(record.terminal, "history terminal marker")
    };
  });
}

function normalizeTalentOutput(value, data) {
  if (!isPlainObject(value)) throw lifeError("A talent output is invalid.", "STATE_INVALID");
  assertExactKeys(value, ["id", "name", "description", "grade"], lifeCode("STATE_INVALID"));
  const id = normalizeKnownTalentId(value.id, data);
  const source = data.talents[id];
  const name = normalizeStateText(value.name, "talent output name", 256);
  const description = normalizeStateText(value.description, "talent output description", 2_048);
  const grade = normalizeStateInteger(value.grade, "talent output grade", 0, 3);
  if (name !== source.name || grade !== source.grade) throw lifeError("A talent output identity is invalid.", "STATE_INVALID");
  return { id, name, description, grade };
}

function normalizeEventOutput(value, data) {
  if (!isPlainObject(value)) throw lifeError("An event output is invalid.", "STATE_INVALID");
  assertExactKeys(value, ["id", "description", "postEvent", "grade"], lifeCode("STATE_INVALID"));
  const id = normalizeStateInteger(value.id, "event id", 0, 1_000_000_000);
  const source = data.events[id];
  if (!source) throw lifeError("An event output references unknown data.", "STATE_INVALID");
  const description = normalizeStateText(value.description, "event output description", 2_048);
  const postEvent = value.postEvent === null ? null : normalizeStateText(value.postEvent, "post-event output", 2_048);
  const grade = normalizeStateInteger(value.grade, "event output grade", 0, 3);
  if (grade !== source.grade) throw lifeError("An event output identity is invalid.", "STATE_INVALID");
  return { id, description, postEvent, grade };
}

function normalizeAllocation(value, context = "action") {
  const suffix = context === "state" ? "STATE_INVALID" : "ACTION_INVALID";
  if (!isPlainObject(value)) throw lifeError("The property allocation must be an object.", suffix);
  assertExactKeys(value, PROPERTY_ALLOCATION_KEYS, lifeCode(suffix));
  return Object.fromEntries(PROPERTY_ALLOCATION_KEYS.map((key) => {
    const numeric = value[key];
    if (typeof numeric !== "number" || !Number.isSafeInteger(numeric) || numeric < 0 || numeric > 10) {
      throw lifeError(`The property ${key} is invalid.`, suffix);
    }
    return [key, numeric];
  }));
}

function normalizePropertyRecord(value, includeLife) {
  if (!isPlainObject(value)) throw lifeError("A property record is invalid.", "STATE_INVALID");
  const keys = includeLife ? VISIBLE_PROPERTY_KEYS : EXTREME_PROPERTY_KEYS;
  assertExactKeys(value, keys, lifeCode("STATE_INVALID"));
  return Object.fromEntries(keys.map((key) => [
    key,
    normalizeStateInteger(value[key], `property ${key}`, -MAX_PROPERTY_ABS, MAX_PROPERTY_ABS)
  ]));
}

function normalizeExtremeRecord(value) {
  return normalizePropertyRecord(value, false);
}

function normalizeSummary(value) {
  if (!isPlainObject(value)) throw lifeError("The life summary is invalid.", "STATE_INVALID");
  assertExactKeys(value, ["age", "properties", "highs", "totalScore"], lifeCode("STATE_INVALID"));
  const properties = normalizePropertyRecord({ AGE: value.age, ...value.properties }, false);
  delete properties.AGE;
  return {
    age: normalizeStateInteger(value.age, "summary age", -MAX_PROPERTY_ABS, MAX_PROPERTY_ABS),
    properties,
    highs: normalizeExtremeRecord(value.highs),
    totalScore: normalizeStateInteger(value.totalScore, "summary score", -MAX_PROPERTY_ABS, MAX_PROPERTY_ABS)
  };
}

function cloneHistoryRecord(record) {
  return {
    age: record.age,
    talentTriggers: record.talentTriggers.map((entry) => ({ ...entry })),
    lifeEvents: record.lifeEvents.map((entry) => ({ ...entry })),
    properties: { ...record.properties },
    terminal: record.terminal
  };
}

function cloneSummary(summary) {
  return {
    age: summary.age,
    properties: { ...summary.properties },
    highs: { ...summary.highs },
    totalScore: summary.totalScore
  };
}

function projectTalent(talent) {
  return { id: talent.id, name: talent.name, description: talent.description, grade: talent.grade };
}

function formatText(value, state) {
  return String(value).replaceAll(/\{\s*[0-9a-zA-Z_-]+\s*?\}/g, (match) => {
    switch (match.slice(1, -1).trim().toLowerCase()) {
      case "currentyear": return String(state.calendarYear);
      case "age": return String(state.properties.AGE);
      case "charm": return String(state.properties.CHR);
      case "intelligence": return String(state.properties.INT);
      case "strength": return String(state.properties.STR);
      case "money": return String(state.properties.MNY);
      case "spirit": return String(state.properties.SPR);
      default: return match;
    }
  });
}

function extractMaxTriggers(condition) {
  if (!condition) return 1;
  const match = /AGE\?\[([0-9,]+)\]/.exec(condition);
  return match ? match[1].split(",").length : 1;
}

function addUniqueBounded(target, value, maxLength, label) {
  if (target.includes(value)) return;
  if (target.length >= maxLength) throw lifeError(`The ${label} reached its bound.`, "HISTORY_LIMIT");
  target.push(value);
}

function sumValues(value) {
  return Object.values(value).reduce((sum, entry) => sum + entry, 0);
}

function normalizeText(value, label, maxLength) {
  if (typeof value !== "string" && typeof value !== "number") throw lifeError(`The ${label} is invalid.`, "DATA_INVALID");
  const text = String(value);
  if (!text.length || text.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw lifeError(`The ${label} is invalid.`, "DATA_INVALID");
  }
  return text;
}

function normalizeBoundedInteger(value, label, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw lifeError(`The ${label} is invalid.`, "STATE_INVALID");
  }
  return numeric;
}

function normalizeStateInteger(value, label, minimum, maximum) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw lifeError(`The ${label} is invalid.`, "STATE_INVALID");
  }
  return value;
}

function normalizeStateBoolean(value, label) {
  if (typeof value !== "boolean") throw lifeError(`The ${label} is invalid.`, "STATE_INVALID");
  return value;
}

function normalizeStateText(value, label, maxLength) {
  if (typeof value !== "string") throw lifeError(`The ${label} is invalid.`, "STATE_INVALID");
  if (!value.length || value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw lifeError(`The ${label} is invalid.`, "STATE_INVALID");
  }
  return value;
}

function normalizeBooleanFlag(value, label) {
  if (value === undefined || value === false || value === 0) return false;
  if (value === true || value === 1) return true;
  throw lifeError(`The ${label} is invalid.`, "DATA_INVALID");
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashEventIdList(value) {
  return sha256(JSON.stringify(value));
}

function lifeCode(suffix) {
  return `GAME_LIFE_RESTART_${suffix}`;
}

function lifeError(message, suffix, cause) {
  return new GameProtocolError(message, lifeCode(suffix), cause ? { cause } : undefined);
}
