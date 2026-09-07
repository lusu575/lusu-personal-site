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
  const refreshButton = root.querySelector("[data-h3-refresh]");
  const checkedAt = root.querySelector("[data-h3-checked-at]");
  const guidancePanel = root.querySelector("[data-h3-next-steps]");
  const guidanceList = root.querySelector("[data-h3-guidance]");
  const cards = new Map([...root.querySelectorAll("[data-h3-status]")].map((card) => [card.dataset.h3Status, card]));
  let activeRunner = null;
  let transferEnabled = false;
  let statusLoading = false;
  let submitting = false;
  let canSubmitCurrent = false;
  const pendingDownloads = new Map();

  const stateLabels = { ready: "已连接", offline: "未就绪", read: "已读取", pending: "读取中", busy: "执行中", unknown: "读取失败" };
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
    canSubmitCurrent = Boolean(enabled);
    if (fieldset) fieldset.disabled = !enabled || submitting;
    if (formNote) formNote.textContent = enabled
      ? "家庭电脑已就绪，可以提交文字生成视频任务。结果下载还需传输服务单独就绪。"
      : "暂时不能提交，请先完成上方“接下来这样处理”中的检查。";
  };

  const setGuidance = (steps) => {
    if (!guidancePanel || !guidanceList) return;
    guidanceList.replaceChildren(...steps.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
    guidancePanel.hidden = steps.length === 0;
  };

  const jobStateLabels = {
    awaiting_assets: "等待素材", queued: "排队中", leased: "已领取", validating: "验证任务",
    submitted: "已提交生成", running: "生成中", retrieving: "取回结果", ready: "已完成",
    failed: "失败", stalled: "任务停滞", cancelled: "已取消", expired: "已过期", deleted: "已删除"
  };
  const readableTime = (value) => {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "medium" }).format(date)
      : "时间未知";
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
      title.textContent = job.projectTitle || job.jobId || "未命名任务";
      const status = document.createElement("span");
      status.className = "h3-job-state";
      const progress = Number(job.progressBasisPoints);
      const progressLabel = job.progressBasisPoints != null && Number.isFinite(progress)
        ? ` · ${Math.min(100, Math.max(0, Math.round(progress / 100)))}%` : "";
      status.textContent = `${jobStateLabels[job.state] || "状态待确认"}${progressLabel}`;
      const meta = document.createElement("p");
      const result = job.result && typeof job.result === "object" ? job.result : null;
      meta.textContent = result
        ? `结果：${result.name || "已登记"}${Number.isFinite(Number(result.bytes)) ? ` · ${(Number(result.bytes) / 1048576).toFixed(2)} MiB` : ""}`
        : `更新：${readableTime(job.updatedAt)}${job.stageCode ? ` · 阶段代码：${job.stageCode}` : ""}`;
      if (job.state && !Object.hasOwn(jobStateLabels, job.state)) {
        meta.textContent += ` · 未识别状态代码：${String(job.state).slice(0, 80)}`;
      }
      item.append(title, status, meta);
      if (result && job.state === "ready" && transferEnabled) {
        const download = document.createElement("button");
        download.className = "h3-secondary-button";
        download.type = "button";
        download.textContent = "连接家庭电脑下载结果";
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
    if (statusLoading) return;
    statusLoading = true;
    if (refreshButton) { refreshButton.disabled = true; refreshButton.setAttribute("aria-busy", "true"); }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const [runnersResponse, jobsResponse] = await Promise.all([
        fetch("/api/admin/minimax-h3/runners", { credentials: "same-origin", signal: controller.signal, headers: { Accept: "application/json" } }),
        fetch("/api/admin/minimax-h3/jobs?pageSize=10", { credentials: "same-origin", signal: controller.signal, headers: { Accept: "application/json" } })
      ]);
      if (!runnersResponse.ok || !jobsResponse.ok) {
        const status = !runnersResponse.ok ? runnersResponse.status : jobsResponse.status;
        throw new Error(status === 401 || status === 403
          ? "登录已失效或当前账号没有管理权限，请返回后台重新登录。"
          : `状态请求失败（HTTP ${status}），请稍后重试。`);
      }
      const runnersPayload = await runnersResponse.json();
      const jobsPayload = await jobsResponse.json();
      const runners = Array.isArray(runnersPayload.runners) ? runnersPayload.runners : [];
      const jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : [];
      transferEnabled = runnersPayload.transferEnabled === true;
      activeRunner = runners.find((runner) => runner.readyState === "ready") || null;
      const displayedRunner = activeRunner || runners.find((runner) => runner.readyState === "busy") || runners[0] || null;
      const runnerConnected = displayedRunner && ["ready", "busy", "agent_only"].includes(displayedRunner.readyState);
      const capabilities = runnerConnected && displayedRunner.capabilities && typeof displayedRunner.capabilities === "object" ? displayedRunner.capabilities : {};

      if (!runnerConnected) {
        setCard("runner", "offline", displayedRunner ? `最近报告：${readableTime(displayedRunner.lastSeenAt)}。请检查家庭电脑是否在线。` : "尚未发现家庭执行程序。请在家庭电脑检查 Runner。");
        setCard("controller", "offline", "等待家庭电脑上报控制器诊断结果。");
        setCard("comfy", "offline", "等待家庭电脑上报视频生成服务状态。");
        setCard("bridge", "offline", "等待家庭电脑上报结果传输服务状态。");
        setCard("disk", "offline", "尚未取得有效的本地磁盘状态。");
      } else {
        setCard("runner", displayedRunner.readyState === "busy" ? "busy" : "ready", `${displayedRunner.label || displayedRunner.runnerId} · 最近报告：${readableTime(displayedRunner.lastSeenAt)}`);
        setCard("controller", capabilities.controllerDoctorOk ? "ready" : "offline", capabilities.controllerDoctorOk ? `控制器 ${displayedRunner.controllerVersion || "版本未报告"} 的环境诊断已通过。` : "控制器诊断尚未通过，请在家庭电脑检查。");
        setCard("comfy", capabilities.comfyReachable ? "ready" : "offline", capabilities.comfyReachable ? "家庭电脑已确认 ComfyUI 可以连接。" : "无法确认 ComfyUI 连接，请检查家庭电脑上的服务。");
        setCard("bridge", capabilities.bridgeOnline ? "ready" : "offline", capabilities.bridgeOnline ? "本地传输服务已连接；外网下载仍须通过独立开关与认证。" : "结果传输服务未就绪；生成与下载的状态分别检查。");
        setCard("disk", capabilities.diskState === "ok" ? "ready" : "read", ({ ok: "本地可用空间检查通过。", low: "可用空间不足，请在家庭电脑清理输出目录。", unknown: "尚未确认本地可用空间。" })[capabilities.diskState] || "尚未确认本地可用空间。");
      }

      const jobsEnabled = jobsPayload.controlEnabled === true;
      setCard("jobs", jobsEnabled ? "read" : "offline", jobsEnabled ? `当前显示最近 ${jobs.length} 条任务。` : "任务开关处于关闭状态，暂时不能新建或领取任务。");
      const canSubmit = jobsEnabled && Boolean(activeRunner) && activeRunner.capabilities?.controllerDoctorOk === true && activeRunner.capabilities?.comfyReachable === true;
      setFormEnabled(canSubmit);
      renderJobs(jobs);
      const steps = [];
      if (!runnerConnected) {
        steps.push("在家庭电脑确认电源与网络正常，检查 Runner 执行程序及其站长授权是否仍然有效。");
        steps.push("在同一台家庭电脑打开 127.0.0.1:8188，确认 ComfyUI 正常启动；回到这里刷新状态。");
      } else {
        if (!capabilities.controllerDoctorOk) steps.push("在家庭电脑运行已锁定版本控制器的环境诊断（doctor），根据诊断结果补齐缺失依赖。");
        if (!capabilities.comfyReachable) steps.push("在家庭电脑检查 ComfyUI 是否正常启动，并确认 127.0.0.1:8188 可以访问。");
        if (displayedRunner.readyState === "busy") steps.push("家庭执行程序正在处理任务。请先查看下方最近任务，等待当前任务完成后再刷新。");
        if (capabilities.diskState === "low") steps.push("在家庭电脑检查输出目录和磁盘可用空间，处理空间不足后重新运行环境诊断。");
      }
      if (!jobsEnabled) steps.push("任务开关当前关闭。完成家庭执行链路与 GPU 小样验证后，由站长核对部署配置；本页不会自动开启。");
      if (!capabilities.bridgeOnline || !transferEnabled) steps.push("如需下载成片，再检查家庭电脑上的 Bridge 和独立传输开关；生成服务就绪不代表外网下载已可用。");
      setGuidance(steps);
      if (liveSummary) liveSummary.textContent = canSubmit
        ? "环境检查已通过，可以提交文字生成视频任务。"
        : "环境检查尚未全部通过，暂时不能提交任务。请按下方步骤处理。";
      if (checkedAt) checkedAt.textContent = `检查时间：${readableTime(new Date())}`;
    } catch (error) {
      activeRunner = null;
      transferEnabled = false;
      setFormEnabled(false);
      for (const key of cards.keys()) setCard(key, "unknown", "本次读取失败，当前状态未确认。请刷新重试。");
      jobList?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      const reason = error?.name === "AbortError" ? "状态读取超时，请检查网络后重试。" : error instanceof Error ? error.message : "状态读取失败，请重试。";
      if (liveSummary) liveSummary.textContent = `${reason} 提交与下载已暂停；已有输入仍保留。`;
      if (checkedAt) checkedAt.textContent = "本次检查失败，历史任务可能不是最新状态";
      if (!jobList?.childElementCount || jobList.querySelector(".h3-empty-state")) {
        const empty = document.createElement("p");
        empty.className = "h3-empty-state";
        empty.textContent = "任务列表读取失败，点击顶部“刷新状态”重试。";
        jobList?.replaceChildren(empty);
      }
      setGuidance(["先检查当前网络连接；如提示登录或权限错误，返回管理后台重新登录。", "点击顶部“刷新状态”重新读取。读取失败时不会重新提交或启动任务。"]);
    } finally {
      window.clearTimeout(timeout);
      statusLoading = false;
      if (refreshButton) { refreshButton.disabled = false; refreshButton.removeAttribute("aria-busy"); }
    }
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeRunner || fieldset?.disabled || submitting) return;
    submitting = true;
    fieldset.disabled = true;
    form.setAttribute("aria-busy", "true");
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
    } finally {
      submitting = false;
      form.removeAttribute("aria-busy");
      setFormEnabled(canSubmitCurrent);
    }
  });

  refreshButton?.addEventListener("click", () => { void loadLiveStatus(); });
  setFormEnabled(false);
  void loadLiveStatus();
})();
