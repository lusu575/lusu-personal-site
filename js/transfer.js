(function () {
  "use strict";

  const MIB = 1024 * 1024;
  const ROOM_NAMESPACE = "lusu575-quick-transfer-room-v1";
  const TEXT_SALT = new TextEncoder().encode("lusu575-quick-transfer-text-v1");
  const SESSION_TASKS_KEY = "lusu-transfer-upload-tasks-v1";
  const COPY = {
    zh: {
      back: "返回工具区", title: "临时互传", retention: "内容在发布完成 24 小时后自动失效。",
      loginTitle: "登录后使用临时互传", loginBody: "登录后会回到此处；使用同一房间口令的登录账号会进入同一个临时房间。", loginAction: "登录并继续", loginBack: "返回工具列表",
      roomPassword: "房间口令", roomPlaceholder: "至少 6 位，分享给另一位登录用户", generate: "随机生成", copy: "复制",
      securityNote: "明文口令不会发送到服务器；文字会在浏览器中使用 AES-GCM 加密。文件不使用该口令加密，只通过 HTTPS 传输、私有 R2 存储和服务端鉴权保护，且不会进行病毒扫描。请勿发送账号凭证或不可信文件。", enter: "进入房间",
      roomActive: "临时房间已连接", refresh: "刷新", leave: "离开房间", textLabel: "加密文字",
      textPlaceholder: "发送一段加密文字……", send: "发送", dropTitle: "添加照片或文件", dropRelease: "松开以添加到待发送附件", choosePhoto: "选择照片", chooseFile: "选择文件", tasks: "上传任务",
      online: "在线", offline: "离线", loading: "正在连接临时互传……", loginNeeded: "请先登录后使用临时互传。",
      r2Missing: "R2 尚未绑定，文字房间可查看，但文件上传暂不可用。", generated: "已生成随机口令，请复制给另一位登录用户。",
      copied: "房间口令已复制。", copyFailed: "无法访问剪贴板，请手动复制。", shortPassword: "房间口令至少需要 6 位。",
      joined: "已进入临时房间。", joinFailed: "无法进入房间。", normalMode: "普通账号 · 单文件最多 {max} · 近 24 小时额度剩余 {remaining}",
      adminMode: "管理员大文件模式 · 分片上传 · 不受普通业务配额限制", pool: "普通用户免费池：{status}",
      empty: "房间里还没有内容。发送加密文字或选择文件开始互传。", expires: "剩余 {time}", download: "下载", delete: "删除", copyText: "复制文字", textCopied: "文字已复制。",
      decrypting: "正在解密文字……", decryptFailed: "这条文字无法用当前房间口令解密。", unknownUploader: "已登录用户",
      queued: "等待上传", uploading: "上传中", paused: "已暂停", retrying: "分片重试", completing: "正在完成", complete: "上传完成", failed: "上传失败", cancelled: "已取消",
      pause: "暂停", resume: "继续", cancel: "取消", reselect: "重新选择同一文件", speed: "{done} / {total} · {speed}/s · 约 {eta}",
      normalHelp: "选择后先留在输入区，点击发送才上传。单文件不超过 {max}，24 小时额度剩余 {remaining}。", adminHelp: "选择后先留在输入区，点击发送才上传；大文件按有限并发稳定上传。",
      fileTooLarge: "普通账号不能上传超过 {max} 的文件。", sessionExpired: "上传任务已失效，请重新选择文件。", fileMismatch: "所选文件与待恢复任务不一致。",
      unsafeNotice: "文件未做病毒或恶意软件扫描，请只打开或下载可信来源的文件。", textSent: "加密文字已发送。", attachmentsReady: "已选择 {count} 个附件，点击“发送”后开始上传。", attachmentsQueued: "{count} 个附件已开始上传。", composerSent: "加密文字已发送，{count} 个附件已开始上传。", textSentAttachmentsPending: "加密文字已发送，但文件上传暂不可用；附件仍保留在输入区。", removeAttachment: "移除附件", deleted: "内容已删除。", genericError: "操作失败，请稍后重试。",
      poolGreen: "正常", poolYellow: "接近阈值，已降低上传压力", poolRed: "已暂停普通用户新增文件", restoreHint: "刷新后需重新选择同一文件继续。",
      feedLoaded: "已加载 {count} 条互传内容。", feedAdded: "新增 {count} 条互传内容。", taskCompleted: "{name} 上传完成。", taskFailed: "{name} 上传失败，可重试。", taskCancelled: "{name} 已取消。"
    },
    en: {
      back: "Back to Tools", title: "Quick Transfer", retention: "Items expire 24 hours after publishing completes.",
      loginTitle: "Sign in to use Quick Transfer", loginBody: "After signing in, you will return here. Signed-in accounts using the same room passphrase enter the same temporary room.", loginAction: "Sign in and continue", loginBack: "Back to tool list",
      roomPassword: "Room passphrase", roomPlaceholder: "At least 6 characters; share it with another signed-in person", generate: "Generate", copy: "Copy",
      securityNote: "The plaintext passphrase is not sent to the server; text is encrypted in the browser with AES-GCM. Files are not encrypted with the passphrase—they are protected by HTTPS in transit, private R2 storage, and server-side authorization, and are not virus-scanned. Do not share credentials or untrusted files.", enter: "Enter room",
      roomActive: "Temporary room connected", refresh: "Refresh", leave: "Leave room", textLabel: "Encrypted text", textPlaceholder: "Send encrypted text…", send: "Send",
      dropTitle: "Add photos or files", dropRelease: "Drop to add pending attachments", choosePhoto: "Choose photos", chooseFile: "Choose files", tasks: "Upload tasks", online: "Online", offline: "Offline", loading: "Connecting to Quick Transfer…",
      loginNeeded: "Sign in before using Quick Transfer.", r2Missing: "R2 is not bound yet. Text rooms remain visible, but file uploads are unavailable.",
      generated: "Random passphrase generated. Copy it to the other signed-in person.", copied: "Room passphrase copied.", copyFailed: "Clipboard access failed; copy it manually.",
      shortPassword: "The room passphrase must be at least 6 characters.", joined: "Temporary room joined.", joinFailed: "Unable to enter the room.",
      normalMode: "Standard account · {max} per file · {remaining} remaining in the rolling 24-hour quota", adminMode: "Admin large-file mode · multipart · standard quotas do not apply",
      pool: "Standard-user free pool: {status}", empty: "Nothing is here yet. Send encrypted text or choose a file.", expires: "{time} left", download: "Download", delete: "Delete", copyText: "Copy text", textCopied: "Text copied.",
      decrypting: "Decrypting text…", decryptFailed: "This text cannot be decrypted with the current passphrase.", unknownUploader: "Signed-in user",
      queued: "Queued", uploading: "Uploading", paused: "Paused", retrying: "Retrying part", completing: "Completing", complete: "Upload complete", failed: "Upload failed", cancelled: "Cancelled",
      pause: "Pause", resume: "Resume", cancel: "Cancel", reselect: "Select the same file", speed: "{done} / {total} · {speed}/s · about {eta}",
      normalHelp: "Selections stay in the composer until Send is pressed. Up to {max} per file, with {remaining} left in the rolling 24-hour quota.", adminHelp: "Selections stay in the composer until Send is pressed; bounded concurrency keeps large uploads stable.",
      fileTooLarge: "Standard accounts cannot upload files over {max}.", sessionExpired: "This upload session expired. Select the file again to restart.", fileMismatch: "The selected file does not match the resumable task.",
      unsafeNotice: "Files are not scanned for viruses or malware. Open or download only files from people you trust.", textSent: "Encrypted text sent.", attachmentsReady: "{count} attachment(s) selected. Press Send to start uploading.", attachmentsQueued: "{count} attachment(s) started uploading.", composerSent: "Encrypted text sent; {count} attachment(s) started uploading.", textSentAttachmentsPending: "Encrypted text sent, but file uploads are unavailable; attachments remain in the composer.", removeAttachment: "Remove attachment", deleted: "Item deleted.", genericError: "The operation failed. Try again later.",
      poolGreen: "Healthy", poolYellow: "Near the threshold; upload pressure is reduced", poolRed: "New standard-user files are paused", restoreHint: "After refresh, reselect the same file to continue.",
      feedLoaded: "Loaded {count} transfer item(s).", feedAdded: "{count} new transfer item(s).", taskCompleted: "{name} upload completed.", taskFailed: "{name} upload failed and can be retried.", taskCancelled: "{name} cancelled."
    },
    ja: {
      back: "ツールへ戻る", title: "一時転送", retention: "公開完了から24時間後に自動で失効します。",
      loginTitle: "ログインして一時転送を使用", loginBody: "ログイン後はここへ戻ります。同じ部屋の合言葉を使うログイン済みアカウントは、同じ一時ルームに入ります。", loginAction: "ログインして続行", loginBack: "ツール一覧へ戻る",
      roomPassword: "部屋の合言葉", roomPlaceholder: "6文字以上。相手のログインユーザーと共有", generate: "ランダム生成", copy: "コピー",
      securityNote: "平文の合言葉はサーバーへ送信されず、テキストはブラウザー内で AES-GCM 暗号化されます。ファイルは合言葉では暗号化されず、HTTPS 通信・非公開 R2 ストレージ・サーバー認可で保護されますが、ウイルス検査は行われません。認証情報や信頼できないファイルを送らないでください。", enter: "部屋に入る",
      roomActive: "一時部屋に接続済み", refresh: "更新", leave: "退出", textLabel: "暗号化テキスト", textPlaceholder: "暗号化テキストを送信…", send: "送信",
      dropTitle: "写真またはファイルを追加", dropRelease: "ここで放して送信待ちに追加", choosePhoto: "写真を選択", chooseFile: "ファイル選択", tasks: "アップロード", online: "オンライン", offline: "オフライン", loading: "一時転送に接続中…",
      loginNeeded: "先にログインしてください。", r2Missing: "R2 が未接続です。テキスト部屋は利用できますが、ファイル送信はまだ使えません。",
      generated: "ランダム合言葉を生成しました。相手にコピーしてください。", copied: "合言葉をコピーしました。", copyFailed: "クリップボードを利用できません。手動でコピーしてください。",
      shortPassword: "合言葉は6文字以上必要です。", joined: "一時部屋に入りました。", joinFailed: "部屋に入れませんでした。",
      normalMode: "一般アカウント · 1件 {max} まで · 直近24時間枠の残り {remaining}", adminMode: "管理者大容量モード · 分割送信 · 一般枠の対象外",
      pool: "一般ユーザー無料枠：{status}", empty: "まだ内容がありません。暗号化テキストまたはファイルを送ってください。", expires: "残り {time}", download: "ダウンロード", delete: "削除", copyText: "テキストをコピー", textCopied: "テキストをコピーしました。",
      decrypting: "テキストを復号中…", decryptFailed: "現在の合言葉では復号できません。", unknownUploader: "ログインユーザー",
      queued: "送信待ち", uploading: "送信中", paused: "一時停止", retrying: "分割を再試行", completing: "完了処理中", complete: "送信完了", failed: "送信失敗", cancelled: "キャンセル済み",
      pause: "一時停止", resume: "再開", cancel: "キャンセル", reselect: "同じファイルを再選択", speed: "{done} / {total} · {speed}/秒 · 約 {eta}",
      normalHelp: "選択後は入力欄に保持され、「送信」でアップロードします。1件 {max} まで、直近24時間の残りは {remaining} です。", adminHelp: "選択後は入力欄に保持され、「送信」でアップロードします。大容量送信も同時処理数を制限します。",
      fileTooLarge: "一般アカウントは {max} を超えるファイルを送れません。", sessionExpired: "アップロード期限が切れました。最初からやり直してください。", fileMismatch: "選択したファイルが再開対象と一致しません。",
      unsafeNotice: "ファイルのウイルス／マルウェア検査は行っていません。信頼できる相手のファイルだけを開くかダウンロードしてください。", textSent: "暗号化テキストを送信しました。", attachmentsReady: "{count} 件の添付を選択しました。「送信」でアップロードを開始します。", attachmentsQueued: "{count} 件の添付をアップロード中です。", composerSent: "暗号化テキストを送信し、{count} 件の添付をアップロード中です。", textSentAttachmentsPending: "暗号化テキストは送信しましたが、ファイル送信は利用できません。添付は入力欄に残しています。", removeAttachment: "添付を外す", deleted: "削除しました。", genericError: "処理に失敗しました。後でもう一度お試しください。",
      poolGreen: "正常", poolYellow: "しきい値に接近。負荷を抑制中", poolRed: "一般ユーザーの新規ファイルを停止中", restoreHint: "更新後は同じファイルを再選択すると続行できます。",
      feedLoaded: "転送内容を {count} 件読み込みました。", feedAdded: "新しい転送内容が {count} 件あります。", taskCompleted: "{name} の送信が完了しました。", taskFailed: "{name} の送信に失敗しました。再試行できます。", taskCancelled: "{name} をキャンセルしました。"
    }
  };

  const state = {
    initialized: false, routeActive: false, lang: "zh", open: false, config: null, roomKey: "", cryptoKey: null,
    items: [], itemData: new Map(), itemNodes: new Map(), syncCursor: "", initialSyncComplete: false,
    refreshPromise: null, refreshController: null, refreshContextKey: "", pollTimer: 0, lastActivity: Date.now(), tasks: new Map(), xhrByTask: new Map(),
    pendingFiles: new Map(), pendingTaskIds: [], activeTaskIds: new Set(), dragDepth: 0,
    roomGeneration: 0, composerSending: false, composerToken: null, composerRetry: null,
    eventController: null, listenerCount: 0, requestControllers: new Set(), delayJobs: new Map(),
    taskRenderFrame: 0, dirtyTaskIds: new Set(), liveTimer: 0, liveQueue: [], quotaSignature: "",
    resourceContentVisibility: null
  };
  const refs = {};

  function text(key, values = {}) {
    const localized = COPY[state.lang]?.[key] ?? COPY.zh[key];
    let value = typeof localized === "string" ? localized : "";
    Object.entries(values).forEach(([name, replacement]) => {
      value = value.replaceAll(`{${name}}`, String(replacement));
    });
    return value;
  }

  function cacheRefs() {
    ["app", "feedback", "live-summary", "login-gate", "room-entry", "room", "room-password", "quota-card", "room-mode", "feed", "text-input", "photo-input", "file-input", "pending-attachments", "send-button", "upload-zone", "upload-help", "task-list", "network-status", "drop-overlay"]
      .forEach((name) => { refs[toCamel(name)] = document.getElementById(`transfer-${name}`); });
    refs.resourceCategories = document.getElementById("resource-categories");
    refs.resourceList = document.getElementById("resource-list");
    refs.windowFrame = refs.app?.closest("#resources .xp-window") || refs.app;
    refs.dropSurface = refs.windowFrame;
  }

  function toCamel(value) {
    return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  }

  function captureRoomContext() {
    return Object.freeze({
      roomKey: state.roomKey,
      cryptoKey: state.cryptoKey,
      generation: state.roomGeneration
    });
  }

  function isRoomReferenceCurrent(reference) {
    return Boolean(reference?.roomKey
      && state.open
      && state.roomKey === reference.roomKey
      && state.roomGeneration === reference.generation
      && !refs.room?.hidden);
  }

  function isRoomContextCurrent(context) {
    return isRoomReferenceCurrent(context) && state.cryptoKey === context.cryptoKey;
  }

  function isTaskContextCurrent(task) {
    return isRoomReferenceCurrent({ roomKey: task?.roomKey, generation: task?.roomGeneration });
  }

  function activateRoomContext(roomKey, cryptoKey) {
    state.roomGeneration += 1;
    state.roomKey = roomKey;
    state.cryptoKey = cryptoKey;
  }

  function resetComposerBusyState(token = null) {
    if (token && state.composerToken !== token) return;
    state.composerToken = null;
    state.composerSending = false;
    refs.sendButton?.removeAttribute("aria-busy");
    if (refs.sendButton) refs.sendButton.disabled = false;
    syncUploadAvailability();
    refs.pendingAttachments?.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  }

  function invalidateRoomContext() {
    state.roomGeneration += 1;
    abortRefresh();
    clearTaskRenderFrame();
    clearLiveAnnouncements();
    state.composerToken = null;
    state.composerSending = false;
    state.composerRetry = null;
    state.quotaSignature = "";
    refs.sendButton?.removeAttribute("aria-busy");
    if (refs.sendButton) refs.sendButton.disabled = false;
    clearPendingFiles();
    cancelAndClearUploadTasks({ preserveResumable: true });
    state.roomKey = "";
    state.cryptoKey = null;
    resetItemSync();
    syncUploadAvailability();
  }

  function init(lang) {
    if (state.initialized || !document.getElementById("transfer-app")) return;
    state.initialized = true;
    cacheRefs();
    if (state.routeActive) bindEvents();
    setLanguage(lang || "zh");
    updateNetwork();
  }

  function listen(target, type, handler, options = {}) {
    if (!target?.addEventListener || !state.eventController) return;
    const normalized = typeof options === "boolean" ? { capture: options } : { ...options };
    target.addEventListener(type, handler, { ...normalized, signal: state.eventController.signal });
    state.listenerCount += 1;
  }

  function bindEvents() {
    if (state.eventController || !state.routeActive) return;
    state.eventController = new AbortController();
    state.listenerCount = 0;
    listen(document.getElementById("transfer-back-to-resources"), "click", close);
    listen(document.getElementById("transfer-login-button"), "click", openAccountFromTransfer);
    listen(document.querySelector("[data-transfer-login-back]"), "click", close);
    listen(document.getElementById("transfer-generate-password"), "click", generatePassword);
    listen(document.getElementById("transfer-copy-password"), "click", copyPassword);
    listen(document.getElementById("transfer-room-form"), "submit", joinRoom);
    listen(document.getElementById("transfer-leave-room"), "click", leaveRoom);
    listen(document.getElementById("transfer-refresh-button"), "click", () => refreshItems(true));
    listen(document.getElementById("transfer-text-form"), "submit", sendComposer);
    listen(refs.photoInput, "change", (event) => stageFiles(event.target.files));
    listen(refs.fileInput, "change", (event) => stageFiles(event.target.files));
    listen(refs.dropSurface, "dragenter", handleWindowDragEnter);
    listen(refs.dropSurface, "dragover", handleWindowDragOver);
    listen(refs.dropSurface, "dragleave", handleWindowDragLeave);
    listen(refs.dropSurface, "drop", handleWindowDrop);
    listen(document, "paste", (event) => { if (state.open && state.roomKey && event.clipboardData?.files?.length) stageFiles(event.clipboardData.files); });
    listen(document, "dragend", resetWindowDragState);
    listen(window, "blur", resetWindowDragState);
    ["pointerdown", "keydown"].forEach((name) => listen(document, name, () => { state.lastActivity = Date.now(); }, { passive: true }));
    listen(window, "online", updateNetwork);
    listen(window, "offline", updateNetwork);
    listen(document, "visibilitychange", handleVisibilityChange);
    listen(window, "lusu:accountchange", syncAccountState);
  }

  function unbindEvents() {
    state.eventController?.abort();
    state.eventController = null;
    state.listenerCount = 0;
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopPoll();
      abortRefresh();
      abortRequests();
      clearDelays();
      suspendUploadsForVisibility();
      return;
    }
    if (!state.routeActive || !state.open || !state.roomKey) return;
    resumeUploadsAfterVisibility();
    void refreshItems(false).finally(schedulePoll);
  }

  function suspendUploadsForVisibility() {
    state.tasks.forEach((task) => {
      if (!["queued", "uploading", "retrying", "completing"].includes(task.status)) return;
      task.visibilityPaused = true;
      task.paused = true;
      task.status = "paused";
      state.pendingTaskIds = state.pendingTaskIds.filter((localId) => localId !== task.localId);
      abortTaskTransport(task);
      updateTaskRow(task);
    });
  }

  function resumeUploadsAfterVisibility() {
    state.tasks.forEach((task) => {
      if (!task.visibilityPaused || !isTaskContextCurrent(task)) return;
      if (state.activeTaskIds.has(task.localId)) {
        task.resumeWhenIdle = true;
        return;
      }
      task.visibilityPaused = false;
      task.paused = false;
      enqueueTask(task);
    });
  }

  function isFileDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  function canAcceptFiles() {
    return Boolean(state.open && state.roomKey && !refs.room?.hidden && state.config?.r2Ready && !state.composerSending);
  }

  function handleWindowDragEnter(event) {
    if (!state.open || !isFileDrag(event)) return;
    event.preventDefault();
    if (!canAcceptFiles()) return;
    state.dragDepth += 1;
    refs.app?.classList.add("is-file-dragging");
    refs.uploadZone?.classList.add("is-dragging");
  }

  function handleWindowDragOver(event) {
    if (!state.open || !isFileDrag(event)) return;
    event.preventDefault();
    if (!canAcceptFiles()) return;
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    refs.app?.classList.add("is-file-dragging");
    refs.uploadZone?.classList.add("is-dragging");
  }

  function handleWindowDragLeave(event) {
    if (!state.open || (!state.dragDepth && !isFileDrag(event))) return;
    event.preventDefault();
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (!state.dragDepth) resetWindowDragState();
  }

  function handleWindowDrop(event) {
    if (!state.open || (!isFileDrag(event) && !event.dataTransfer?.files?.length)) return;
    event.preventDefault();
    const files = event.dataTransfer?.files;
    resetWindowDragState();
    if (files?.length) stageFiles(files);
  }

  function resetWindowDragState() {
    state.dragDepth = 0;
    refs.app?.classList.remove("is-file-dragging");
    refs.uploadZone?.classList.remove("is-dragging");
  }

  function syncUploadAvailability() {
    const available = Boolean(state.config?.r2Ready && !state.composerSending);
    if (refs.photoInput) refs.photoInput.disabled = !available;
    if (refs.fileInput) refs.fileInput.disabled = !available;
    refs.uploadZone?.classList.toggle("is-disabled", !available);
    [refs.photoInput, refs.fileInput].forEach((input) => {
      const picker = input?.closest(".transfer-file-picker");
      picker?.classList.toggle("is-disabled", !available);
      picker?.setAttribute("aria-disabled", String(!available));
    });
    if (!available) resetWindowDragState();
  }

  function openAccountFromTransfer(event) {
    event.stopPropagation();
    const trigger = event.currentTarget;
    if (typeof window.openAccountPopover === "function") {
      window.openAccountPopover({ returnFocus: trigger, mode: "login", context: "transfer" });
    } else {
      document.querySelector("[data-account-toggle]")?.click();
    }
  }

  async function syncAccountState(event) {
    if (!state.open) return;
    if (typeof window.closeAccountPopover === "function") {
      window.closeAccountPopover({ restoreFocus: false, motion: false });
    }
    await loadConfig();
    const target = event.detail?.signedIn && !refs.room?.hidden
      ? refs.textInput
      : event.detail?.signedIn && !refs.roomEntry?.hidden
        ? refs.roomPassword
        : document.getElementById("transfer-login-button");
    window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  }

  function requestFocusReveal(reason) {
    if (!state.open || document.documentElement.dataset.uiShell !== "mobile") return;
    window.LusuMobileShell?.requestFocusReveal?.(reason);
  }

  function focusTransferContext() {
    const target = !refs.loginGate?.hidden
      ? document.getElementById("transfer-login-button")
      : !refs.roomEntry?.hidden
        ? refs.roomPassword
        : !refs.room?.hidden
          ? refs.textInput
          : document.getElementById("transfer-back-to-resources");
    target?.focus({ preventScroll: true });
    requestFocusReveal("transfer:context-focus");
  }

  function setLanguage(lang) {
    state.lang = ["zh", "en", "ja"].includes(lang) ? lang : "zh";
    document.querySelectorAll("[data-transfer-copy]").forEach((node) => { node.textContent = text(node.dataset.transferCopy); });
    document.querySelectorAll("[data-transfer-placeholder]").forEach((node) => { node.setAttribute("placeholder", text(node.dataset.transferPlaceholder)); });
    updateNetwork();
    renderQuota();
    renderItems();
    renderPendingFiles();
    renderTasks();
  }

  function rememberResourceContentVisibility() {
    if (state.resourceContentVisibility) return;
    state.resourceContentVisibility = {
      categoriesHidden: refs.resourceCategories?.hidden ?? true,
      listHidden: refs.resourceList?.hidden ?? false
    };
  }

  function restoreResourceContentVisibility() {
    if (!state.resourceContentVisibility) return;
    if (refs.resourceCategories) refs.resourceCategories.hidden = state.resourceContentVisibility.categoriesHidden;
    if (refs.resourceList) refs.resourceList.hidden = state.resourceContentVisibility.listHidden;
    state.resourceContentVisibility = null;
  }

  function syncTransferWindowMode() {
    const frame = refs.windowFrame;
    if (!frame) return;
    const open = Boolean(state.open && refs.app && !refs.app.hidden);
    const mode = !open
      ? "closed"
      : refs.loginGate && !refs.loginGate.hidden
        ? "login"
        : refs.room && !refs.room.hidden
          ? "room"
          : refs.roomEntry && !refs.roomEntry.hidden
            ? "room-entry"
            : "loading";
    frame.classList.toggle("is-transfer-open", open);
    frame.classList.toggle("is-transfer-login-mode", mode === "login");
    frame.classList.toggle("is-transfer-room-entry-mode", mode === "room-entry");
    frame.classList.toggle("is-transfer-room-mode", mode === "room");
  }

  async function open() {
    if (!state.routeActive) return;
    if (!state.initialized) init(document.documentElement.lang.slice(0, 2));
    rememberResourceContentVisibility();
    state.open = true;
    refs.resourceCategories.hidden = true;
    refs.resourceList.hidden = true;
    refs.app.hidden = false;
    syncTransferWindowMode();
    requestFocusReveal("transfer:open");
    setFeedback(text("loading"));
    await loadConfig();
    focusTransferContext();
  }

  function close(options = {}) {
    state.open = false;
    resetWindowDragState();
    invalidateRoomContext();
    refs.app.hidden = true;
    syncTransferWindowMode();
    restoreResourceContentVisibility();
    stopPoll();
    if (options.restoreFocus !== false) {
      document.querySelector("[data-quick-transfer-open]")?.focus();
    }
  }

  async function loadConfig(expectedRoom = null) {
    if (expectedRoom && !isRoomReferenceCurrent(expectedRoom)) return false;
    try {
      const config = await api("/api/transfer/config");
      if (expectedRoom && !isRoomReferenceCurrent(expectedRoom)) return false;
      state.config = config;
      refs.loginGate.hidden = true;
      refs.roomEntry.hidden = Boolean(state.roomKey);
      refs.room.hidden = !state.roomKey;
      syncTransferWindowMode();
      requestFocusReveal("transfer:entry-state");
      renderQuota();
      syncUploadAvailability();
      if (!state.config.r2Ready) setFeedback(text("r2Missing"), true);
      else setFeedback("");
      if (state.roomKey) {
        restoreTasks();
        await refreshItems(true, expectedRoom || captureRoomContext());
        schedulePoll();
        requestFocusReveal("transfer:room-restored");
      }
      return true;
    } catch (error) {
      if (expectedRoom && !isRoomReferenceCurrent(expectedRoom)) return false;
      if (error.status === 401) {
        stopPoll();
        invalidateRoomContext();
        state.config = null;
        syncUploadAvailability();
        refs.loginGate.hidden = false;
        refs.roomEntry.hidden = true;
        refs.room.hidden = true;
        syncTransferWindowMode();
        requestFocusReveal("transfer:login-state");
        setFeedback("");
      } else {
        setFeedback(error.message || text("genericError"), true);
      }
      return false;
    }
  }

  function generatePassword() {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    refs.roomPassword.value = base64url(bytes);
    refs.roomPassword.type = "text";
    setFeedback(text("generated"));
  }

  async function copyPassword() {
    if (!refs.roomPassword.value) generatePassword();
    try {
      await copyToClipboard(refs.roomPassword.value);
      setFeedback(text("copied"));
    } catch {
      refs.roomPassword.select();
      setFeedback(text("copyFailed"), true);
    }
  }

  async function copyToClipboard(value) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        /* Fall back for older mobile browsers and non-secure local previews. */
      }
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.readOnly = true;
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    document.body.append(input);
    input.select();
    const copied = document.execCommand?.("copy");
    input.remove();
    if (!copied) throw new Error("Clipboard unavailable");
  }

  async function joinRoom(event) {
    event.preventDefault();
    const entryGeneration = state.roomGeneration;
    const password = refs.roomPassword.value.normalize("NFKC").trim();
    if (Array.from(password).length < 6) return setFeedback(text("shortPassword"), true);
    try {
      const derived = await deriveRoom(password);
      await api("/api/transfer/room/join", { method: "POST", json: { roomKey: derived.roomKey } });
      if (!state.open || state.roomGeneration !== entryGeneration) return;
      activateRoomContext(derived.roomKey, derived.cryptoKey);
      refs.roomPassword.value = "";
      refs.roomPassword.type = "password";
      refs.roomEntry.hidden = true;
      refs.room.hidden = false;
      syncTransferWindowMode();
      requestFocusReveal("transfer:room-entered");
      syncUploadAvailability();
      updateRoomMode();
      restoreTasks();
      await refreshItems(true, captureRoomContext());
      schedulePoll();
      setFeedback(text("joined"));
      requestFocusReveal("transfer:room-ready");
    } catch (error) {
      setFeedback(error.message || text("joinFailed"), true);
    }
  }

  function leaveRoom() {
    stopPoll();
    resetWindowDragState();
    invalidateRoomContext();
    refs.room.hidden = true;
    refs.roomEntry.hidden = false;
    syncTransferWindowMode();
    requestFocusReveal("transfer:room-left");
    renderItems();
    setFeedback("");
  }

  async function deriveRoom(password) {
    const encoded = new TextEncoder().encode(`${ROOM_NAMESPACE}\0${password}`);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    const cryptoKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: TEXT_SALT, iterations: 180000 }, material,
      { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
    return { roomKey: `transfer_${base64url(digest)}`, cryptoKey };
  }

  async function encryptText(value, cryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(value));
    return `${base64url(iv)}.${base64url(new Uint8Array(cipher))}`;
  }

  async function decryptText(value) {
    const [iv, cipher] = String(value).split(".");
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(iv) }, state.cryptoKey, fromBase64url(cipher));
    return new TextDecoder().decode(clear);
  }

  async function sendComposer(event) {
    event.preventDefault();
    const context = captureRoomContext();
    const draft = refs.textInput.value;
    const value = draft.trim();
    const pending = [...state.pendingFiles.values()];
    if ((!value && !pending.length) || !isRoomContextCurrent(context) || state.composerSending) return;
    if (value && !context.cryptoKey) return;
    if (pending.length && !state.config?.r2Ready) {
      setFeedback(text("r2Missing"), true);
      syncUploadAvailability();
      return;
    }
    const composerToken = Object.freeze({ generation: context.generation });
    const idempotencyKey = state.composerRetry?.generation === context.generation && state.composerRetry.draft === draft
      ? state.composerRetry.key
      : crypto.randomUUID();
    state.composerRetry = { generation: context.generation, draft, key: idempotencyKey };
    state.composerToken = composerToken;
    state.composerSending = true;
    refs.sendButton?.setAttribute("aria-busy", "true");
    if (refs.sendButton) refs.sendButton.disabled = true;
    syncUploadAvailability();
    refs.pendingAttachments?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    let queuedCount = 0;
    try {
      if (value) {
        const encryptedContent = await encryptText(value, context.cryptoKey);
        if (!isRoomContextCurrent(context)) return;
        await api("/api/transfer/text", { method: "POST", json: { roomKey: context.roomKey, encryptedContent, idempotencyKey } });
        if (!isRoomContextCurrent(context)) return;
        if (refs.textInput.value === draft) refs.textInput.value = "";
        await refreshItems(true, context);
        if (!isRoomContextCurrent(context)) return;
      }
      if (pending.length) {
        if (!isRoomContextCurrent(context)) return;
        if (!state.config?.r2Ready) {
          setFeedback(text(value ? "textSentAttachmentsPending" : "r2Missing"), true);
          return;
        }
        const files = takePendingFiles(pending.map((entry) => entry.localId));
        queueFiles(files, context);
        queuedCount = files.length;
      }
      if (!isRoomContextCurrent(context)) return;
      state.composerRetry = null;
      setFeedback(queuedCount
        ? text(value ? "composerSent" : "attachmentsQueued", { count: queuedCount })
        : text("textSent"));
    } catch (error) {
      if (isRoomContextCurrent(context)) setFeedback(error.message || text("genericError"), true);
    } finally {
      resetComposerBusyState(composerToken);
    }
  }

  function refreshItems(showErrors, requestedRoom = captureRoomContext()) {
    if (!isRoomReferenceCurrent(requestedRoom)) return Promise.resolve();
    const refreshContextKey = `${requestedRoom.generation}:${requestedRoom.roomKey}`;
    if (state.refreshPromise && state.refreshContextKey === refreshContextKey) return state.refreshPromise;
    if (state.refreshPromise) abortRefresh();
    const controller = new AbortController();
    state.refreshController = controller;
    state.refreshContextKey = refreshContextKey;
    const refreshPromise = performItemRefresh(requestedRoom, controller.signal)
      .catch(async (error) => {
        if (error.name === "AbortError" || !isRoomReferenceCurrent(requestedRoom)) return;
        if (showErrors) setFeedback(error.message || text("genericError"), true);
        if (error.status === 401) await loadConfig();
      })
      .finally(() => {
        if (state.refreshPromise !== refreshPromise) return;
        state.refreshController = null;
        state.refreshPromise = null;
        state.refreshContextKey = "";
      });
    state.refreshPromise = refreshPromise;
    return refreshPromise;
  }

  async function performItemRefresh(requestedRoom, signal) {
    const initial = !state.initialSyncComplete;
    let cursor = initial ? "" : state.syncCursor;
    let added = 0;
    for (let page = 0; page < 100; page += 1) {
      const payload = await api(`/api/transfer/room/items?room=${encodeURIComponent(requestedRoom.roomKey)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal });
      if (!isRoomReferenceCurrent(requestedRoom)) return;
      if (payload.resetRequired) {
        resetItemSync();
        return performItemRefresh(requestedRoom, signal);
      }
      (payload.items || []).forEach((item) => {
        if (!state.itemData.has(item.id)) added += 1;
        state.itemData.set(item.id, item);
      });
      cursor = payload.nextCursor || cursor;
      if (!payload.hasMore) break;
    }
    if (!isRoomReferenceCurrent(requestedRoom)) return;
    state.syncCursor = cursor;
    state.initialSyncComplete = true;
    state.items = [...state.itemData.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    renderItems({ initial, added });
    if (!state.items.length) setFeedback("");
  }

  function abortRefresh() {
    const controller = state.refreshController;
    state.refreshController = null;
    state.refreshPromise = null;
    state.refreshContextKey = "";
    controller?.abort();
  }

  function resetItemSync() {
    state.items = [];
    state.itemData.clear();
    state.itemNodes.forEach((node) => node.remove());
    state.itemNodes.clear();
    state.syncCursor = "";
    state.initialSyncComplete = false;
    refs.feed?.querySelector(".transfer-empty")?.remove();
  }

  function renderItems(options = {}) {
    if (!refs.feed || refs.room?.hidden) return;
    const nearBottom = refs.feed.scrollHeight - refs.feed.clientHeight - refs.feed.scrollTop <= 48;
    const activeIds = new Set(state.items.map((item) => item.id));
    state.itemNodes.forEach((node, id) => {
      if (!activeIds.has(id) || options.force) {
        node.remove();
        state.itemNodes.delete(id);
      }
    });
    const empty = refs.feed.querySelector(".transfer-empty");
    if (!state.items.length) {
      if (!empty) {
        const emptyNode = document.createElement("div");
        emptyNode.className = "transfer-empty";
        const copy = document.createElement("p");
        copy.textContent = text("empty");
        emptyNode.append(iconNode("app"), copy);
        refs.feed.append(emptyNode);
      } else {
        empty.querySelector("p").textContent = text("empty");
      }
      requestFocusReveal("transfer:items");
      if (options.initial) notifyLive(text("feedLoaded", { count: 0 }));
      return;
    }
    empty?.remove();
    state.items.forEach((item) => {
      let node = state.itemNodes.get(item.id);
      if (!node) {
        node = itemNode(item);
        node.dataset.transferItemId = item.id;
        state.itemNodes.set(item.id, node);
      }
      updateItemNode(node, item);
      refs.feed.append(node);
    });
    if (nearBottom || options.initial) refs.feed.scrollTop = refs.feed.scrollHeight;
    if (options.initial) notifyLive(text("feedLoaded", { count: state.items.length }));
    else if (options.added) notifyLive(text("feedAdded", { count: options.added }));
    requestFocusReveal("transfer:items");
  }

  function itemNode(item) {
    const article = document.createElement("article");
    article.className = `transfer-item transfer-item-${item.type}`;
    const header = document.createElement("header");
    header.append(iconNode(iconName(item.type)));
    const who = document.createElement("strong");
    who.className = "transfer-uploader";
    const time = document.createElement("time");
    time.className = "transfer-created-at";
    const expires = document.createElement("span");
    expires.className = "transfer-expiry";
    expires.textContent = text("expires", { time: remaining(item.expiresAt) });
    header.append(who, time, expires);
    const body = document.createElement("div");
    body.className = "transfer-item-body";
    if (item.type === "text") {
      const paragraph = document.createElement("p");
      paragraph.className = "transfer-text-content";
      paragraph.dataset.transferTextState = "decrypting";
      paragraph.textContent = text("decrypting");
      const actions = document.createElement("div");
      actions.className = "transfer-item-actions transfer-text-actions";
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "xp-button transfer-copy-text-button";
      copyButton.disabled = true;
      actions.append(copyButton);
      body.append(paragraph, actions);
      decryptText(item.encryptedContent).then((value) => {
        paragraph.dataset.transferTextState = "ready";
        paragraph.textContent = value;
        copyButton.disabled = false;
        requestFocusReveal("transfer:item-decrypted");
        copyButton.addEventListener("click", async () => {
          try {
            await copyToClipboard(value);
            setFeedback(text("textCopied"));
          } catch {
            setFeedback(text("copyFailed"), true);
          }
        });
      }).catch(() => {
        paragraph.dataset.transferTextState = "failed";
        paragraph.textContent = text("decryptFailed");
        article.classList.add("is-error");
        requestFocusReveal("transfer:item-error");
      });
    } else {
      if (item.type === "image") {
        const preview = document.createElement("div");
        preview.className = "transfer-media-preview transfer-image-preview";
        const image = document.createElement("img");
        image.src = item.fileUrl;
        image.alt = item.filename;
        image.loading = "lazy";
        image.decoding = "async";
        preview.append(image);
        body.append(preview);
      } else if (item.type === "video") {
        const video = document.createElement("video");
        video.src = item.fileUrl;
        video.controls = true;
        video.preload = "metadata";
        video.playsInline = true;
        body.append(video);
      } else if (item.type === "audio") {
        const audio = document.createElement("audio");
        audio.src = item.fileUrl;
        audio.controls = true;
        audio.preload = "metadata";
        body.append(audio);
      }
      const fileCard = document.createElement("div");
      fileCard.className = "transfer-file-card";
      fileCard.append(iconNode(iconName(item.type)));
      const fileDetails = document.createElement("div");
      const filename = document.createElement("strong");
      filename.className = "transfer-filename";
      const meta = document.createElement("span");
      meta.className = "transfer-file-meta";
      meta.textContent = `${formatBytes(item.sizeBytes)} · ${item.mimeType || "application/octet-stream"}`;
      fileDetails.append(filename, meta);
      fileCard.append(fileDetails);
      const warning = document.createElement("small");
      warning.className = "transfer-unsafe-notice";
      const actions = document.createElement("div");
      actions.className = "transfer-item-actions";
      const download = document.createElement("a");
      download.className = "xp-button transfer-download-button";
      actions.append(download);
      body.append(fileCard, warning, actions);
    }
    if (item.canDelete) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "transfer-delete-button";
      remove.append(iconNode("delete"));
      remove.addEventListener("click", () => deleteItem(item.id));
      header.append(remove);
    }
    article.append(header, body);
    updateItemNode(article, item);
    return article;
  }

  function updateItemNode(article, item) {
    const uploader = article.querySelector(".transfer-uploader");
    if (uploader) {
      uploader.dataset.transferUploaderFallback = String(!item.uploader);
      uploader.textContent = item.uploader || text("unknownUploader");
    }
    const createdAt = article.querySelector(".transfer-created-at");
    if (createdAt) {
      createdAt.dateTime = item.createdAt;
      createdAt.textContent = new Intl.DateTimeFormat(state.lang, {
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
      }).format(new Date(item.createdAt));
    }
    const expiry = article.querySelector(".transfer-expiry");
    if (expiry) expiry.textContent = text("expires", { time: remaining(item.expiresAt) });

    const textContent = article.querySelector(".transfer-text-content");
    if (textContent?.dataset.transferTextState === "decrypting") textContent.textContent = text("decrypting");
    if (textContent?.dataset.transferTextState === "failed") textContent.textContent = text("decryptFailed");
    const copyButton = article.querySelector(".transfer-copy-text-button");
    if (copyButton) {
      copyButton.replaceChildren(iconNode("copy"), document.createTextNode(text("copyText")));
      copyButton.setAttribute("aria-label", text("copyText"));
      copyButton.title = text("copyText");
    }

    const filename = article.querySelector(".transfer-filename");
    if (filename) filename.textContent = item.filename || "";
    const fileMeta = article.querySelector(".transfer-file-meta");
    if (fileMeta) fileMeta.textContent = `${formatBytes(item.sizeBytes)} · ${item.mimeType || "application/octet-stream"}`;
    const warning = article.querySelector(".transfer-unsafe-notice");
    if (warning) warning.textContent = text("unsafeNotice");
    const download = article.querySelector(".transfer-download-button");
    if (download) {
      download.href = `${item.fileUrl}&download=1`;
      download.download = item.filename || "";
      download.replaceChildren(iconNode("download"), document.createTextNode(text("download")));
      download.setAttribute("aria-label", `${text("download")}: ${item.filename || ""}`);
      download.title = text("download");
    }
    const media = article.querySelector("img, video, audio");
    if (media?.tagName === "IMG") media.alt = item.filename || "";
    else if (media) media.setAttribute("aria-label", item.filename || "");
    const remove = article.querySelector(".transfer-delete-button");
    if (remove) {
      remove.setAttribute("aria-label", text("delete"));
      remove.title = text("delete");
    }
  }

  async function deleteItem(id) {
    try {
      await api(`/api/transfer/item/${encodeURIComponent(id)}?room=${encodeURIComponent(state.roomKey)}`, { method: "DELETE" });
      await refreshItems(true);
      setFeedback(text("deleted"));
    } catch (error) {
      setFeedback(error.message || text("genericError"), true);
    }
  }

  function stageFiles(fileList) {
    const files = Array.from(fileList || []);
    resetFilePickers();
    if (!files.length || !state.open || !state.roomKey || refs.room?.hidden || state.composerSending) return;
    if (!state.config?.r2Ready) {
      setFeedback(text("r2Missing"), true);
      syncUploadAvailability();
      return;
    }
    let added = 0;
    files.forEach((file) => {
      if (!state.config?.user?.isAdmin && file.size > state.config.normal.maxFileBytes) {
        setFeedback(text("fileTooLarge", { max: formatBytes(state.config.normal.maxFileBytes) }), true);
        return;
      }
      const duplicate = [...state.pendingFiles.values()].some((pending) => sameFile(pending.file, file));
      if (duplicate) return;
      const localId = crypto.randomUUID();
      state.pendingFiles.set(localId, {
        localId,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
      });
      added += 1;
    });
    renderPendingFiles();
    if (added) setFeedback(text("attachmentsReady", { count: state.pendingFiles.size }));
  }

  function renderPendingFiles() {
    if (!refs.pendingAttachments) return;
    refs.pendingAttachments.replaceChildren();
    refs.pendingAttachments.hidden = !state.pendingFiles.size;
    state.pendingFiles.forEach((pending) => {
      const card = document.createElement("article");
      card.className = "transfer-pending-card";
      card.setAttribute("role", "listitem");
      if (pending.previewUrl) {
        const image = document.createElement("img");
        image.src = pending.previewUrl;
        image.alt = "";
        card.classList.add("is-image");
        card.append(image);
      } else {
        card.append(iconNode(iconName(pending.file.type.split("/")[0] || "file")));
      }
      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = pending.file.name;
      const meta = document.createElement("small");
      meta.textContent = formatBytes(pending.file.size);
      details.append(name, meta);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "transfer-pending-remove";
      remove.disabled = state.composerSending;
      remove.setAttribute("aria-label", `${text("removeAttachment")}：${pending.file.name}`);
      remove.title = text("removeAttachment");
      remove.append(iconNode("cancel"));
      remove.addEventListener("click", () => removePendingFile(pending.localId));
      card.append(details, remove);
      refs.pendingAttachments.append(card);
    });
    requestFocusReveal("transfer:attachments");
  }

  function removePendingFile(localId) {
    const pending = state.pendingFiles.get(localId);
    if (!pending) return;
    if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    state.pendingFiles.delete(localId);
    renderPendingFiles();
  }

  function clearPendingFiles() {
    state.pendingFiles.forEach((pending) => {
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    });
    state.pendingFiles.clear();
    resetFilePickers();
    renderPendingFiles();
  }

  function takePendingFiles(localIds = [...state.pendingFiles.keys()]) {
    const files = [];
    localIds.forEach((localId) => {
      const pending = state.pendingFiles.get(localId);
      if (!pending) return;
      files.push(pending.file);
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      state.pendingFiles.delete(localId);
    });
    resetFilePickers();
    renderPendingFiles();
    return files;
  }

  function resetFilePickers() {
    if (refs.photoInput) refs.photoInput.value = "";
    if (refs.fileInput) refs.fileInput.value = "";
  }

  function sameFile(left, right) {
    return left.name === right.name
      && left.size === right.size
      && left.lastModified === right.lastModified
      && left.type === right.type;
  }

  function queueFiles(fileList, context = captureRoomContext()) {
    const files = Array.from(fileList || []);
    if (!files.length || !isRoomContextCurrent(context)) return;
    if (!state.config?.r2Ready) {
      setFeedback(text("r2Missing"), true);
      syncUploadAvailability();
      return;
    }
    files.forEach((file) => {
      if (!state.config?.user?.isAdmin && file.size > state.config.normal.maxFileBytes) {
        setFeedback(text("fileTooLarge", { max: formatBytes(state.config.normal.maxFileBytes) }), true);
        return;
      }
      const task = {
        localId: crypto.randomUUID(), file, filename: file.name, size: file.size, lastModified: file.lastModified,
        idempotencyKey: crypto.randomUUID(),
        roomKey: context.roomKey, roomGeneration: context.generation,
        uploaded: 0, status: "queued", startedAt: Date.now(), speed: 0, paused: false, controller: null, controllers: new Set(),
        multipart: Boolean(state.config.user.isAdmin && file.size > state.config.normal.maxFileBytes), parts: []
      };
      state.tasks.set(task.localId, task);
      enqueueTask(task);
    });
  }

  function enqueueTask(task) {
    if (state.activeTaskIds.has(task.localId) || state.pendingTaskIds.includes(task.localId)) return;
    if (!isTaskContextCurrent(task)) {
      task.status = "cancelled";
      return;
    }
    if (!state.config?.r2Ready) {
      task.status = "failed";
      task.error = text("r2Missing");
      renderTasks();
      setFeedback(task.error, true);
      return;
    }
    task.paused = false;
    task.status = "queued";
    task.error = "";
    state.pendingTaskIds.push(task.localId);
    renderTasks();
    pumpTaskQueue();
  }

  function pumpTaskQueue() {
    if (!state.config?.r2Ready) {
      failPendingTasksForUnavailableStorage();
      return;
    }
    const isMobile = document.documentElement.dataset.uiShell === "mobile";
    const maximumActiveTasks = state.config?.user?.isAdmin ? (isMobile ? 1 : 2) : 1;
    while (state.activeTaskIds.size < maximumActiveTasks && state.pendingTaskIds.length) {
      const localId = state.pendingTaskIds.shift();
      const task = state.tasks.get(localId);
      if (!task || ["cancelled", "complete", "paused"].includes(task.status)) continue;
      if (!isTaskContextCurrent(task)) {
        task.status = "cancelled";
        continue;
      }
      state.activeTaskIds.add(localId);
      task.status = "uploading";
      task.startedAt = Date.now();
      renderTasks();
      runTask(task)
        .catch((error) => failTask(task, error))
        .finally(() => {
          state.activeTaskIds.delete(localId);
          if (task.resumeWhenIdle && !document.hidden && isTaskContextCurrent(task)) {
            task.resumeWhenIdle = false;
            task.visibilityPaused = false;
            task.paused = false;
            enqueueTask(task);
          }
          pumpTaskQueue();
        });
    }
  }

  function failPendingTasksForUnavailableStorage() {
    const pending = state.pendingTaskIds.splice(0);
    pending.forEach((localId) => {
      const task = state.tasks.get(localId);
      if (!task || ["complete", "cancelled"].includes(task.status)) return;
      task.status = "failed";
      task.error = text("r2Missing");
    });
    if (pending.length) renderTasks();
  }

  async function runTask(task) {
    if (!isTaskContextCurrent(task)) {
      task.status = "cancelled";
      return;
    }
    if (task.multipart) return runMultipart(task);
    return runSimple(task);
  }

  async function runSimple(task) {
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        state.xhrByTask.set(task.localId, xhr);
        xhr.open("POST", `/api/transfer/upload/simple?room=${encodeURIComponent(task.roomKey)}&filename=${encodeURIComponent(task.filename)}&mime=${encodeURIComponent(task.file.type || "application/octet-stream")}&size=${task.size}`);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Content-Type", task.file.type || "application/octet-stream");
        xhr.setRequestHeader("Idempotency-Key", task.idempotencyKey);
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || !isTaskContextCurrent(task)) return;
          task.uploaded = event.loaded;
          updateTaskSpeed(task);
          scheduleTaskProgressRender(task);
        };
        xhr.onerror = () => reject(new Error(text("genericError")));
        xhr.onabort = () => reject(Object.assign(new Error(text("cancelled")), { cancelled: true }));
        xhr.onload = () => {
          const payload = parseJson(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
          else reject(Object.assign(new Error(payload.error || text("genericError")), { status: xhr.status, code: payload.code || "" }));
        };
        xhr.send(task.file);
      });
    } finally {
      state.xhrByTask.delete(task.localId);
    }
    if (!isTaskContextCurrent(task) || task.status === "cancelled") return;
    task.uploaded = task.size;
    task.status = "complete";
    renderTasks();
    await loadConfig(task);
  }

  async function runMultipart(task) {
    if (!task.sessionId) {
      const initialized = await api("/api/transfer/upload/init", {
        method: "POST",
        json: { roomKey: task.roomKey, filename: task.filename, mimeType: task.file.type || "application/octet-stream", sizeBytes: task.size, idempotencyKey: task.idempotencyKey }
      });
      if (!isTaskContextCurrent(task)) {
        if (initialized.sessionId) void abortMultipartSession(task.roomKey, initialized.sessionId);
        return;
      }
      Object.assign(task, initialized);
      task.parts = [];
      saveTasks();
    } else {
      const status = await api(`/api/transfer/upload/status?session=${encodeURIComponent(task.sessionId)}&room=${encodeURIComponent(task.roomKey)}`);
      if (!isTaskContextCurrent(task)) return;
      task.parts = status.parts || [];
      task.uploaded = task.parts.reduce((sum, part) => sum + part.sizeBytes, 0);
    }
    const completeParts = new Set(task.parts.map((part) => part.partNumber));
    const pending = Array.from({ length: task.expectedParts }, (_, index) => index + 1).filter((part) => !completeParts.has(part));
    const concurrency = document.documentElement.dataset.uiShell === "mobile" ? 2 : 4;
    const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
      while (pending.length) {
        if (task.paused || task.status === "cancelled" || !isTaskContextCurrent(task)) return;
        const partNumber = pending.shift();
        await uploadPartWithRetry(task, partNumber);
      }
    });
    await Promise.all(workers);
    if (task.paused || task.status === "cancelled" || !isTaskContextCurrent(task)) return;
    task.status = "completing";
    renderTasks();
    await api("/api/transfer/upload/complete", { method: "POST", json: { roomKey: task.roomKey, sessionId: task.sessionId } });
    if (!isTaskContextCurrent(task)) return;
    task.uploaded = task.size;
    task.status = "complete";
    removeSavedTask(task.localId);
    renderTasks();
    await refreshItems(true, task);
  }

  async function uploadPartWithRetry(task, partNumber) {
    const start = (partNumber - 1) * task.partSizeBytes;
    const end = Math.min(task.size, start + task.partSizeBytes);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (task.paused || task.status === "cancelled" || !isTaskContextCurrent(task)) return;
      const controller = new AbortController();
      task.controller = controller;
      task.controllers ||= new Set();
      task.controllers.add(controller);
      try {
        const response = await fetch(`/api/transfer/upload/part?session=${encodeURIComponent(task.sessionId)}&room=${encodeURIComponent(task.roomKey)}&part=${partNumber}&size=${end - start}`, {
          method: "PUT", body: task.file.slice(start, end), credentials: "same-origin", signal: controller.signal,
          headers: { "Content-Type": "application/octet-stream" }
        });
        const payload = await response.json().catch(() => ({}));
        if (!isTaskContextCurrent(task)) return;
        if (!response.ok) throw Object.assign(new Error(payload.error || `HTTP ${response.status}`), { status: response.status, code: payload.code || "" });
        task.parts.push(payload);
        task.uploaded += end - start;
        updateTaskSpeed(task);
        saveTasks();
        scheduleTaskProgressRender(task);
        return;
      } catch (error) {
        if (task.paused || task.status === "cancelled" || !isTaskContextCurrent(task) || error.name === "AbortError") return;
        if (error.code === "TRANSFER_R2_NOT_BOUND") throw error;
        if (attempt === 3) throw error;
        task.status = "retrying";
        renderTasks();
        await delay(800 * (2 ** attempt));
        task.status = "uploading";
      } finally {
        task.controllers.delete(controller);
        if (task.controller === controller) task.controller = null;
      }
    }
  }

  function pauseTask(task) {
    if (!isTaskContextCurrent(task)) return;
    task.paused = true;
    task.status = "paused";
    state.pendingTaskIds = state.pendingTaskIds.filter((localId) => localId !== task.localId);
    abortTaskTransport(task);
    saveTasks();
    renderTasks();
  }

  function resumeTask(task) {
    if (!isTaskContextCurrent(task)) return;
    if (!task.file) return selectResumeFile(task);
    enqueueTask(task);
  }

  async function cancelTask(task) {
    task.status = "cancelled";
    state.pendingTaskIds = state.pendingTaskIds.filter((localId) => localId !== task.localId);
    abortTaskTransport(task);
    if (isTaskContextCurrent(task)) renderTasks();
    if (task.sessionId) {
      await abortMultipartSession(task.roomKey, task.sessionId);
    }
    removeSavedTask(task.localId);
  }

  function abortTaskTransport(task) {
    task.controller?.abort();
    task.controllers?.forEach((controller) => controller.abort());
    task.controllers?.clear();
    state.xhrByTask.get(task.localId)?.abort();
    state.xhrByTask.delete(task.localId);
  }

  async function abortMultipartSession(roomKey, sessionId) {
    try {
      await api("/api/transfer/upload/abort", { method: "POST", json: { roomKey, sessionId } });
    } catch {
      /* The cleanup worker and R2 lifecycle remain the fallback. */
    }
  }

  function cancelAndClearUploadTasks(options = {}) {
    const tasks = [...state.tasks.values()];
    if (options.preserveResumable) saveTasks();
    state.pendingTaskIds = [];
    state.activeTaskIds.clear();
    tasks.forEach((task) => {
      if (!["complete", "cancelled"].includes(task.status)) {
        task.paused = true;
        task.status = "cancelled";
        abortTaskTransport(task);
        if (options.abortRemote && task.sessionId && task.roomKey) void abortMultipartSession(task.roomKey, task.sessionId);
      }
      if (!options.preserveResumable || !task.multipart || !task.sessionId) removeSavedTask(task.localId);
    });
    state.xhrByTask.clear();
    state.tasks.clear();
    renderTasks();
  }

  function selectResumeFile(task) {
    const input = document.createElement("input");
    input.type = "file";
    input.hidden = true;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (!isTaskContextCurrent(task)) return;
      if (!file || file.name !== task.filename || file.size !== task.size || file.lastModified !== task.lastModified) {
        return setFeedback(text("fileMismatch"), true);
      }
      task.file = file;
      resumeTask(task);
    }, { once: true });
    document.body.append(input);
    input.click();
  }

  function failTask(task, error) {
    if (error.cancelled || task.status === "cancelled" || !isTaskContextCurrent(task)) return;
    task.status = error.status === 410 ? "failed" : "failed";
    if (error.code === "TRANSFER_R2_NOT_BOUND") {
      task.error = text("r2Missing");
      if (state.config) state.config.r2Ready = false;
      syncUploadAvailability();
    } else {
      task.error = error.status === 410 ? text("sessionExpired") : error.message || text("genericError");
    }
    renderTasks();
    setFeedback(task.error, true);
  }

  function renderTasks() {
    if (!refs.taskList) return;
    const tasks = [...state.tasks.values()]
      .filter((task) => isTaskContextCurrent(task))
      .sort((a, b) => b.startedAt - a.startedAt);
    const activeIds = new Set(tasks.map((task) => task.localId));
    refs.taskList.querySelectorAll("[data-transfer-task-id]").forEach((row) => {
      if (!activeIds.has(row.dataset.transferTaskId)) row.remove();
    });
    tasks.forEach((task) => {
      if (!task.rowRefs?.row?.isConnected) task.rowRefs = createTaskRow(task);
      updateTaskRow(task);
      refs.taskList.append(task.rowRefs.row);
    });
    requestFocusReveal("transfer:tasks");
  }

  function createTaskRow(task) {
    const row = document.createElement("article");
    row.dataset.transferTaskId = task.localId;
    row.append(iconNode(iconName(task.file?.type?.split("/")[0] || "file")));
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    const status = document.createElement("span");
    const progress = document.createElement("progress");
    const stats = document.createElement("small");
    copy.append(name, status, progress, stats);
    const actions = document.createElement("div");
    actions.className = "transfer-task-actions";
    row.append(copy, actions);
    return { row, name, status, progress, stats, actions };
  }

  function updateTaskRow(task) {
    if (!task?.rowRefs?.row) return;
    const { row, name, status, progress, stats, actions } = task.rowRefs;
    row.className = `transfer-task is-${task.status}`;
    name.textContent = task.filename;
    status.textContent = task.error || text(task.status in COPY.zh ? task.status : "uploading");
    updateTaskProgress(task);
    actions.replaceChildren();
    if (["uploading", "retrying"].includes(task.status)) actions.append(taskButton("pause", "pause", () => pauseTask(task)));
    if (["paused", "failed"].includes(task.status)) actions.append(taskButton("resume", task.file ? "resume" : "reselect", () => resumeTask(task)));
    if (!["complete", "cancelled"].includes(task.status)) actions.append(taskButton("cancel", "cancel", () => cancelTask(task)));
    announceTaskState(task);
  }

  function scheduleTaskProgressRender(task) {
    if (!task || !isTaskContextCurrent(task)) return;
    state.dirtyTaskIds.add(task.localId);
    if (state.taskRenderFrame) return;
    state.taskRenderFrame = window.requestAnimationFrame(() => {
      state.taskRenderFrame = 0;
      const dirty = [...state.dirtyTaskIds];
      state.dirtyTaskIds.clear();
      dirty.forEach((localId) => {
        const current = state.tasks.get(localId);
        if (current && isTaskContextCurrent(current)) updateTaskProgress(current);
      });
    });
  }

  function clearTaskRenderFrame() {
    if (state.taskRenderFrame) window.cancelAnimationFrame(state.taskRenderFrame);
    state.taskRenderFrame = 0;
    state.dirtyTaskIds.clear();
  }

  function updateTaskProgress(task) {
    if (!task?.rowRefs) return;
    const { progress, stats } = task.rowRefs;
    progress.max = task.size || 1;
    progress.value = task.uploaded || 0;
    const remainingBytes = Math.max(0, task.size - task.uploaded);
    stats.textContent = text("speed", {
      done: formatBytes(task.uploaded), total: formatBytes(task.size), speed: formatBytes(task.speed || 0), eta: formatDuration(task.speed ? remainingBytes / task.speed : 0)
    });
  }

  function announceTaskState(task) {
    if (task.lastAnnouncedStatus === task.status) return;
    task.lastAnnouncedStatus = task.status;
    if (task.status === "complete") notifyLive(text("taskCompleted", { name: task.filename }));
    else if (task.status === "failed") notifyLive(text("taskFailed", { name: task.filename }));
    else if (task.status === "cancelled") notifyLive(text("taskCancelled", { name: task.filename }));
  }

  function taskButton(icon, label, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xp-button";
    button.append(iconNode(icon), document.createTextNode(text(label)));
    button.addEventListener("click", handler);
    return button;
  }

  function saveTasks() {
    const saved = [...state.tasks.values()].filter((task) => task.multipart && task.sessionId && !["complete", "cancelled"].includes(task.status)).map((task) => ({
      localId: task.localId, roomKey: task.roomKey, sessionId: task.sessionId, itemId: task.itemId, filename: task.filename,
      size: task.size, lastModified: task.lastModified, partSizeBytes: task.partSizeBytes, expectedParts: task.expectedParts,
      expiresAt: task.expiresAt, uploaded: task.uploaded, parts: task.parts, status: "paused", multipart: true, startedAt: task.startedAt,
      idempotencyKey: task.idempotencyKey
    }));
    try { sessionStorage.setItem(SESSION_TASKS_KEY, JSON.stringify(saved)); } catch { /* resumability becomes unavailable */ }
  }

  function restoreTasks() {
    let saved = [];
    try { saved = JSON.parse(sessionStorage.getItem(SESSION_TASKS_KEY) || "[]"); } catch { saved = []; }
    saved.filter((task) => task.roomKey === state.roomKey && new Date(task.expiresAt).getTime() > Date.now()).forEach((task) => {
      if (!state.tasks.has(task.localId)) state.tasks.set(task.localId, {
        ...task, idempotencyKey: task.idempotencyKey || crypto.randomUUID(), roomGeneration: state.roomGeneration,
        file: null, paused: true, status: "paused", speed: 0, controller: null, controllers: new Set()
      });
    });
    renderTasks();
  }

  function removeSavedTask(localId) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_TASKS_KEY) || "[]").filter((task) => task.localId !== localId);
      sessionStorage.setItem(SESSION_TASKS_KEY, JSON.stringify(saved));
    } catch { /* no-op */ }
  }

  function renderQuota() {
    if (!refs.quotaCard || !state.config) return;
    refs.quotaCard.replaceChildren();
    const icon = iconNode(state.config.user.isAdmin ? "upload" : "room");
    const copy = document.createElement("div");
    const mode = document.createElement("strong");
    mode.textContent = state.config.user.isAdmin
      ? text("adminMode")
      : text("normalMode", { max: formatBytes(state.config.normal.maxFileBytes), remaining: formatBytes(state.config.normal.remaining24hBytes) });
    const pool = document.createElement("span");
    pool.textContent = text("pool", { status: text(`pool${capitalize(state.config.normal.poolStatus)}`) });
    copy.append(mode, pool);
    refs.quotaCard.append(icon, copy);
    const quotaSignature = state.config.user.isAdmin
      ? "admin"
      : `${state.config.normal.remaining24hBytes}:${state.config.normal.poolStatus}`;
    if (quotaSignature !== state.quotaSignature) {
      state.quotaSignature = quotaSignature;
      notifyLive(`${mode.textContent} ${pool.textContent}`);
    }
    updateRoomMode();
    refs.uploadHelp.textContent = state.config.user.isAdmin
      ? text("adminHelp")
      : text("normalHelp", { max: formatBytes(state.config.normal.maxFileBytes), remaining: formatBytes(state.config.normal.remaining24hBytes) });
    requestFocusReveal("transfer:quota");
  }

  function updateRoomMode() {
    if (!refs.roomMode || !state.config) return;
    refs.roomMode.textContent = state.config.user.isAdmin
      ? text("adminMode")
      : text("normalMode", { max: formatBytes(state.config.normal.maxFileBytes), remaining: formatBytes(state.config.normal.remaining24hBytes) });
  }

  function schedulePoll() {
    stopPoll();
    if (!state.routeActive || !state.open || !state.roomKey || document.hidden) return;
    const room = captureRoomContext();
    const idle = Date.now() - state.lastActivity;
    if (idle > 30 * 60 * 1000) return;
    const delayMs = idle > 60000 ? 15000 : 5000;
    state.pollTimer = window.setTimeout(async () => {
      await refreshItems(false, room);
      if (isRoomContextCurrent(room)) schedulePoll();
    }, delayMs);
  }

  function stopPoll() {
    if (state.pollTimer) window.clearTimeout(state.pollTimer);
    state.pollTimer = 0;
  }

  function updateNetwork() {
    if (!refs.networkStatus) return;
    const online = navigator.onLine;
    refs.networkStatus.textContent = text(online ? "online" : "offline").toUpperCase();
    refs.networkStatus.classList.toggle("is-offline", !online);
  }

  function setFeedback(value, error = false) {
    if (!refs.feedback) return;
    refs.feedback.textContent = value;
    refs.feedback.classList.toggle("is-error", error);
    refs.feedback.hidden = !value;
    requestFocusReveal(error ? "transfer:feedback-error" : "transfer:feedback");
  }

  function notifyLive(message) {
    if (!message || !refs.liveSummary || !state.open) return;
    state.liveQueue.push(message);
    if (state.liveTimer) return;
    state.liveTimer = window.setTimeout(() => {
      state.liveTimer = 0;
      const summary = state.liveQueue.splice(0).join(" ");
      refs.liveSummary.textContent = "";
      if (state.open && refs.liveSummary) refs.liveSummary.textContent = summary;
    }, 120);
  }

  function clearLiveAnnouncements() {
    if (state.liveTimer) window.clearTimeout(state.liveTimer);
    state.liveTimer = 0;
    state.liveQueue = [];
    if (refs.liveSummary) refs.liveSummary.textContent = "";
  }

  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;
    if (options.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.json);
    }
    const controller = new AbortController();
    const relayAbort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener?.("abort", relayAbort, { once: true });
    state.requestControllers.add(controller);
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body,
        credentials: "same-origin",
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(payload.error || `HTTP ${response.status}`), { status: response.status, code: payload.code || "" });
      return payload;
    } finally {
      options.signal?.removeEventListener?.("abort", relayAbort);
      state.requestControllers.delete(controller);
    }
  }

  function iconNode(name) {
    const icon = document.createElement("span");
    icon.className = `transfer-icon transfer-icon-${name}`;
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function iconName(type) {
    return ({ text: "text", image: "image", video: "video", audio: "audio", pdf: "pdf", archive: "archive" })[type] || "file";
  }

  function updateTaskSpeed(task) {
    const elapsed = Math.max(0.5, (Date.now() - task.startedAt) / 1000);
    task.speed = task.uploaded / elapsed;
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KiB", "MiB", "GiB", "TiB"];
    let size = bytes / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && size >= 1024; index += 1) { size /= 1024; unit = units[index]; }
    return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${unit}`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "--";
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const minutes = Math.ceil(seconds / 60);
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  function remaining(expiresAt) {
    const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  function base64url(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64url(value) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  }

  function parseJson(value) { try { return JSON.parse(value || "{}"); } catch { return {}; } }
  function delay(ms) {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        state.delayJobs.delete(timer);
        resolve();
      }, ms);
      state.delayJobs.set(timer, resolve);
    });
  }
  function capitalize(value) { return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1); }

  function abortRequests() {
    state.requestControllers.forEach((controller) => controller.abort());
    state.requestControllers.clear();
  }

  function clearDelays() {
    state.delayJobs.forEach((resolve, timer) => {
      window.clearTimeout(timer);
      resolve();
    });
    state.delayJobs.clear();
  }

  function routeEnter() {
    state.routeActive = true;
    if (state.initialized) bindEvents();
  }

  function routeLeave() {
    state.routeActive = false;
    if (state.open) close({ restoreFocus: false });
    stopPoll();
    clearDelays();
    abortRequests();
    unbindEvents();
    resetWindowDragState();
  }

  function lifecycleSnapshot() {
    return {
      initialized: state.initialized,
      routeActive: state.routeActive,
      open: state.open,
      listeners: state.listenerCount,
      timers: (state.pollTimer ? 1 : 0) + (state.liveTimer ? 1 : 0) + state.delayJobs.size,
      requests: state.requestControllers.size,
      xhr: state.xhrByTask.size,
      frames: state.taskRenderFrame ? 1 : 0,
      previews: [...state.pendingFiles.values()].filter((pending) => pending.previewUrl).length,
      feedNodes: state.itemNodes.size,
      taskNodes: refs.taskList?.querySelectorAll("[data-transfer-task-id]").length || 0
    };
  }

  window.QuickTransfer = Object.freeze({
    init,
    open,
    close,
    setLanguage,
    routeEnter,
    routeLeave,
    lifecycleSnapshot
  });
})();
