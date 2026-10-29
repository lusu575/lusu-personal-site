/** Runs inside the real Kittens page. No isolated engine or resource mutation. */
export function kittensPageOperation(request) {
  const game = globalThis.gamePage;
  if (!game?.resPool || !game?.bld || !game?.science || !game?.village) {
    throw new Error("KITTENS_PAGE_NOT_READY");
  }
  if (game.devMode) throw new Error("KITTENS_DEV_MODE_REJECTED");
  if (!request || !["observe", "gather", "build", "research", "assign"].includes(request.action)) {
    throw new Error("KITTENS_ACTION_INVALID");
  }
  const count = request.count ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error("KITTENS_COUNT_INVALID");
  if (["build", "research", "observe"].includes(request.action) && count !== 1) throw new Error("KITTENS_SINGLE_ACTION_REQUIRED");
  if (["build", "research", "assign"].includes(request.action)
    && (typeof request.id !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(request.id))) {
    throw new Error("KITTENS_TARGET_INVALID");
  }
  let result = null;
  if (request.action === "gather") {
    for (let i = 0; i < count; i++) game.bld.gatherCatnip();
  } else if (request.action === "assign") {
    const job = game.village.getJob(request.id);
    if (!job?.unlocked) throw new Error("KITTENS_JOB_LOCKED");
    const before = job.value;
    game.village.assignJob(job, count);
    result = { assigned: job.value - before };
  } else if (request.action === "build" || request.action === "research") {
    const building = request.action === "build";
    const metadata = building ? game.bld.get(request.id) : game.science.get(request.id);
    if (!metadata?.unlocked) throw new Error("KITTENS_TARGET_LOCKED");
    const Controller = building
      ? globalThis.classes.ui.btn.BuildingBtnModernController
      : globalThis.com.nuclearunicorn.game.ui.TechButtonController;
    const controller = new Controller(game);
    const model = controller.fetchModel(building ? { building: request.id } : { id: request.id });
    if (!controller.hasResources(model)) throw new Error("KITTENS_CANNOT_AFFORD");
    // The game's normal controller pays costs, applies unlocks and updates the UI.
    result = controller.buyItem(model, {});
  }
  return {
    source: "live-browser",
    action: request.action,
    result: result ?? null,
    resources: game.resPool.resources.filter(r => r.value || r.unlocked)
      .map(r => ({ id: r.name, value: r.value, maxValue: r.maxValue })),
    buildings: game.bld.buildingsData.filter(b => b.unlocked || b.val)
      .map(b => ({ id: b.name, count: b.val || 0, unlocked: Boolean(b.unlocked) })),
    technologies: game.science.techs.filter(t => t.unlocked || t.researched)
      .map(t => ({ id: t.name, researched: Boolean(t.researched), unlocked: Boolean(t.unlocked) })),
    jobs: game.village.jobs.filter(j => j.unlocked)
      .map(j => ({ id: j.name, count: j.value })),
    freeKittens: game.village.getFreeKittens()
  };
}
