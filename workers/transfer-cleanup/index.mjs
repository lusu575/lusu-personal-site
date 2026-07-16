import { runTransferCleanup } from "../../functions/api/transfer-service.mjs";

export default {
  async scheduled(controller, env, context) {
    const scheduledAt = new Date(controller.scheduledTime);
    const weeklyReconcile = scheduledAt.getUTCDay() === 0 && scheduledAt.getUTCHours() === 3;
    context.waitUntil(runTransferCleanup(env, {
      triggerType: "cron",
      reconcile: weeklyReconcile,
      limit: 500
    }));
  }
};
