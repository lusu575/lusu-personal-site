import { CONTENT_VERSION, parseStageId } from "./constants.mjs?v=20260712-japanese-subtext-v103-r6";

const root = new URL("../content/", import.meta.url);

export class ContentLoader {
  constructor(fetchImpl = globalThis.fetch?.bind(globalThis)) {
    this.fetch = fetchImpl;
    this.catalog = null;
    this.levelIndexes = new Map();
    this.batches = new Map();
  }

  async loadCatalog() {
    if (this.catalog) return this.catalog;
    const data = await this.#readJson(new URL("catalog.json", root));
    if (data?.schemaVersion !== 1 || data.contentVersion !== CONTENT_VERSION || !Array.isArray(data.levels) || data.levels.length !== 5) {
      throw new Error("Invalid content catalog");
    }
    this.catalog = data;
    return data;
  }

  async loadLevel(level) {
    const number = Number(level);
    if (this.levelIndexes.has(number)) return this.levelIndexes.get(number);
    const catalog = await this.loadCatalog();
    const entry = catalog.levels.find((item) => item.level === number);
    if (!entry || !safeRelativeJson(entry.index)) throw new Error("Invalid level index path");
    const index = await this.#readJson(new URL(entry.index, root));
    if (index?.contentVersion !== CONTENT_VERSION || index?.level !== number || !Array.isArray(index.stages) || index.stages.length !== 50) {
      throw new Error(`Invalid level ${number} index`);
    }
    this.levelIndexes.set(number, index);
    return index;
  }

  async loadStage(id) {
    const parsed = parseStageId(id);
    if (!parsed) throw new Error("Invalid stage id");
    const index = await this.loadLevel(parsed.level);
    const summary = index.stages.find((item) => item.id === id);
    if (!summary || !safeRelativeJson(summary.batch)) throw new Error("Stage is missing from its level index");
    const key = `${parsed.level}:${summary.batch}`;
    if (!this.batches.has(key)) {
      const batch = await this.#readJson(new URL(summary.batch, new URL(`level-${parsed.level}/`, root)));
      if (batch?.contentVersion !== CONTENT_VERSION || !Array.isArray(batch?.stages)) throw new Error("Invalid stage batch");
      this.batches.set(key, batch);
    }
    const stage = this.batches.get(key).stages.find((item) => item.id === id);
    if (!stage || stage.contentVersion !== CONTENT_VERSION) throw new Error("Stage not found in batch");
    return stage;
  }

  async preloadNext(id) {
    const parsed = parseStageId(id);
    if (!parsed) return;
    let level = parsed.level;
    let stage = parsed.stage + 1;
    if (stage > 50) {
      level += 1;
      stage = 1;
    }
    if (level <= 5) this.loadStage(`L${level}-${String(stage).padStart(3, "0")}`).catch(() => {});
  }

  async #readJson(url) {
    if (!this.fetch) throw new Error("Fetch is unavailable");
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error("Unsafe content path");
    const response = await this.fetch(url, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}

function safeRelativeJson(value) {
  const path = String(value || "");
  return /^[a-z0-9][a-z0-9._/-]*\.json$/i.test(path) && !/(^|\/)\.\.(\/|$)/.test(path) && !path.includes("\\");
}
