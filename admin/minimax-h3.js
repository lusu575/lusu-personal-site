(function () {
  "use strict";

  const root = document.querySelector(".h3-console");
  if (!root) return;

  const backLink = root.querySelector("[data-h3-back]");
  if (backLink) {
    const requestedSource = new URLSearchParams(window.location.search).get("from");
    let source = requestedSource === "admin" || requestedSource === "tools"
      ? requestedSource
      : "";
    if (!source && document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin) {
          source = referrer.pathname.startsWith("/admin/")
            && referrer.pathname !== "/admin/minimax-h3.html"
            ? "admin"
            : "tools";
        }
      } catch {
        // A malformed referrer falls back to the public Tools entry.
      }
    }
    if (source === "admin") {
      backLink.href = "/admin/";
      backLink.textContent = "返回管理后台";
    } else {
      backLink.href = "/#resources";
      backLink.textContent = "返回工具区";
    }
  }

  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const syncMotionState = () => { root.dataset.motion = motionQuery?.matches ? "reduced" : "full"; };
  syncMotionState();
  motionQuery?.addEventListener?.("change", syncMotionState);

  const liveSummary = root.querySelector("[data-h3-live-summary]");
  const form = root.querySelector("[data-h3-job-form]");
  const fieldset = root.querySelector("[data-h3-job-fieldset]");
  const formNote = root.querySelector("[data-h3-form-note]");
  const formMessage = root.querySelector("[data-h3-form-message]");
  const jobList = root.querySelector("[data-h3-job-list]");
  const projectTitle = root.querySelector("[data-h3-project-title]");
  const aspect = root.querySelector("[data-h3-aspect]");
  const preset = root.querySelector("[data-h3-preset]");
  const prompt = root.querySelector("[data-h3-prompt]");
  const cards = new Map([...root.querySelectorAll("[data-h3-status]")].map((card) => [card.dataset.h3Status, card]));
  let activeRunner = null;
  let transferEnabled = false;
  const pendingDownloads = new Map();

  const stateLabels = { ready: "已连接", offline: "离线", read: "已读取", pending: "读取中", busy: "执行中" };
  const setCard = (key, state, detail) => {
    const card = cards.get(key);
    if (!card) return;
    card.dataset.state = state;
    const stateNode = card.querySelector(".h3-state");
    const detailNode = card.querySelector("p");
    if (stateNode) stateNode.textContent = stateLabels[state] || "未验证";
    if (detailNode && detail) detailNode.textContent = detail;
  };

  const operationId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `op_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  };

  const setFormEnabled = (enabled) => {
    if (fieldset) fieldset.disabled = !enabled;
    if (formNote) formNote.textContent = enabled
      ? "已选择就绪 Runner。当前只开放无参考 T2V；完成任务后可通过一次性票据连接 Bridge。"
      : "需要：Cloudflare 控制开关、管理员 Runner、固定控制器 doctor 通过，以及 ComfyUI 心跳正常。";
  };

  const renderJobs = (jobs) => {
    if (!jobList) return;
    while (jobList.firstChild) jobList.removeChild(jobList.firstChild);
    if (!jobs.length) {
      const empty = document.createElement("div");
      empty.className = "h3-empty-state";
      const title = document.createElement("strong");
      title.textContent = "暂无任务";
      const detail = document.createElement("p");
      detail.textContent = "提交后，这里只显示受保护的任务状态与结果摘要。";
      empty.append(title, detail);
      jobList.append(empty);
      return;
    }
    for (const job of jobs) {
      const item = document.createElement("article");
      item.className = "h3-job-item";
      const title = document.createElement("strong");
      title.textContent = job.jobId || "未命名任务";
      const status = document.createElement("span");
      status.className = "h3-job-state";
      status.textContent = `${job.state || "unknown"} · ${job.progressBasisPoints ? Math.round(job.progressBasisPoints / 100) : 0}%`;
      const meta = document.createElement("p");
      const result = job.result && typeof job.result === "object" ? job.result : null;
      meta.textContent = result
        ? `结果：${result.name || "已登记"} · ${result.bytes || 0} bytes`
        : `阶段：${job.stageCode || "queued"} · 更新：${job.updatedAt || "未知"}`;
      item.append(title, status, meta);
      if (result && job.state === "ready" && transferEnabled) {
        const download = document.createElement("button");
        download.className = "h3-secondary-button";
        download.type = "button";
        download.textContent = "连接 Bridge 下载";
        download.addEventListener("click", () => { void requestDownload(job, download); });
        item.append(download);
      }
      jobList.append(item);
    }
  };

  const requestDownload = async (job, button) => {
    button.disabled = true;
    const pending = pendingDownloads.get(job.jobId);
    try {
      let payload = pending;
      if (!payload) {
        button.textContent = "正在签发票据……";
        const response = await fetch(`/api/admin/minimax-h3/jobs/${encodeURIComponent(job.jobId)}/download-ticket`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ operationId: operationId() })
        });
        payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error?.message || payload.message || "票据签发失败");
        if (!payload.bridgeOrigin || !payload.ticketId || !payload.secret) throw new Error("Bridge 票据响应不完整");
        pendingDownloads.set(job.jobId, payload);
        const bridgeWindow = window.open(`${payload.bridgeOrigin}/v1/bootstrap`, "h3Bridge", "noopener,noreferrer");
        if (!bridgeWindow) {
          button.disabled = false;
          button.textContent = "请允许弹窗后继续连接";
          return;
        }
        button.disabled = false;
        button.textContent = "已打开 Bridge 登录，点击完成连接";
        return;
      }
      button.textContent = "正在连接 Bridge……";
      const bridgeResponse = await fetch(`${payload.bridgeOrigin}/v1/session/exchange`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ticketId: payload.ticketId, secret: payload.secret })
      });
      const session = await bridgeResponse.json().catch(() => ({}));
      if (!bridgeResponse.ok || !session.csrfToken) throw new Error("Bridge 会话交换失败");
      const resultUrl = `${payload.bridgeOrigin}/v1/jobs/${encodeURIComponent(job.jobId)}/result`;
      const link = document.createElement("a");
      link.href = resultUrl;
      link.download = payload.result?.name || "h3-result.mp4";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      pendingDownloads.delete(job.jobId);
      button.textContent = "已连接 Bridge";
    } catch (error) {
      button.textContent = error instanceof Error ? error.message : "下载失败";
      button.disabled = false;
    }
  };

  const loadLiveStatus = async () => {
    try {
      const [runnersResponse, jobsResponse] = await Promise.all([
        fetch("/api/admin/minimax-h3/runners", { credentials: "same-origin", headers: { Accept: "application/json" } }),
        fetch("/api/admin/minimax-h3/jobs?pageSize=10", { credentials: "same-origin", headers: { Accept: "application/json" } })
      ]);
      if (!runnersResponse.ok || !jobsResponse.ok) throw new Error("status-fetch-failed");
      const runnersPayload = await runnersResponse.json();
      const jobsPayload = await jobsResponse.json();
      const runners = Array.isArray(runnersPayload.runners) ? runnersPayload.runners : [];
      const jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : [];
      transferEnabled = jobsPayload.transferEnabled === true;
      activeRunner = runners.find((runner) => runner.readyState === "ready") || null;

      if (!activeRunner) {
        setCard("runner", "offline", "尚未发现 ready Runner；页面不使用占位状态。 ");
        setCard("controller", "offline", "没有 Runner 回报固定控制器 doctor 结果。 ");
        setCard("comfy", "offline", "没有 Runner 回报 127.0.0.1:8188 可达。 ");
        setCard("bridge", "offline", "没有 Runner 回报 loopback Bridge 可达。 ");
        setCard("disk", "offline", "没有 Runner 回报本地磁盘状态。 ");
      } else {
        const capabilities = activeRunner.capabilities && typeof activeRunner.capabilities === "object" ? activeRunner.capabilities : {};
        setCard("runner", "ready", `${activeRunner.label || activeRunner.runnerId} · ${activeRunner.readyState}`);
        setCard("controller", capabilities.controllerDoctorOk ? "ready" : "offline", capabilities.controllerDoctorOk ? `固定控制器 ${activeRunner.controllerVersion || "unknown"} 已通过 doctor。` : "Runner 尚未回报 doctor 通过。 ");
        setCard("comfy", capabilities.comfyReachable ? "ready" : "offline", capabilities.comfyReachable ? "ComfyUI 127.0.0.1:8188 已由 Runner 回报可达。" : "Runner 尚未回报 ComfyUI 可达。 ");
        setCard("bridge", capabilities.bridgeOnline ? "ready" : "offline", capabilities.bridgeOnline ? "loopback Bridge 已由 Runner 回报在线。" : "Bridge 尚未回报在线；不宣称 Tunnel 可用。 ");
        setCard("disk", capabilities.diskState === "ok" ? "ready" : "read", `Runner 磁盘状态：${capabilities.diskState || "unknown"}。`);
      }

      const jobsEnabled = jobsPayload.controlEnabled === true;
      setCard("jobs", jobsEnabled ? "read" : "offline", jobsEnabled ? `任务 API 已读取；当前列表返回 ${jobs.length} 条。` : "任务控制开关仍关闭；没有提交、领取或 GPU 执行。 ");
      const canSubmit = jobsEnabled && Boolean(activeRunner) && activeRunner.capabilities?.controllerDoctorOk === true && activeRunner.capabilities?.comfyReachable === true;
      setFormEnabled(canSubmit);
      renderJobs(jobs);
      if (liveSummary) liveSummary.textContent = canSubmit
        ? "Runner 与本地 ComfyUI 已通过当前阶段检查；可提交无参考 T2V。"
        : "状态已从受保护 API 读取；控制开关或本地执行链路尚未全部通过。";
    } catch {
      activeRunner = null;
      setFormEnabled(false);
      if (liveSummary) liveSummary.textContent = "状态读取失败；页面保持保守状态，不把失败改写为在线。";
    }
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeRunner || fieldset?.disabled) return;
    if (formMessage) formMessage.textContent = "正在提交……";
    const body = {
      operationId: operationId(),
      runnerId: activeRunner.runnerId,
      projectTitle: projectTitle?.value.trim() || "H3 T2V",
      sourceLanguage: "zh-CN",
      job: {
        mode: "t2v",
        workflowVariant: null,
        durationSeconds: 5,
        targetFrames: null,
        aspectRatio: aspect?.value || "16:9",
        preset: preset?.value || "safe",
        prompt: prompt?.value.trim() || "",
        references: [],
        includeVideoAudio: true,
        seed: null
      }
    };
    try {
      const response = await fetch("/api/admin/minimax-h3/jobs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.message || "提交失败");
      if (formMessage) formMessage.textContent = `已入队：${payload.job?.jobId || "任务"}`;
      form.reset();
      await loadLiveStatus();
    } catch (error) {
      if (formMessage) formMessage.textContent = error instanceof Error ? error.message : "提交失败";
    }
  });

  setFormEnabled(false);
  void loadLiveStatus();
})();
