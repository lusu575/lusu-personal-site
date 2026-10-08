import { runTransferCleanup } from "../../functions/api/transfer-service.mjs";
import { admitCost, CostGuardError } from "../../functions/api/cost-guard.mjs";

export default {
  async scheduled(controller, env, context) {
    context.waitUntil((async () => {
      try {
        const guarded = await admitCost(env, { lane: "cleanup" });
        await runTransferCleanup(guarded, { triggerType: "cron", reconcile: false, limit: 10 });
      } catch (error) {
        if (!(error instanceof CostGuardError)) throw error;
        // A paused/exhausted cleanup run has no D1 log or retry loop.
      }
    })());
  }
};
