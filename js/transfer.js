(function () {
  "use strict";

  const MIB = 1024 * 1024;
  const ROOM_NAMESPACE = "lusu575-quick-transfer-room-v1";
  const TEXT_SALT = new TextEncoder().encode("lusu575-quick-transfer-text-v1");
  const SESSION_TASKS_KEY = "lusu-transfer-upload-tasks-v1";
  const COPY = {
    zh: {
      back: "返回资源区", title: "临时互传", retention: "内容在发布完成 24 小时后自动失效。",
      loginTitle: "登录后使用临时互传", loginBody: "房间内容只对持有口令的已登录账号开放。", loginAction: "打开登录",
      roomPassword: "房间口令", roomPlaceholder: "至少 6 位，分享给另一位登录用户", generate: "随机生成", copy: "复制",
      securityNote: "口令不会发送到服务器；知道口令的人可读取房间内容，请勿上传账号凭证。", enter: "进入房间",
      roomActive: "临时房间已连接", refresh: "刷新", leave: "离开房间", textLabel: "加密文字",
      textPlaceholder: "发送一段加密文字……", send: "发送", dropTitle: "选择或拖入文件", chooseFile: "选择文件", tasks: "上传任务",
      online: "在线", offline: "离线", loading: "正在连接临时互传……", loginNeeded: "请先登录后使用临时互传。",
      r2Missing: "R2 尚未绑定，文字房间可查看，但文件上传暂不可用。", generated: "已生成随机口令，请复制给另一位登录用户。",
      copied: "房间口令已复制。", copyFailed: "无法访问剪贴板，请手动复制。", shortPassword: "房间口令至少需要 6 位。",
      joined: "已进入临时房间。", joinFailed: "无法进入房间。", normalMode: "普通账号 · 单文件最多 {max} · 今日剩余 {remaining}",
      adminMode: "管理员大文件模式 · 分片上传 · 不受普通业务配额限制", pool: "普通用户免费池：{status}",
      empty: "房间里还没有内容。发送加密文字或选择文件开始互传。", expires: "剩余 {time}", download: "下载", delete: "删除",
      decrypting: "正在解密文字……", decryptFailed: "这条文字无法用当前房间口令解密。", unknownUploader: "已登录用户",
      queued: "等待上传", uploading: "上传中", paused: "已暂停", retrying: "分片重试", completing: "正在完成", complete: "上传完成", failed: "上传失败", cancelled: "已取消",
      pause: "暂停", resume: "继续", cancel: "取消", reselect: "重新选择同一文件", speed: "{done} / {total} · {speed}/s · 约 {eta}",
      normalHelp: "普通账号单文件不超过 {max}，24 小时额度剩余 {remaining}。", adminHelp: "管理员可连续添加大文件；客户端按队列和有限并发稳定上传。",
      fileTooLarge: "普通账号不能上传超过 {max} 的文件。", sessionExpired: "上传任务已失效，请重新选择文件。", fileMismatch: "所选文件与待恢复任务不一致。",
      unsafeNotice: "文件未做病毒扫描，请只下载可信来源内容。", textSent: "加密文字已发送。", deleted: "内容已删除。", genericError: "操作失败，请稍后重试。",
      poolGreen: "正常", poolYellow: "接近阈值，已降低上传压力", poolRed: "已暂停普通用户新增文件", restoreHint: "刷新后需重新选择同一文件继续。"
    },
    en: {
      back: "Back to Resources", title: "Quick Transfer", retention: "Items expire 24 hours after publishing completes.",
      loginTitle: "Sign in to use Quick Transfer", loginBody: "Room content is available only to signed-in people with the passphrase.", loginAction: "Open sign-in",
      roomPassword: "Room passphrase", roomPlaceholder: "At least 6 characters; share it with another signed-in person", generate: "Generate", copy: "Copy",
      securityNote: "The passphrase is never sent to the server. Anyone who knows it can read the room; do not upload credentials.", enter: "Enter room",
      roomActive: "Temporary room connected", refresh: "Refresh", leave: "Leave room", textLabel: "Encrypted text", textPlaceholder: "Send encrypted text…", send: "Send",
      dropTitle: "Choose or drop files", chooseFile: "Choose files", tasks: "Upload tasks", online: "Online", offline: "Offline", loading: "Connecting to Quick Transfer…",
      loginNeeded: "Sign in before using Quick Transfer.", r2Missing: "R2 is not bound yet. Text rooms remain visible, but file uploads are unavailable.",
      generated: "Random passphrase generated. Copy it to the other signed-in person.", copied: "Room passphrase copied.", copyFailed: "Clipboard access failed; copy it manually.",
      shortPassword: "The room passphrase must be at least 6 characters.", joined: "Temporary room joined.", joinFailed: "Unable to enter the room.",
      normalMode: "Standard account · {max} per file · {remaining} remaining today", adminMode: "Admin large-file mode · multipart · standard quotas do not apply",
      pool: "Standard-user free pool: {status}", empty: "Nothing is here yet. Send encrypted text or choose a file.", expires: "{time} left", download: "Download", delete: "Delete",
      decrypting: "Decrypting text…", decryptFailed: "This text cannot be decrypted with the current passphrase.", unknownUploader: "Signed-in user",
      queued: "Queued", uploading: "Uploading", paused: "Paused", retrying: "Retrying part", completing: "Completing", complete: "Upload complete", failed: "Upload failed", cancelled: "Cancelled",
      pause: "Pause", resume: "Resume", cancel: "Cancel", reselect: "Select the same file", speed: "{done} / {total} · {speed}/s · about {eta}",
      normalHelp: "Standard accounts: up to {max} per file, {remaining} left in the rolling 24-hour quota.", adminHelp: "Admins may queue large files; bounded concurrency keeps uploads stable.",
      fileTooLarge: "Standard accounts cannot upload files over {max}.", sessionExpired: "This upload session expired. Select the file again to restart.", fileMismatch: "The selected file does not match the resumable task.",
      unsafeNotice: "Files are not virus-scanned. Download only from people you trust.", textSent: "Encrypted text sent.", deleted: "Item deleted.", genericError: "The operation failed. Try again later.",
      poolGreen: "Healthy", poolYellow: "Near the threshold; upload pressure is reduced", poolRed: "New standard-user files are paused", restoreHint: "After refresh, reselect the same file to continue."
    },
    ja: {
      back: "リソースへ戻る", title: "一時転送", retention: "公開完了から24時間後に自動で失効します。",
      loginTitle: "ログインして一時転送を使用", loginBody: "部屋の内容は合言葉を持つログイン済みユーザーだけが利用できます。", loginAction: "ログインを開く",
      roomPassword: "部屋の合言葉", roomPlaceholder: "6文字以上。相手のログインユーザーと共有", generate: "ランダム生成", copy: "コピー",
      securityNote: "合言葉はサーバーへ送信されません。知っている人は閲覧できるため、認証情報を送らないでください。", enter: "部屋に入る",
      roomActive: "一時部屋に接続済み", refresh: "更新", leave: "退出", textLabel: "暗号化テキスト", textPlaceholder: "暗号化テキストを送信…", send: "送信",
      dropTitle: "ファイルを選択またはドロップ", chooseFile: "ファイル選択", tasks: "アップロード", online: "オンライン", offline: "オフライン", loading: "一時転送に接続中…",
      loginNeeded: "先にログインしてください。", r2Missing: "R2 が未接続です。テキスト部屋は利用できますが、ファイル送信はまだ使えません。",
      generated: "ランダム合言葉を生成しました。相手にコピーしてください。", copied: "合言葉をコピーしました。", copyFailed: "クリップボードを利用できません。手動でコピーしてください。",
      shortPassword: "合言葉は6文字以上必要です。", joined: "一時部屋に入りました。", joinFailed: "部屋に入れませんでした。",
      normalMode: "一般アカウント · 1件 {max} まで · 本日残り {remaining}", adminMode: "管理者大容量モード · 分割送信 · 一般枠の対象外",
      pool: "一般ユーザー無料枠：{status}", empty: "まだ内容がありません。暗号化テキストまたはファイルを送ってください。", expires: "残り {time}", download: "ダウンロード", delete: "削除",
      decrypting: "テキストを復号中…", decryptFailed: "現在の合言葉では復号できません。", unknownUploader: "ログインユーザー",
      queued: "送信待ち", uploading: "送信中", paused: "一時停止", retrying: "分割を再試行", completing: "完了処理中", complete: "送信完了", failed: "送信失敗", cancelled: "キャンセル済み",
      pause: "一時停止", resume: "再開", cancel: "キャンセル", reselect: "同じファイルを再選択", speed: "{done} / {total} · {speed}/秒 · 約 {eta}",
      normalHelp: "一般アカウントは1件 {max} まで、直近24時間の残りは {remaining} です。", adminHelp: "管理者は大容量ファイルを連続追加できます。安定性のため同時分割数は制限します。",
      fileTooLarge: "一般アカウントは {max} を超えるファイルを送れません。", sessionExpired: "アップロード期限が切れました。最初からやり直してください。", fileMismatch: "選択したファイルが再開対象と一致しません。",
      unsafeNotice: "ウイルス検査は行っていません。信頼できる相手のファイルだけを開いてください。", textSent: "暗号化テキストを送信しました。", deleted: "削除しました。", genericError: "処理に失敗しました。後でもう一度お試しください。",
      poolGreen: "正常", poolYellow: "しきい値に接近。負荷を抑制中", poolRed: "一般ユーザーの新規ファイルを停止中", restoreHint: "更新後は同じファイルを再選択すると続行できます。"
    }
  };

  const state = {
    initialized: false, lang: "zh", open: false, config: null, roomKey: "", cryptoKey: null,
    items: [], pollTimer: 0, lastActivity: Date.now(), tasks: new Map(), xhrByTask: new Map(),
    pendingTaskIds: [], activeTaskIds: new Set()
  };
  const refs = {};

  function text(key, values = {}) {
    let value = COPY[state.lang]?.[key] || COPY.zh[key] || key;
    Object.entries(values).forEach(([name, replacement]) => {
      value = value.replaceAll(`{${name}}`, String(replacement));
    });
    return value;
  }

  function cacheRefs() {
    ["app", "feedback", "login-gate", "room-entry", "room", "room-password", "quota-card", "room-mode", "feed", "text-input", "file-input", "upload-help", "task-list", "network-status"]
      .forEach((name) => { refs[toCamel(name)] = document.getElementById(`transfer-${name}`); });
    refs.resourceCategories = document.getElementById("resource-categories");
    refs.resourceList = document.getElementById("resource-list");
  }

  function toCamel(value) {
    return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  }

  function init(lang) {
    if (state.initialized || !document.getElementById("transfer-app")) return;
    state.initialized = true;
    cacheRefs();
    bindEvents();
    setLanguage(lang || "zh");
    updateNetwork();
  }

  function bindEvents() {
    document.getElementById("transfer-back-to-resources")?.addEventListener("click", close);
    document.getElementById("transfer-login-button")?.addEventListener("click", () => document.querySelector("[data-account-toggle]")?.click());
    document.getElementById("transfer-generate-password")?.addEventListener("click", generatePassword);
    document.getElementById("transfer-copy-password")?.addEventListener("click", copyPassword);
    document.getElementById("transfer-room-form")?.addEventListener("submit", joinRoom);
    document.getElementById("transfer-leave-room")?.addEventListener("click", leaveRoom);
    document.getElementById("transfer-refresh-button")?.addEventListener("click", () => refreshItems(true));
    document.getElementById("transfer-text-form")?.addEventListener("submit", sendText);
    refs.fileInput?.addEventListener("change", (event) => queueFiles(event.target.files));
    const zone = document.getElementById("transfer-upload-zone");
    ["dragenter", "dragover"].forEach((name) => zone?.addEventListener(name, (event) => { event.preventDefault(); zone.classList.add("is-dragging"); }));
    ["dragleave", "drop"].forEach((name) => zone?.addEventListener(name, (event) => { event.preventDefault(); zone.classList.remove("is-dragging"); }));
    zone?.addEventListener("drop", (event) => queueFiles(event.dataTransfer?.files));
    zone?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") refs.fileInput?.click(); });
    document.addEventListener("paste", (event) => { if (state.open && state.roomKey && event.clipboardData?.files?.length) queueFiles(event.clipboardData.files); });
    ["pointerdown", "keydown"].forEach((name) => document.addEventListener(name, () => { state.lastActivity = Date.now(); }, { passive: true }));
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    document.addEventListener("visibilitychange", schedulePoll);
  }

  function setLanguage(lang) {
    state.lang = ["zh", "en", "ja"].includes(lang) ? lang : "zh";
    document.querySelectorAll("[data-transfer-copy]").forEach((node) => { node.textContent = text(node.dataset.transferCopy); });
    document.querySelectorAll("[data-transfer-placeholder]").forEach((node) => { node.setAttribute("placeholder", text(node.dataset.transferPlaceholder)); });
    updateNetwork();
    renderQuota();
    renderItems();
    renderTasks();
  }

  async function open() {
    if (!state.initialized) init(document.documentElement.lang.slice(0, 2));
    state.open = true;
    refs.resourceCategories.hidden = true;
    refs.resourceList.hidden = true;
    refs.app.hidden = false;
    setFeedback(text("loading"));
    await loadConfig();
    refs.app.querySelector("button, input")?.focus();
  }

  function close() {
    state.open = false;
    refs.app.hidden = true;
    refs.resourceCategories.hidden = false;
    refs.resourceList.hidden = false;
    stopPoll();
    document.querySelector("[data-quick-transfer-open]")?.focus();
  }

  async function loadConfig() {
    try {
      state.config = await api("/api/transfer/config");
      refs.loginGate.hidden = true;
      refs.roomEntry.hidden = Boolean(state.roomKey);
      refs.room.hidden = !state.roomKey;
      renderQuota();
      if (!state.config.r2Ready) setFeedback(text("r2Missing"), true);
      else setFeedback("");
      if (state.roomKey) {
        restoreTasks();
        await refreshItems(true);
        schedulePoll();
      }
    } catch (error) {
      if (error.status === 401) {
        state.config = null;
        refs.loginGate.hidden = false;
        refs.roomEntry.hidden = true;
        refs.room.hidden = true;
        setFeedback(text("loginNeeded"));
      } else {
        setFeedback(error.message || text("genericError"), true);
      }
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
      await navigator.clipboard.writeText(refs.roomPassword.value);
      setFeedback(text("copied"));
    } catch {
      refs.roomPassword.select();
      setFeedback(text("copyFailed"), true);
    }
  }

  async function joinRoom(event) {
    event.preventDefault();
    const password = refs.roomPassword.value.normalize("NFKC").trim();
    if (Array.from(password).length < 6) return setFeedback(text("shortPassword"), true);
    try {
      const derived = await deriveRoom(password);
      await api("/api/transfer/room/join", { method: "POST", json: { roomKey: derived.roomKey } });
      state.roomKey = derived.roomKey;
      state.cryptoKey = derived.cryptoKey;
      refs.roomPassword.value = "";
      refs.roomPassword.type = "password";
      refs.roomEntry.hidden = true;
      refs.room.hidden = false;
      updateRoomMode();
      restoreTasks();
      await refreshItems(true);
      schedulePoll();
      setFeedback(text("joined"));
    } catch (error) {
      setFeedback(error.message || text("joinFailed"), true);
    }
  }

  function leaveRoom() {
    stopPoll();
    state.roomKey = "";
    state.cryptoKey = null;
    state.items = [];
    refs.room.hidden = true;
    refs.roomEntry.hidden = false;
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

  async function encryptText(value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, state.cryptoKey, new TextEncoder().encode(value));
    return `${base64url(iv)}.${base64url(new Uint8Array(cipher))}`;
  }

  async function decryptText(value) {
    const [iv, cipher] = String(value).split(".");
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(iv) }, state.cryptoKey, fromBase64url(cipher));
    return new TextDecoder().decode(clear);
  }

  async function sendText(event) {
    event.preventDefault();
    const value = refs.textInput.value.trim();
    if (!value || !state.cryptoKey) return;
    try {
      const encryptedContent = await encryptText(value);
      await api("/api/transfer/text", { method: "POST", json: { roomKey: state.roomKey, encryptedContent } });
      refs.textInput.value = "";
      await refreshItems(true);
      setFeedback(text("textSent"));
    } catch (error) {
      setFeedback(error.message || text("genericError"), true);
    }
  }

  async function refreshItems(showErrors) {
    if (!state.roomKey) return;
    try {
      const all = [];
      let after = "";
      for (let page = 0; page < 5; page += 1) {
        const payload = await api(`/api/transfer/room/items?room=${encodeURIComponent(state.roomKey)}&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`);
        all.push(...(payload.items || []));
        if (!payload.nextCursor || payload.items.length < 100) break;
        after = payload.nextCursor;
      }
      state.items = all;
      renderItems();
      if (!all.length) setFeedback("");
    } catch (error) {
      if (showErrors) setFeedback(error.message || text("genericError"), true);
      if (error.status === 401) await loadConfig();
    }
  }

  function renderItems() {
    if (!refs.feed || refs.room?.hidden) return;
    refs.feed.replaceChildren();
    if (!state.items.length) {
      const empty = document.createElement("div");
      empty.className = "transfer-empty";
      const icon = iconNode("app");
      const copy = document.createElement("p");
      copy.textContent = text("empty");
      empty.append(icon, copy);
      refs.feed.append(empty);
      return;
    }
    state.items.forEach((item) => refs.feed.append(itemNode(item)));
    refs.feed.scrollTop = refs.feed.scrollHeight;
  }

  function itemNode(item) {
    const article = document.createElement("article");
    article.className = `transfer-item transfer-item-${item.type}`;
    const header = document.createElement("header");
    header.append(iconNode(iconName(item.type)));
    const who = document.createElement("strong");
    who.textContent = item.uploader || text("unknownUploader");
    const time = document.createElement("time");
    time.dateTime = item.createdAt;
    time.textContent = new Intl.DateTimeFormat(state.lang, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt));
    const expires = document.createElement("span");
    expires.className = "transfer-expiry";
    expires.textContent = text("expires", { time: remaining(item.expiresAt) });
    header.append(who, time, expires);
    const body = document.createElement("div");
    body.className = "transfer-item-body";
    if (item.type === "text") {
      const paragraph = document.createElement("p");
      paragraph.textContent = text("decrypting");
      body.append(paragraph);
      decryptText(item.encryptedContent).then((value) => { paragraph.textContent = value; }).catch(() => { paragraph.textContent = text("decryptFailed"); article.classList.add("is-error"); });
    } else {
      if (item.type === "image") {
        const image = document.createElement("img");
        image.src = item.fileUrl;
        image.alt = item.filename;
        image.loading = "lazy";
        image.decoding = "async";
        body.append(image);
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
      const filename = document.createElement("strong");
      filename.className = "transfer-filename";
      filename.textContent = item.filename;
      const meta = document.createElement("span");
      meta.textContent = `${formatBytes(item.sizeBytes)} · ${item.mimeType || "application/octet-stream"}`;
      const warning = document.createElement("small");
      warning.textContent = text("unsafeNotice");
      const actions = document.createElement("div");
      actions.className = "transfer-item-actions";
      const download = document.createElement("a");
      download.className = "xp-button";
      download.href = `${item.fileUrl}&download=1`;
      download.append(iconNode("download"), document.createTextNode(text("download")));
      actions.append(download);
      body.append(filename, meta, warning, actions);
    }
    if (item.canDelete) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "transfer-delete-button";
      remove.setAttribute("aria-label", text("delete"));
      remove.append(iconNode("delete"));
      remove.addEventListener("click", () => deleteItem(item.id));
      header.append(remove);
    }
    article.append(header, body);
    return article;
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

  function queueFiles(fileList) {
    const files = Array.from(fileList || []);
    refs.fileInput.value = "";
    files.forEach((file) => {
      if (!state.config?.user?.isAdmin && file.size > state.config.normal.maxFileBytes) {
        setFeedback(text("fileTooLarge", { max: formatBytes(state.config.normal.maxFileBytes) }), true);
        return;
      }
      const task = {
        localId: crypto.randomUUID(), file, filename: file.name, size: file.size, lastModified: file.lastModified,
        uploaded: 0, status: "queued", startedAt: Date.now(), speed: 0, paused: false, controller: null,
        multipart: Boolean(state.config.user.isAdmin && file.size > state.config.normal.maxFileBytes), parts: []
      };
      state.tasks.set(task.localId, task);
      enqueueTask(task);
    });
  }

  function enqueueTask(task) {
    if (state.activeTaskIds.has(task.localId) || state.pendingTaskIds.includes(task.localId)) return;
    task.paused = false;
    task.status = "queued";
    task.error = "";
    state.pendingTaskIds.push(task.localId);
    renderTasks();
    pumpTaskQueue();
  }

  function pumpTaskQueue() {
    const isMobile = document.documentElement.dataset.uiShell === "mobile";
    const maximumActiveTasks = state.config?.user?.isAdmin ? (isMobile ? 1 : 2) : 1;
    while (state.activeTaskIds.size < maximumActiveTasks && state.pendingTaskIds.length) {
      const localId = state.pendingTaskIds.shift();
      const task = state.tasks.get(localId);
      if (!task || ["cancelled", "complete", "paused"].includes(task.status)) continue;
      state.activeTaskIds.add(localId);
      task.status = "uploading";
      task.startedAt = Date.now();
      renderTasks();
      runTask(task)
        .catch((error) => failTask(task, error))
        .finally(() => {
          state.activeTaskIds.delete(localId);
          pumpTaskQueue();
        });
    }
  }

  async function runTask(task) {
    if (task.multipart) return runMultipart(task);
    return runSimple(task);
  }

  async function runSimple(task) {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      state.xhrByTask.set(task.localId, xhr);
      xhr.open("POST", `/api/transfer/upload/simple?room=${encodeURIComponent(state.roomKey)}&filename=${encodeURIComponent(task.filename)}&mime=${encodeURIComponent(task.file.type || "application/octet-stream")}&size=${task.size}`);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", task.file.type || "application/octet-stream");
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        task.uploaded = event.loaded;
        updateTaskSpeed(task);
        renderTasks();
      };
      xhr.onerror = () => reject(new Error(text("genericError")));
      xhr.onabort = () => reject(Object.assign(new Error(text("cancelled")), { cancelled: true }));
      xhr.onload = () => {
        const payload = parseJson(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
        else reject(Object.assign(new Error(payload.error || text("genericError")), { status: xhr.status }));
      };
      xhr.send(task.file);
    });
    task.uploaded = task.size;
    task.status = "complete";
    state.xhrByTask.delete(task.localId);
    renderTasks();
    await loadConfig();
    await refreshItems(true);
  }

  async function runMultipart(task) {
    if (!task.sessionId) {
      const initialized = await api("/api/transfer/upload/init", {
        method: "POST",
        json: { roomKey: state.roomKey, filename: task.filename, mimeType: task.file.type || "application/octet-stream", sizeBytes: task.size }
      });
      Object.assign(task, initialized);
      task.parts = [];
      saveTasks();
    } else {
      const status = await api(`/api/transfer/upload/status?session=${encodeURIComponent(task.sessionId)}&room=${encodeURIComponent(state.roomKey)}`);
      task.parts = status.parts || [];
      task.uploaded = task.parts.reduce((sum, part) => sum + part.sizeBytes, 0);
    }
    const completeParts = new Set(task.parts.map((part) => part.partNumber));
    const pending = Array.from({ length: task.expectedParts }, (_, index) => index + 1).filter((part) => !completeParts.has(part));
    const concurrency = document.documentElement.dataset.uiShell === "mobile" ? 2 : 4;
    const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
      while (pending.length) {
        if (task.paused || task.status === "cancelled") return;
        const partNumber = pending.shift();
        await uploadPartWithRetry(task, partNumber);
      }
    });
    await Promise.all(workers);
    if (task.paused || task.status === "cancelled") return;
    task.status = "completing";
    renderTasks();
    await api("/api/transfer/upload/complete", { method: "POST", json: { roomKey: state.roomKey, sessionId: task.sessionId } });
    task.uploaded = task.size;
    task.status = "complete";
    removeSavedTask(task.localId);
    renderTasks();
    await refreshItems(true);
  }

  async function uploadPartWithRetry(task, partNumber) {
    const start = (partNumber - 1) * task.partSizeBytes;
    const end = Math.min(task.size, start + task.partSizeBytes);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (task.paused || task.status === "cancelled") return;
      const controller = new AbortController();
      task.controller = controller;
      try {
        const response = await fetch(`/api/transfer/upload/part?session=${encodeURIComponent(task.sessionId)}&room=${encodeURIComponent(state.roomKey)}&part=${partNumber}&size=${end - start}`, {
          method: "PUT", body: task.file.slice(start, end), credentials: "same-origin", signal: controller.signal,
          headers: { "Content-Type": "application/octet-stream" }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw Object.assign(new Error(payload.error || `HTTP ${response.status}`), { status: response.status });
        task.parts.push(payload);
        task.uploaded += end - start;
        updateTaskSpeed(task);
        saveTasks();
        renderTasks();
        return;
      } catch (error) {
        if (task.paused || task.status === "cancelled" || error.name === "AbortError") return;
        if (attempt === 3) throw error;
        task.status = "retrying";
        renderTasks();
        await delay(800 * (2 ** attempt));
        task.status = "uploading";
      }
    }
  }

  function pauseTask(task) {
    task.paused = true;
    task.status = "paused";
    state.pendingTaskIds = state.pendingTaskIds.filter((localId) => localId !== task.localId);
    task.controller?.abort();
    state.xhrByTask.get(task.localId)?.abort();
    saveTasks();
    renderTasks();
  }

  function resumeTask(task) {
    if (!task.file) return selectResumeFile(task);
    enqueueTask(task);
  }

  async function cancelTask(task) {
    task.status = "cancelled";
    state.pendingTaskIds = state.pendingTaskIds.filter((localId) => localId !== task.localId);
    task.controller?.abort();
    state.xhrByTask.get(task.localId)?.abort();
    if (task.sessionId) {
      try { await api("/api/transfer/upload/abort", { method: "POST", json: { roomKey: state.roomKey, sessionId: task.sessionId } }); } catch { /* cleanup worker remains the fallback */ }
    }
    removeSavedTask(task.localId);
    renderTasks();
  }

  function selectResumeFile(task) {
    const input = document.createElement("input");
    input.type = "file";
    input.hidden = true;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
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
    if (error.cancelled || task.status === "cancelled") return;
    task.status = error.status === 410 ? "failed" : "failed";
    task.error = error.status === 410 ? text("sessionExpired") : error.message || text("genericError");
    renderTasks();
    setFeedback(task.error, true);
  }

  function renderTasks() {
    if (!refs.taskList) return;
    refs.taskList.replaceChildren();
    [...state.tasks.values()].sort((a, b) => b.startedAt - a.startedAt).forEach((task) => {
      const row = document.createElement("article");
      row.className = `transfer-task is-${task.status}`;
      row.append(iconNode(iconName(task.file?.type?.split("/")[0] || "file")));
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = task.filename;
      const status = document.createElement("span");
      status.textContent = task.error || text(task.status in COPY.zh ? task.status : "uploading");
      const progress = document.createElement("progress");
      progress.max = task.size || 1;
      progress.value = task.uploaded || 0;
      const stats = document.createElement("small");
      const remainingBytes = Math.max(0, task.size - task.uploaded);
      stats.textContent = text("speed", {
        done: formatBytes(task.uploaded), total: formatBytes(task.size), speed: formatBytes(task.speed || 0), eta: formatDuration(task.speed ? remainingBytes / task.speed : 0)
      });
      copy.append(name, status, progress, stats);
      const actions = document.createElement("div");
      actions.className = "transfer-task-actions";
      if (["uploading", "retrying"].includes(task.status)) actions.append(taskButton("pause", "pause", () => pauseTask(task)));
      if (["paused", "failed"].includes(task.status)) actions.append(taskButton("resume", task.file ? "resume" : "reselect", () => resumeTask(task)));
      if (!["complete", "cancelled"].includes(task.status)) actions.append(taskButton("cancel", "cancel", () => cancelTask(task)));
      row.append(copy, actions);
      refs.taskList.append(row);
    });
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
      localId: task.localId, roomKey: state.roomKey, sessionId: task.sessionId, itemId: task.itemId, filename: task.filename,
      size: task.size, lastModified: task.lastModified, partSizeBytes: task.partSizeBytes, expectedParts: task.expectedParts,
      expiresAt: task.expiresAt, uploaded: task.uploaded, parts: task.parts, status: "paused", multipart: true, startedAt: task.startedAt
    }));
    try { sessionStorage.setItem(SESSION_TASKS_KEY, JSON.stringify(saved)); } catch { /* resumability becomes unavailable */ }
  }

  function restoreTasks() {
    let saved = [];
    try { saved = JSON.parse(sessionStorage.getItem(SESSION_TASKS_KEY) || "[]"); } catch { saved = []; }
    saved.filter((task) => task.roomKey === state.roomKey && new Date(task.expiresAt).getTime() > Date.now()).forEach((task) => {
      if (!state.tasks.has(task.localId)) state.tasks.set(task.localId, { ...task, file: null, paused: true, status: "paused", speed: 0 });
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
    updateRoomMode();
    refs.uploadHelp.textContent = state.config.user.isAdmin
      ? text("adminHelp")
      : text("normalHelp", { max: formatBytes(state.config.normal.maxFileBytes), remaining: formatBytes(state.config.normal.remaining24hBytes) });
  }

  function updateRoomMode() {
    if (!refs.roomMode || !state.config) return;
    refs.roomMode.textContent = state.config.user.isAdmin
      ? text("adminMode")
      : text("normalMode", { max: formatBytes(state.config.normal.maxFileBytes), remaining: formatBytes(state.config.normal.remaining24hBytes) });
  }

  function schedulePoll() {
    stopPoll();
    if (!state.open || !state.roomKey) return;
    const idle = Date.now() - state.lastActivity;
    if (idle > 30 * 60 * 1000) return;
    const delayMs = document.hidden ? 30000 : idle > 60000 ? 15000 : 5000;
    state.pollTimer = window.setTimeout(async () => { await refreshItems(false); schedulePoll(); }, delayMs);
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
  }

  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;
    if (options.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.json);
    }
    const response = await fetch(url, { method: options.method || "GET", headers, body, credentials: "same-origin", signal: options.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || `HTTP ${response.status}`), { status: response.status, code: payload.code || "" });
    return payload;
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
  function delay(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
  function capitalize(value) { return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1); }

  window.QuickTransfer = Object.freeze({ init, open, close, setLanguage });
})();
