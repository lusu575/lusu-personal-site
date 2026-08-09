(function installLuSuLifeRestartAgent() {
  "use strict";

  const PROTOCOL_VERSION = 1;
  const GAME_ID = "life-restart";
  const MAX_RECEIPTS = 128;
  const sessionId = `game_life-restart_${secureHex(16)}`;
  let revision = 0;
  let fingerprint = "";
  let actionCatalog = null;
  const receipts = [];

  function install() {
    if (!globalThis.Laya || !globalThis.core || !globalThis.$ui?.currentView) {
      window.setTimeout(install, 100);
      return;
    }
    const agent = Object.freeze({
      protocolVersion: PROTOCOL_VERSION,
      gameId: GAME_ID,
      sessionId,
      observe,
      actions,
      act
    });
    window.gamePage = Object.freeze({ agent });
    fingerprint = capture().fingerprint;
  }

  function observe() {
    return observationEnvelope(sync());
  }

  function actions() {
    const captured = sync();
    const tokenMap = new Map();
    const actionEntries = captured.entries.map((entry) => {
      const token = `life_${secureHex(16)}`;
      tokenMap.set(token, entry);
      return Object.freeze({
        id: entry.id,
        label: entry.label,
        group: entry.group,
        description: entry.description,
        action: Object.freeze({ type: "invoke", token }),
        risk: entry.risk || "low",
        requiresConfirmation: entry.requiresConfirmation === true
      });
    });
    actionCatalog = { revision, tokenMap };
    return Object.freeze({
      protocolVersion: PROTOCOL_VERSION,
      gameId: GAME_ID,
      sessionId,
      revision,
      actions: Object.freeze(actionEntries)
    });
  }

  function act(request) {
    const normalized = normalizeRequest(request);
    const requestFingerprint = `${normalized.expectedRevision}:${normalized.action.token}`;
    const prior = receipts.find((entry) => entry.clientActionId === normalized.clientActionId);
    if (prior) {
      if (prior.fingerprint !== requestFingerprint) {
        throw bridgeError("GAME_CLIENT_ACTION_ID_REUSED", "The client action id was reused.");
      }
      return Object.freeze({ ...prior.result, deduplicated: true });
    }

    sync();
    const beforeRevision = revision;
    const catalogEntry = actionCatalog?.revision === beforeRevision
      ? actionCatalog.tokenMap.get(normalized.action.token)
      : null;
    if (normalized.expectedRevision !== beforeRevision || !catalogEntry) {
      throw bridgeError("GAME_REVISION_CONFLICT", "The Life Restart action is stale.");
    }
    const liveEntry = capture().entries.find((entry) => entry.key === catalogEntry.key);
    if (!liveEntry) {
      actionCatalog = null;
      throw bridgeError("GAME_ACTION_TOKEN_INVALID", "The Life Restart action is no longer available.");
    }

    const invoked = liveEntry.invoke() === true;
    const after = capture();
    if (invoked) revision = beforeRevision + 1;
    fingerprint = after.fingerprint;
    actionCatalog = null;
    const observation = observationEnvelope(after);
    const result = Object.freeze({
      protocolVersion: PROTOCOL_VERSION,
      gameId: GAME_ID,
      sessionId,
      clientActionId: normalized.clientActionId,
      status: invoked ? "applied" : "noop",
      reason: invoked ? "action-invoked" : "action-unavailable",
      beforeRevision,
      revision,
      deduplicated: false,
      events: Object.freeze(invoked ? [Object.freeze({ type: "semantic_action", action: liveEntry.id })] : []),
      observation
    });
    receipts.push({ clientActionId: normalized.clientActionId, fingerprint: requestFingerprint, result });
    if (receipts.length > MAX_RECEIPTS) receipts.splice(0, receipts.length - MAX_RECEIPTS);
    return result;
  }

  function normalizeRequest(request) {
    if (!request || typeof request !== "object" || Array.isArray(request)
      || Object.keys(request).sort().join(",") !== "action,clientActionId,expectedRevision") {
      throw bridgeError("GAME_ACTION_REQUEST_INVALID", "Invalid Life Restart action request.");
    }
    const expectedRevision = Number(request.expectedRevision);
    const clientActionId = String(request.clientActionId || "");
    const action = request.action;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(clientActionId)
      || !action || typeof action !== "object" || Array.isArray(action)
      || Object.keys(action).sort().join(",") !== "token,type"
      || action.type !== "invoke" || !/^life_[a-f0-9]{32}$/.test(action.token)) {
      throw bridgeError("GAME_ACTION_REQUEST_INVALID", "Invalid Life Restart action identity.");
    }
    return Object.freeze({ expectedRevision, clientActionId, action });
  }

  function sync() {
    const captured = capture();
    if (fingerprint && captured.fingerprint !== fingerprint) {
      revision += 1;
      actionCatalog = null;
    }
    fingerprint = captured.fingerprint;
    return captured;
  }

  function capture() {
    const view = $ui.currentView;
    const phase = identifyPhase(view);
    const state = captureState(view, phase);
    const entries = $ui.currentDialog ? [] : captureActions(view, phase);
    const actionSignature = entries.map((entry) => `${entry.key}:${entry.label}`);
    return {
      phase,
      state,
      entries,
      fingerprint: JSON.stringify({ phase, state, actions: actionSignature })
    };
  }

  function observationEnvelope(captured) {
    return Object.freeze({
      protocolVersion: PROTOCOL_VERSION,
      gameId: GAME_ID,
      sessionId,
      revision,
      phase: captured.phase,
      terminal: false,
      score: Object.freeze({ current: finiteNumber(core.times, 0) }),
      state: deepFreeze(captured.state)
    });
  }

  function identifyPhase(view) {
    if (!view) return "loading";
    if (view.btnRemake) return "main";
    if (view.btnCustom) return "mode";
    if (view.listTalents && typeof view.onClickDrawCard === "function") return "talent";
    if (view.inputCharm && typeof view.onPropertyAllocate === "function") return "property";
    if (view.panelTrajectory && typeof view.onNext === "function") return "trajectory";
    if (view.listSelectedTalents && view.btnAgain && typeof view.onAgain === "function") return "summary";
    return "unsupported-view";
  }

  function captureState(view, phase) {
    const common = {
      dialogOpen: Boolean($ui.currentDialog),
      remakes: finiteNumber(core.times, 0),
      properties: numberMap(core.propertys || {}, 32)
    };
    if (phase === "talent") {
      common.drawn = view.pageResult?.visible === true;
      common.selectionLimit = finiteNumber(core.talentSelectLimit, 0);
      common.talents = talentRows(view.listTalents);
      common.selectedTalentIds = selectedTalentIds(view.listTalents);
    } else if (phase === "property") {
      common.allocation = {
        charm: inputNumber(view.inputCharm),
        intelligence: inputNumber(view.inputIntelligence),
        strength: inputNumber(view.inputStrength),
        money: inputNumber(view.inputMoney),
        remaining: finiteNumber(view.labLeftPropertyPoint?.text, 0)
      };
      common.talents = talentRows(view.listSelectedTalents);
    } else if (phase === "trajectory") {
      common.finished = view.btnSummary?.visible === true;
      common.age = finiteNumber(core.propertys?.[core.PropertyTypes?.AGE], 0);
      common.recentEvents = trajectoryRows(view).slice(-12);
    } else if (phase === "summary") {
      common.summary = summaryMap(core.summary || {}, 32);
      common.talents = talentRows(view.listSelectedTalents);
      common.selectedTalentIds = selectedTalentIds(view.listSelectedTalents);
    }
    return common;
  }

  function captureActions(view, phase) {
    if (!view) return [];
    if (phase === "main") {
      return buttonAction(view, "btnRemake", "start-custom-life", "Start a new life", "flow");
    }
    if (phase === "mode") {
      return buttonAction(view, "btnCustom", "choose-custom-mode", "Choose custom mode", "flow");
    }
    if (phase === "talent") return talentActions(view);
    if (phase === "property") return propertyActions(view);
    if (phase === "trajectory") return trajectoryActions(view);
    if (phase === "summary") return summaryActions(view);
    return [];
  }

  function talentActions(view) {
    const entries = [];
    if (view.pageDrawCard?.visible !== false) {
      entries.push(...buttonAction(view, "btnDrawCard", "draw-talents", "Draw talent cards", "talent"));
      return entries;
    }
    visibleListCells(view.listTalents).forEach((cell, index) => {
      const talent = cell.dataSource;
      if (!talent || talent.id === undefined) return;
      const selected = cellSelected(cell);
      entries.push({
        key: `talent:${String(talent.id)}:${selected ? "deselect" : "select"}`,
        id: safeActionId(`${selected ? "deselect" : "select"}-talent-${talent.id}`),
        label: `${selected ? "Deselect" : "Select"} ${boundedText(talent.name || talent.id, 120)}`,
        group: "talent",
        description: "Toggle this offered talent card.",
        invoke: () => {
          const currentView = $ui.currentView;
          if (currentView !== view || identifyPhase(currentView) !== "talent"
            || cell.destroyed || String(cell.dataSource?.id) !== String(talent.id)) return false;
          cell.event(Laya.Event.CLICK);
          return true;
        }
      });
    });
    if (selectedTalentIds(view.listTalents).length >= finiteNumber(core.talentSelectLimit, Infinity)) {
      entries.push(...buttonAction(view, "btnNext", "confirm-talents", "Continue with selected talents", "flow"));
    }
    return entries;
  }

  function propertyActions(view) {
    const entries = [];
    [
      ["Charm", "charm"], ["Intelligence", "intelligence"],
      ["Strength", "strength"], ["Money", "money"]
    ].forEach(([property, label]) => {
      entries.push(...buttonAction(view, `btn${property}Increase`, `increase-${label}`, `Increase ${label}`, "property"));
      entries.push(...buttonAction(view, `btn${property}Reduce`, `decrease-${label}`, `Decrease ${label}`, "property"));
    });
    entries.push(...buttonAction(view, "btnRandomAllocate", "random-allocation", "Allocate remaining points randomly", "property"));
    if (finiteNumber(view.labLeftPropertyPoint?.text, -1) === 0) {
      entries.push(...buttonAction(view, "btnNext", "confirm-properties", "Start this life", "flow"));
    }
    return entries;
  }

  function trajectoryActions(view) {
    if (view.btnSummary?.visible === true) {
      return methodAction(view, "onSummary", "open-summary", "Open life summary", "flow");
    }
    return methodAction(view, "onNext", "advance-one-year", "Advance one year", "trajectory");
  }

  function summaryActions(view) {
    const entries = [];
    const talents = Array.isArray(view.listSelectedTalents?.array) ? view.listSelectedTalents.array : [];
    talents.slice(0, 32).forEach((talent) => {
      if (!talent || talent.id === undefined || typeof view.onSelectTalent !== "function") return;
      entries.push({
        key: `extend-talent:${String(talent.id)}`,
        id: safeActionId(`extend-talent-${talent.id}`),
        label: `Toggle inherited talent ${boundedText(talent.name || talent.id, 120)}`,
        group: "summary",
        description: "Choose this completed-life talent for the next life.",
        invoke: () => {
          if ($ui.currentView !== view || identifyPhase(view) !== "summary") return false;
          view.onSelectTalent(talent.id);
          return true;
        }
      });
    });
    entries.push(...buttonAction(view, "btnAgain", "continue-after-summary", "Return to the main screen", "flow"));
    return entries;
  }

  function buttonAction(view, property, id, label, group) {
    const button = view?.[property];
    if (!buttonAvailable(button)) return [];
    return [{
      key: `button:${identifyPhase(view)}:${property}`,
      id,
      label,
      group,
      description: "Invoke this audited Life Restart control.",
      invoke: () => {
        if ($ui.currentView !== view || view[property] !== button || !buttonAvailable(button)) return false;
        button.event(Laya.Event.CLICK);
        return true;
      }
    }];
  }

  function methodAction(view, method, id, label, group) {
    if (typeof view?.[method] !== "function") return [];
    return [{
      key: `method:${identifyPhase(view)}:${method}`,
      id,
      label,
      group,
      description: "Invoke this audited Life Restart progression method.",
      invoke: () => {
        if ($ui.currentView !== view || typeof view[method] !== "function") return false;
        view[method]();
        return true;
      }
    }];
  }

  function buttonAvailable(button) {
    return Boolean(button && !button.destroyed && button.visible !== false
      && button.disabled !== true && button.mouseEnabled !== false);
  }

  function visibleListCells(list) {
    const cells = Array.from(list?.cells || list?._cells || []);
    const result = [];
    const seen = new Set();
    cells.forEach((cell) => {
      if (!cell || cell.destroyed || !cell.dataSource || seen.has(String(cell.dataSource.id))) return;
      seen.add(String(cell.dataSource.id));
      result.push(cell);
    });
    return result;
  }

  function cellSelected(cell) {
    const selected = cell?.getChildByName?.("selected");
    if (selected) return selected.visible === true;
    const blank = cell?.getChildByName?.("blank");
    return blank ? blank.pause === false : false;
  }

  function selectedTalentIds(list) {
    return visibleListCells(list).filter(cellSelected).map((cell) => String(cell.dataSource.id)).sort();
  }

  function talentRows(list) {
    const rows = Array.isArray(list?.array) ? list.array : [];
    return rows.slice(0, 64).map((talent) => ({
      id: boundedText(talent?.id, 80),
      name: boundedText(talent?.name, 160),
      description: boundedText(talent?.description, 500),
      grade: finiteNumber(talent?.grade, 0)
    }));
  }

  function trajectoryRows(view) {
    const rows = Array.from(view?.vboxTrajectory?._childs || []);
    return rows.map((row) => boundedText(
      row?.labContent?.text || row?.getChildByName?.("labContent")?.text || "",
      500
    )).filter(Boolean);
  }

  function numberMap(value, limit) {
    if (!value || typeof value !== "object") return {};
    const result = {};
    Object.keys(value).sort().slice(0, limit).forEach((key) => {
      const number = Number(value[key]);
      if (Number.isFinite(number)) result[boundedText(key, 80)] = number;
    });
    return result;
  }

  function summaryMap(value, limit) {
    if (!value || typeof value !== "object") return {};
    const result = {};
    Object.keys(value).sort().slice(0, limit).forEach((key) => {
      const row = value[key];
      if (!row || typeof row !== "object") return;
      result[boundedText(key, 80)] = {
        value: finiteNumber(row.value, 0),
        grade: finiteNumber(row.grade, 0),
        judge: boundedText(row.judge, 160)
      };
    });
    return result;
  }

  function inputNumber(input) {
    return finiteNumber(input?.text, 0);
  }

  function safeActionId(value) {
    const normalized = String(value || "action").replace(/[^A-Za-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
    return (normalized || "action").slice(0, 128);
  }

  function boundedText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function secureHex(length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function bridgeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  install();
}());
