export function createChatroomRoute({
  t,
  getCurrentLang,
  safeStorageGet,
  safeStorageSet,
  requestMobileFocusReveal,
  normalizeDateInput,
  formatZonedDateTime,
  routeFetch,
  activeRouteScope,
  isAbortError
}) {
  const chatStorageKeys = Object.freeze({
    visitorId: "lusu-chat-visitor-id",
    nickname: "lusu-chat-nickname",
    lastSentAt: "lusu-chat-last-sent-at"
  });
  const chatInitialMessageLimit = 100;
  const chatUnanchoredRefreshLimit = 20;
  const chatCooldownMs = 3000;
  const chatPublicRoomKey = "public";
  const chatPrivateRoomSalt = "lusu575-private-chat-v1";
  const chatPrivateRoomIterations = 150000;
  const chatBottomThreshold = 48;
  const chatFeedbackPriority = Object.freeze({ idle: 0, sync: 1, network: 2, room: 3, validation: 4, send: 5 });
  const chatRoomSessions = new Map();
  const chatState = {
    initialized: false,
    loading: false,
    sending: false,
    draftRevision: 0,
    hasLoadedInitial: false,
    idlePolls: 0,
    visitorId: "",
    nickname: "",
    lastMessageId: "",
    seenMessageIds: new Set(),
    pollTimer: null,
    pollDelay: 5000,
    roomKey: chatPublicRoomKey,
    roomMode: "public",
    roomCryptoKey: null,
    roomRevision: 0,
    roomSwitching: false,
    connectionState: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online",
    lastRefreshSucceeded: true,
    nicknameErrorKey: "",
    feedback: { key: "chatCooldownHint", raw: "", isError: false, source: "idle" },
    liveSummary: { key: "", count: 0 },
    lastSentAt: sanitizeChatLastSentAt(safeStorageGet(chatStorageKeys.lastSentAt, "0"))
  };

  function currentChatRoomSession() {
    let session = chatRoomSessions.get(chatState.roomKey);
    if (!session) {
      session = { draft: "", scrollTop: 0, hasScrollPosition: false, nearBottom: true, unread: 0, sendAttempt: null };
      chatRoomSessions.set(chatState.roomKey, session);
    }
    return session;
  }

  function createChatRequestId() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return `chat_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
    }
    return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2).padEnd(16, "0")}`;
  }

  function chatSendAttempt(draft) {
    const session = currentChatRoomSession();
    if (session.sendAttempt?.draft === draft) return session.sendAttempt;
    session.sendAttempt = Object.freeze({ draft, requestId: createChatRequestId() });
    return session.sendAttempt;
  }

  function formatChatCount(key, count) {
    return t(key).replace("{count}", String(count));
  }

  function sanitizeChatLastSentAt(value, now = Date.now()) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > now) {
      return 0;
    }
    return timestamp;
  }

  async function ensureChatIdentity(options = {}) {
    let visitorId = safeStorageGet(chatStorageKeys.visitorId);
    if (!visitorId) {
      visitorId = crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      safeStorageSet(chatStorageKeys.visitorId, visitorId);
    }

    let nickname = safeStorageGet(chatStorageKeys.nickname);
    if (!isValidChatNickname(nickname)) {
      nickname = await fetchAvailableChatNickname(options);
      if (options.signal?.aborted) {
        throw new DOMException("The route was left", "AbortError");
      }
      safeStorageSet(chatStorageKeys.nickname, nickname);
    }

    chatState.visitorId = visitorId;
    chatState.nickname = nickname.trim();
    updateChatNicknameDisplay();
  }

  async function fetchAvailableChatNickname(options = {}) {
    try {
      const params = new URLSearchParams({ lang: getCurrentLang() });
      appendChatRoomParam(params);
      const payload = await chatApi(`/api/chat/nickname?${params.toString()}`, {
        signal: options.signal
      });
      if (isValidChatNickname(payload.nickname)) {
        return payload.nickname.trim();
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      // Local fallback keeps the chat usable if the nickname endpoint is unavailable.
    }
    return randomChatNickname();
  }

  function randomChatNickname() {
    const pools = {
      zh: ["蓝屏像素", "像素幽灵", "草地路人A", "CRT访客", "电视小粉", "泡泡旅人"],
      en: ["BluePixel", "PixelGhost", "CRTGuest", "GrassWalk", "BubbleTrip", "TVHead"],
      ja: ["青いピクセル", "ピクセル幽霊", "CRT旅人", "草原の人", "テレビ旅人", "泡の旅人"]
    };
    const names = pools[getCurrentLang()] || pools.zh;
    const suffixes = ["9527", "1024", "2333", "404", "88", "7"];
    const name = names[Math.floor(Math.random() * names.length)];
    return `${name}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
  }

  function isValidChatNickname(value) {
    const text = String(value || "").trim();
    const length = Array.from(text).length;
    return length >= 2 && length <= 16;
  }

  function isPrivateChatRoomActive() {
    return chatState.roomMode === "private"
      && chatState.roomKey !== chatPublicRoomKey
      && Boolean(chatState.roomCryptoKey);
  }

  function appendChatRoomParam(params) {
    if (chatState.roomKey && chatState.roomKey !== chatPublicRoomKey) {
      params.set("room", chatState.roomKey);
    }
    return params;
  }

  function hasChatPrivateCrypto() {
    return Boolean(window.crypto?.subtle && window.crypto?.getRandomValues && window.TextEncoder && window.TextDecoder);
  }

  function base64UrlEncode(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlDecode(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  async function deriveChatPrivateRoom(password) {
    if (!hasChatPrivateCrypto()) {
      throw new Error(t("chatPrivateCryptoUnavailable"));
    }
    const encoder = new TextEncoder();
    const imported = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(chatPrivateRoomSalt),
        iterations: chatPrivateRoomIterations,
        hash: "SHA-256"
      },
      imported,
      512
    );
    const derived = new Uint8Array(derivedBits);
    const roomKey = `room_${base64UrlEncode(derived.slice(0, 32))}`;
    const roomCryptoKey = await window.crypto.subtle.importKey(
      "raw",
      derived.slice(32, 64),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"]
    );
    return { roomKey, roomCryptoKey };
  }

  async function encryptChatContent(content) {
    if (!isPrivateChatRoomActive()) {
      return content;
    }
    try {
      const encoder = new TextEncoder();
      const iv = new Uint8Array(12);
      window.crypto.getRandomValues(iv);
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        chatState.roomCryptoKey,
        encoder.encode(content)
      );
      return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
    } catch {
      throw new Error(t("chatEncryptFailed"));
    }
  }

  async function decryptChatContent(content) {
    const parts = String(content || "").split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1] || !chatState.roomCryptoKey) {
      throw new Error(t("chatDecryptFailed"));
    }
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlDecode(parts[0]) },
      chatState.roomCryptoKey,
      base64UrlDecode(parts[1])
    );
    return new TextDecoder().decode(decrypted);
  }

  async function prepareChatMessagesForDisplay(messages) {
    if (!isPrivateChatRoomActive()) {
      return messages;
    }
    const prepared = [];
    for (const message of messages) {
      if (Number(message.encrypted) !== 1) {
        prepared.push(message);
        continue;
      }
      try {
        prepared.push({ ...message, content: await decryptChatContent(message.content) });
      } catch {
        prepared.push({ ...message, content: t("chatDecryptFailed") });
      }
    }
    return prepared;
  }

  function syncChatRoomUi() {
    const isPrivate = isPrivateChatRoomActive();
    const windowElement = document.querySelector(".chatroom-window");
    const labelElement = document.getElementById("chat-room-label");
    const toggleButton = document.getElementById("chat-room-toggle");
    windowElement?.classList.toggle("is-private-room", isPrivate);
    if (labelElement) {
      labelElement.dataset.i18n = isPrivate ? "chatRoomPrivateLabel" : "chatRoomPublicLabel";
      labelElement.textContent = t(labelElement.dataset.i18n);
    }
    if (toggleButton) {
      toggleButton.dataset.i18n = isPrivate ? "chatSwitchPublicRoom" : "chatEnterPrivateRoom";
      toggleButton.textContent = t(toggleButton.dataset.i18n);
    }
    syncChatRoomBusyState();
  }

  function showChatPrivateRoomForm() {
    const form = document.getElementById("chat-private-room-form");
    const input = document.getElementById("chat-private-password");
    if (chatState.roomSwitching) {
      return;
    }
    if (!hasChatPrivateCrypto()) {
      setChatFeedbackKey("chatPrivateCryptoUnavailable", true, { source: "room", force: true });
      return;
    }
    hideChatNicknameForm({ restoreFocus: false });
    clearChatPrivatePasswordError();
    if (form) {
      syncChatPrivateSafetyDisclosure();
      form.hidden = false;
    }
    input?.focus();
  }

  function syncChatPrivateSafetyDisclosure() {
    const form = document.getElementById("chat-private-room-form");
    if (!form) return;
    const hint = form.querySelector('[data-i18n="chatPrivateRoomHint"]');
    if (!hint) return;
    const cancel = document.getElementById("chat-private-room-cancel");
    let actions = form.querySelector(".chat-private-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "chat-private-actions";
      if (cancel) actions.appendChild(cancel);
      form.appendChild(actions);
    }
    let disclosure = form.querySelector(".chat-private-safety");
    let summary = disclosure?.querySelector("summary");
    if (!disclosure) {
      disclosure = document.createElement("details");
      disclosure.className = "chat-private-safety";
      summary = document.createElement("summary");
      disclosure.append(summary, hint);
      actions.appendChild(disclosure);
    }
    if (summary) {
      const summaryLabel = `${t("chatPrivatePasswordLabel")} · ${t("chatPrivatePasswordPlaceholder")}`;
      summary.textContent = "ⓘ";
      summary.setAttribute("aria-label", summaryLabel);
      summary.setAttribute("title", summaryLabel);
    }
    hint.textContent = t("chatPrivateRoomHint");
  }

  function setChatPrivatePasswordError(key = "") {
    const input = document.getElementById("chat-private-password");
    const error = document.getElementById("chat-private-password-error");
    if (!input) return;
    if (!key) {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-errormessage");
      if (error) {
        error.hidden = true;
        error.textContent = "";
        delete error.dataset.errorKey;
      }
      return;
    }
    if (error) {
      error.hidden = false;
      error.dataset.errorKey = key;
      error.textContent = t(key);
      input.setAttribute("aria-errormessage", error.id);
    }
    input.setAttribute("aria-invalid", "true");
  }

  function clearChatPrivatePasswordError() {
    setChatPrivatePasswordError("");
  }

  function handleChatPrivatePasswordInput() {
    clearChatPrivatePasswordError();
  }

  function syncChatRoomBusyState() {
    const busy = chatState.roomSwitching;
    const form = document.getElementById("chat-private-room-form");
    const input = document.getElementById("chat-private-password");
    const submit = document.getElementById("chat-private-room-submit");
    const cancel = document.getElementById("chat-private-room-cancel");
    const toggle = document.getElementById("chat-room-toggle");
    form?.setAttribute("aria-busy", String(busy));
    [input, submit, cancel, toggle].forEach((control) => {
      if (control) control.disabled = busy;
    });
    syncChatRetryButton();
  }

  function setChatRoomSwitching(switching) {
    chatState.roomSwitching = Boolean(switching);
    syncChatRoomBusyState();
  }

  function hideChatPrivateRoomForm(options = {}) {
    const form = document.getElementById("chat-private-room-form");
    const input = document.getElementById("chat-private-password");
    if (chatState.roomSwitching && options.force !== true) {
      return;
    }
    const wasOpen = form && !form.hidden;
    if (form) {
      form.hidden = true;
    }
    if (input) {
      input.value = "";
    }
    clearChatPrivatePasswordError();
    if (wasOpen && options.restoreFocus !== false) {
      document.getElementById("chat-room-toggle")?.focus({ preventScroll: true });
    }
  }

  function prepareChatRoomSwitch() {
    captureChatRoomUiState();
    stopChatPolling();
    chatState.loading = false;
    chatState.roomRevision += 1;
  }

  async function enterChatPrivateRoom(event) {
    event?.preventDefault();
    if (chatState.roomSwitching) {
      return;
    }
    const input = document.getElementById("chat-private-password");
    const password = String(input?.value || "");
    if (Array.from(password).length < 6) {
      setChatPrivatePasswordError("chatPrivatePasswordError");
      setChatFeedbackKey("chatPrivatePasswordTooShort", true, { source: "room", force: true });
      input?.focus();
      return;
    }

    let roomPrepared = false;
    setChatRoomSwitching(true);
    try {
      clearChatPrivatePasswordError();
      setChatFeedbackKey("chatPrivateRoomBusy", false, { source: "room", force: true });
      const room = await deriveChatPrivateRoom(password);
      if (!activeRouteScope("chatroom")?.isActive()) {
        throw new DOMException("The route was left", "AbortError");
      }
      prepareChatRoomSwitch();
      roomPrepared = true;
      chatState.roomKey = room.roomKey;
      chatState.roomCryptoKey = room.roomCryptoKey;
      chatState.roomMode = "private";
      hideChatPrivateRoomForm({ restoreFocus: false, force: true });
      syncChatRoomUi();
      restoreChatRoomDraft();
      resetChatLog(t("chatLoading"));
      await refreshChatMessages({ initial: true });
      if (chatState.lastRefreshSucceeded) {
        setChatFeedbackKey("chatPrivateRoomReady", false, { source: "room", force: true });
        scheduleChatPolling(5000);
      } else {
        setChatFeedbackKey("chatPrivateRoomLoadFailed", true, { source: "room", force: true });
        scheduleChatPolling(15000);
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      if (!roomPrepared) {
        setChatPrivatePasswordError("chatPrivatePasswordError");
        input?.focus({ preventScroll: true });
      }
      setChatFeedback(error.message || t("chatPrivateCryptoUnavailable"), true, { source: "room", force: true });
    } finally {
      setChatRoomSwitching(false);
    }
  }

  async function switchChatPublicRoom() {
    if (chatState.roomSwitching) {
      return;
    }
    setChatRoomSwitching(true);
    try {
      setChatFeedbackKey("chatPrivateRoomBusy", false, { source: "room", force: true });
      prepareChatRoomSwitch();
      chatState.roomKey = chatPublicRoomKey;
      chatState.roomCryptoKey = null;
      chatState.roomMode = "public";
      hideChatPrivateRoomForm({ restoreFocus: false, force: true });
      syncChatRoomUi();
      restoreChatRoomDraft();
      resetChatLog(t("chatLoading"));
      await refreshChatMessages({ initial: true });
      if (chatState.lastRefreshSucceeded) {
        setChatFeedbackKey("chatPublicRoomReady", false, { source: "room", force: true });
        scheduleChatPolling(5000);
      } else {
        setChatFeedbackKey("chatLoadFailed", true, { source: "room", force: true });
        scheduleChatPolling(15000);
      }
    } finally {
      setChatRoomSwitching(false);
    }
  }

  async function handleChatRoomToggle() {
    if (chatState.roomSwitching) {
      return;
    }
    if (isPrivateChatRoomActive()) {
      await switchChatPublicRoom();
      return;
    }
    showChatPrivateRoomForm();
  }

  function updateChatNicknameDisplay() {
    const display = document.getElementById("chat-nickname-display");
    if (display) {
      display.textContent = chatState.nickname;
    }
  }

  function renderChatNicknameError() {
    const error = document.getElementById("chat-nickname-error");
    if (!error) return;
    error.textContent = chatState.nicknameErrorKey ? t(chatState.nicknameErrorKey) : "";
    error.classList.toggle("is-error", Boolean(chatState.nicknameErrorKey));
  }

  async function showChatNicknameForm() {
    await ensureChatIdentity({ signal: activeRouteScope("chatroom")?.signal });
    hideChatPrivateRoomForm({ restoreFocus: false });
    const form = document.getElementById("chat-nickname-form");
    const input = document.getElementById("chat-nickname-input");
    const trigger = document.getElementById("chat-edit-nickname");
    if (!form || !input) return;
    chatState.nicknameErrorKey = "";
    renderChatNicknameError();
    input.value = chatState.nickname;
    input.setAttribute("aria-invalid", "false");
    form.hidden = false;
    trigger?.setAttribute("aria-expanded", "true");
    input.focus({ preventScroll: true });
    requestMobileFocusReveal("chat-nickname-input");
  }

  function hideChatNicknameForm(options = {}) {
    const form = document.getElementById("chat-nickname-form");
    const input = document.getElementById("chat-nickname-input");
    const trigger = document.getElementById("chat-edit-nickname");
    const wasOpen = form && !form.hidden;
    if (form) form.hidden = true;
    if (input) {
      input.value = "";
      input.setAttribute("aria-invalid", "false");
    }
    chatState.nicknameErrorKey = "";
    renderChatNicknameError();
    trigger?.setAttribute("aria-expanded", "false");
    if (wasOpen && options.restoreFocus !== false) trigger?.focus({ preventScroll: true });
  }

  function submitChatNickname(event) {
    event?.preventDefault();
    const input = document.getElementById("chat-nickname-input");
    const normalized = String(input?.value || "").trim();
    if (!isValidChatNickname(normalized)) {
      chatState.nicknameErrorKey = "chatNicknameInvalid";
      renderChatNicknameError();
      input?.setAttribute("aria-invalid", "true");
      input?.focus({ preventScroll: true });
      return;
    }
    input?.setAttribute("aria-invalid", "false");
    chatState.nickname = normalized;
    safeStorageSet(chatStorageKeys.nickname, normalized);
    updateChatNicknameDisplay();
    hideChatNicknameForm();
    setChatFeedbackKey("chatNicknameSaved", false, { source: "validation", force: true });
  }

  function handleChatNicknameKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    hideChatNicknameForm();
  }

  function renderChatFeedback() {
    const feedback = document.getElementById("chat-feedback");
    if (!feedback) return;
    const state = chatState.feedback;
    feedback.textContent = state.key ? t(state.key) : state.raw;
    feedback.classList.toggle("is-error", state.isError);
  }

  function setChatFeedback(message, isError = false, options = {}) {
    const source = options.source || "validation";
    const previousPriority = chatFeedbackPriority[chatState.feedback.source] ?? 0;
    const nextPriority = chatFeedbackPriority[source] ?? 0;
    if (!options.force && previousPriority > nextPriority) return false;
    chatState.feedback = { key: "", raw: String(message || ""), isError, source };
    renderChatFeedback();
    requestMobileFocusReveal("chat-feedback");
    return true;
  }

  function setChatFeedbackKey(key, isError = false, options = {}) {
    const source = options.source || "validation";
    const previousPriority = chatFeedbackPriority[chatState.feedback.source] ?? 0;
    const nextPriority = chatFeedbackPriority[source] ?? 0;
    if (!options.force && previousPriority > nextPriority) return false;
    chatState.feedback = { key, raw: "", isError, source };
    renderChatFeedback();
    requestMobileFocusReveal("chat-feedback");
    return true;
  }

  function clearChatFeedbackSources(...sources) {
    if (!sources.includes(chatState.feedback.source)) return;
    chatState.feedback = { key: "chatCooldownHint", raw: "", isError: false, source: "idle" };
    renderChatFeedback();
  }

  function setChatSendingState(sending, options = {}) {
    chatState.sending = sending;
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-message-input");
    const button = document.querySelector(".chat-send-button");
    form?.setAttribute("aria-busy", String(sending));
    if (button) {
      button.disabled = sending;
    }
    if (sending && options.keepInputFocus !== false && input && document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
  }

  function chatSyncStatusText(delay = chatState.pollDelay) {
    if (chatState.connectionState === "offline") {
      return t("chatSyncOffline");
    }
    if (chatState.connectionState === "reconnecting") {
      return t("chatSyncReconnecting");
    }
    if (delay >= 30000) {
      return t("chatSyncStatusSlow");
    }
    if (delay >= 15000) {
      return t("chatSyncStatusIdle");
    }
    return t("chatSyncStatusActive");
  }

  function updateChatSyncStatus(delay = chatState.pollDelay) {
    const status = document.getElementById("chat-sync-status");
    if (!status) {
      return;
    }
    status.textContent = chatSyncStatusText(delay);
    status.dataset.connectionState = chatState.connectionState;
    syncChatRetryButton();
  }

  function syncChatRetryButton() {
    const button = document.getElementById("chat-retry-button");
    if (!button) return;
    const needsRetry = !chatState.lastRefreshSucceeded;
    button.textContent = t("chatRetry");
    button.hidden = !needsRetry;
    button.disabled = chatState.loading
      || chatState.roomSwitching
      || chatState.connectionState === "offline";
    button.setAttribute("aria-busy", String(needsRetry && chatState.loading));
  }

  function updateChatCounter() {
    const input = document.getElementById("chat-message-input");
    const count = document.getElementById("chat-char-count");
    if (input && count) {
      count.textContent = String(Array.from(input.value).length);
    }
  }

  function handleChatDraftInput() {
    chatState.draftRevision += 1;
    currentChatRoomSession().draft = document.getElementById("chat-message-input")?.value || "";
    updateChatCounter();
  }

  function chatDistanceFromBottom(list = document.getElementById("chat-message-list")) {
    if (!list) return 0;
    return Math.max(0, Number(list.scrollHeight || 0) - Number(list.clientHeight || 0) - Number(list.scrollTop || 0));
  }

  function isChatNearBottom(list = document.getElementById("chat-message-list")) {
    return chatDistanceFromBottom(list) <= chatBottomThreshold;
  }

  function updateChatUnreadButton() {
    const session = currentChatRoomSession();
    const button = document.getElementById("chat-unread-button");
    const list = document.getElementById("chat-message-list");
    if (!button) return;
    button.hidden = session.unread <= 0;
    if (!button.hidden) {
      const label = formatChatCount("chatUnreadMessages", session.unread);
      button.textContent = label;
      button.setAttribute("aria-label", label);
    }
    list?.classList.toggle("has-unread", session.unread > 0);
  }

  function clearChatUnread() {
    const session = currentChatRoomSession();
    session.unread = 0;
    session.nearBottom = true;
    updateChatUnreadButton();
  }

  function scrollChatToBottom() {
    const list = document.getElementById("chat-message-list");
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    const session = currentChatRoomSession();
    session.scrollTop = list.scrollTop;
    session.hasScrollPosition = true;
    clearChatUnread();
  }

  function handleChatLogScroll() {
    const list = document.getElementById("chat-message-list");
    if (!list) return;
    const session = currentChatRoomSession();
    session.scrollTop = list.scrollTop;
    session.hasScrollPosition = true;
    session.nearBottom = isChatNearBottom(list);
    if (session.nearBottom && session.unread > 0) clearChatUnread();
  }

  function captureChatRoomUiState() {
    const session = currentChatRoomSession();
    const input = document.getElementById("chat-message-input");
    const list = document.getElementById("chat-message-list");
    if (input) session.draft = input.value;
    if (list) {
      session.scrollTop = list.scrollTop;
      session.hasScrollPosition = true;
      session.nearBottom = isChatNearBottom(list);
    }
  }

  function restoreChatRoomDraft() {
    const input = document.getElementById("chat-message-input");
    if (!input) return;
    input.value = currentChatRoomSession().draft;
    chatState.draftRevision += 1;
    updateChatCounter();
  }

  function restoreChatRoomScroll(options = {}) {
    const list = document.getElementById("chat-message-list");
    if (!list) return;
    const session = currentChatRoomSession();
    if (session.hasScrollPosition) {
      list.scrollTop = session.scrollTop;
    } else if (options.initial) {
      list.scrollTop = list.scrollHeight;
      session.scrollTop = list.scrollTop;
      session.hasScrollPosition = true;
      session.nearBottom = true;
    }
    session.nearBottom = isChatNearBottom(list);
    updateChatUnreadButton();
  }

  function announceChatBatch(key, count) {
    const live = document.getElementById("chat-live-summary");
    if (!live) return;
    chatState.liveSummary = { key, count };
    live.textContent = formatChatCount(key, count);
  }

  function handleChatAutoscrollChange() {
    const autoscroll = document.getElementById("chat-autoscroll");
    if (autoscroll?.checked && isChatNearBottom()) scrollChatToBottom();
  }

  async function initChatroom(scope = activeRouteScope("chatroom")) {
    if (!scope?.isActive()) return;
    chatState.connectionState = typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online";
    await ensureChatIdentity({ signal: scope.signal });
    if (!scope.isActive()) return;
    const input = document.getElementById("chat-message-input");
    const session = currentChatRoomSession();
    if (!session.draft && input?.value) session.draft = input.value;
    restoreChatRoomDraft();
    updateChatCounter();
    updateChatSyncStatus();
    renderChatFeedback();
    syncChatRoomUi();
    syncChatPrivateSafetyDisclosure();

    if (chatState.connectionState === "offline") {
      chatState.lastRefreshSucceeded = false;
      syncChatRetryButton();
      if (!chatState.initialized) {
        chatState.initialized = true;
        resetChatLog(t("chatWelcome"));
      }
      setChatFeedbackKey("chatOffline", true, { source: "network" });
      return;
    }

    if (!chatState.initialized) {
      chatState.initialized = true;
      resetChatLog(t("chatLoading"));
      await refreshChatMessages({ initial: true });
    } else {
      refreshChatMessages();
    }

    startChatPolling();
  }

  function startChatPolling() {
    if (chatState.pollTimer || !activeRouteScope("chatroom") || document.hidden || chatState.connectionState === "offline") {
      return;
    }
    scheduleChatPolling(5000);
  }

  function scheduleChatPolling(delay) {
    const scope = activeRouteScope("chatroom");
    if (!scope?.isActive() || document.hidden || chatState.connectionState === "offline") {
      stopChatPolling();
      return;
    }
    chatState.pollDelay = delay;
    updateChatSyncStatus(delay);
    if (chatState.pollTimer) {
      scope.clearTimeout(chatState.pollTimer);
    }
    chatState.pollTimer = scope.setTimeout(async () => {
      chatState.pollTimer = null;
      if (!scope.isActive() || document.hidden) return;
      const newCount = await refreshChatMessages();
      if (scope.isActive()) scheduleChatPolling(nextChatPollDelay(newCount));
    }, delay);
  }

  function stopChatPolling() {
    const scope = activeRouteScope("chatroom");
    if (chatState.pollTimer) {
      if (scope) scope.clearTimeout(chatState.pollTimer);
      else window.clearTimeout(chatState.pollTimer);
    }
    chatState.pollTimer = null;
  }

  function nextChatPollDelay(newCount) {
    if (newCount > 0) {
      chatState.idlePolls = 0;
      return 5000;
    }
    chatState.idlePolls += 1;
    if (chatState.idlePolls >= 3) {
      return 30000;
    }
    return 15000;
  }

  function resetChatLog(message) {
    const list = document.getElementById("chat-message-list");
    if (!list) {
      return;
    }
    list.replaceChildren();
    appendChatSystemMessage(message || t("chatWelcome"));
    chatState.lastMessageId = "";
    chatState.hasLoadedInitial = false;
    chatState.idlePolls = 0;
    chatState.seenMessageIds.clear();
    currentChatRoomSession().unread = 0;
    updateChatUnreadButton();
  }

  function appendChatSystemMessage(message) {
    const list = document.getElementById("chat-message-list");
    if (!list) {
      return;
    }
    const row = document.createElement("div");
    row.className = "chat-system-message";
    row.textContent = `— ${message} —`;
    list.appendChild(row);
  }

  async function refreshChatMessages(options = {}) {
    if (chatState.loading) {
      return 0;
    }
    chatState.loading = true;
    syncChatRetryButton();
    const roomRevision = chatState.roomRevision;
    let appendedCount = 0;
    try {
      const shouldRefreshRecentMessages = !options.initial && chatState.hasLoadedInitial && !chatState.lastMessageId;
      const params = new URLSearchParams({
        limit: String(shouldRefreshRecentMessages ? chatUnanchoredRefreshLimit : chatInitialMessageLimit)
      });
      appendChatRoomParam(params);
      if (!options.initial && chatState.lastMessageId) {
        params.set("after", chatState.lastMessageId);
      }
      const payload = await chatApi(`/api/chat/messages?${params.toString()}`, {
        signal: activeRouteScope("chatroom")?.signal
      });
      if (roomRevision !== chatState.roomRevision) {
        return 0;
      }
      if (options.initial) {
        resetChatLog(t("chatWelcome"));
      }
      const messages = await prepareChatMessagesForDisplay(payload.messages || []);
      if (roomRevision !== chatState.roomRevision) {
        return 0;
      }
      appendedCount = appendChatMessages(messages, { initial: Boolean(options.initial) });
      chatState.hasLoadedInitial = true;
      chatState.lastRefreshSucceeded = true;
      if (chatState.connectionState === "reconnecting") {
        chatState.connectionState = "online";
      }
      clearChatFeedbackSources("sync", "network");
      updateChatSyncStatus();
      if (options.initial) {
        restoreChatRoomScroll({ initial: true });
        announceChatBatch("chatHistoryLoaded", appendedCount);
      } else if (appendedCount > 0) {
        announceChatBatch("chatNewMessages", appendedCount);
      }
    } catch (error) {
      if (isAbortError(error)) {
        return 0;
      }
      chatState.lastRefreshSucceeded = false;
      chatState.connectionState = typeof navigator !== "undefined" && navigator.onLine === false
        ? "offline"
        : "reconnecting";
      updateChatSyncStatus();
      if (options.initial) {
        resetChatLog(t("chatLoadFailed"));
      }
      setChatFeedbackKey("chatLoadFailed", true, { source: "sync" });
    } finally {
      if (roomRevision === chatState.roomRevision) {
        chatState.loading = false;
        syncChatRetryButton();
      }
    }
    return appendedCount;
  }

  function appendChatMessages(messages, options = {}) {
    const list = document.getElementById("chat-message-list");
    if (!list || !messages.length) {
      return 0;
    }

    const session = currentChatRoomSession();
    const autoscroll = document.getElementById("chat-autoscroll");
    const shouldFollow = !options.initial && (!autoscroll || autoscroll.checked) && isChatNearBottom(list);
    let appendedCount = 0;
    messages.forEach((message) => {
      if (!message.message_id || chatState.seenMessageIds.has(message.message_id)) {
        return;
      }
      chatState.seenMessageIds.add(message.message_id);
      chatState.lastMessageId = message.message_id;
      list.appendChild(createChatMessageNode(message));
      appendedCount += 1;
    });

    if (options.initial) {
      return appendedCount;
    }
    if (shouldFollow) {
      scrollChatToBottom();
    } else if (appendedCount > 0) {
      session.unread += appendedCount;
      session.nearBottom = false;
      updateChatUnreadButton();
    }
    return appendedCount;
  }

  function createChatMessageNode(message) {
    const own = message.visitor_id === chatState.visitorId;
    const item = document.createElement("article");
    item.className = `chat-message${own ? " is-own" : ""}`;

    const avatar = document.createElement("img");
    avatar.className = "chat-message-avatar";
    avatar.src = "/assets/images/icon-chatroom-clean.png?v=20260718-resource-icons-layout-r1";
    avatar.alt = "";
    avatar.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "chat-message-body";

    const meta = document.createElement("div");
    meta.className = "chat-message-meta";

    const name = document.createElement("strong");
    name.textContent = String(message.nickname || "");

    const time = document.createElement("time");
    time.dateTime = message.created_at || "";
    time.textContent = formatChatTime(message.created_at);

    meta.append(name, time);

    const bubble = document.createElement("p");
    bubble.className = "chat-bubble";
    bubble.textContent = String(message.content || "");

    body.append(meta, bubble);
    item.append(avatar, body);
    return item;
  }

  function formatChatTime(value) {
    const date = new Date(normalizeDateInput(value));
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const now = new Date();
    const sameDay = date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
    return formatZonedDateTime(value, { includeDate: !sameDay, includeTimeZone: false });
  }

  async function submitChatMessage(event) {
    event.preventDefault();
    if (chatState.sending) {
      setChatFeedbackKey("chatSending", false, { source: "send", force: true });
      return;
    }

    const input = document.getElementById("chat-message-input");
    const submittedDraft = input.value;
    const submittedDraftRevision = chatState.draftRevision;
    const contentText = input.value.trim();
    const contentLength = Array.from(contentText).length;
    if (!contentText) {
      setChatFeedbackKey("chatEmptyMessage", true, { source: "validation", force: true });
      return;
    }
    if (contentLength > 300) {
      setChatFeedbackKey("chatTooLong", true, { source: "validation", force: true });
      return;
    }
    if (Date.now() - chatState.lastSentAt < chatCooldownMs) {
      setChatFeedbackKey("chatCooldown", true, { source: "validation", force: true });
      return;
    }
    const sendAttempt = chatSendAttempt(submittedDraft);

    try {
      setChatSendingState(true, { keepInputFocus: true });
      setChatFeedbackKey("chatSending", false, { source: "send", force: true });
      await ensureChatIdentity({ signal: activeRouteScope("chatroom")?.signal });
      const body = {
        visitorId: chatState.visitorId,
        nickname: chatState.nickname,
        clientRequestId: sendAttempt.requestId
      };
      if (isPrivateChatRoomActive()) {
        body.room = chatState.roomKey;
        body.encryptedContent = await encryptChatContent(contentText);
      } else {
        body.content = contentText;
      }
      const payload = await chatApi("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify(body),
        signal: activeRouteScope("chatroom")?.signal
      });
      chatState.lastSentAt = Date.now();
      safeStorageSet(chatStorageKeys.lastSentAt, String(chatState.lastSentAt));
      if (currentChatRoomSession().sendAttempt === sendAttempt) {
        currentChatRoomSession().sendAttempt = null;
      }
      if (chatState.draftRevision === submittedDraftRevision && input.value === submittedDraft) {
        input.value = "";
        currentChatRoomSession().draft = "";
      }
      updateChatCounter();
      setChatFeedbackKey("chatSent", false, { source: "send", force: true });
      const messages = await prepareChatMessagesForDisplay(payload.message ? [payload.message] : []);
      appendChatMessages(messages);
      chatState.idlePolls = 0;
      await refreshChatMessages({ immediate: true });
      scheduleChatPolling(5000);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      if (error.code === "nickname_taken") {
        setChatFeedbackKey("chatNicknameTaken", true, { source: "send", force: true });
        const nickname = await fetchAvailableChatNickname();
        chatState.nickname = nickname;
        safeStorageSet(chatStorageKeys.nickname, nickname);
        updateChatNicknameDisplay();
        return;
      }
      setChatFeedback(error.message || t("chatLoadFailed"), true, { source: "send", force: true });
    } finally {
      setChatSendingState(false);
    }
  }

  async function editChatNickname() {
    return showChatNicknameForm();
  }

  async function chatApi(path, options = {}) {
    const response = await routeFetch("chatroom", path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `HTTP ${response.status}`);
      error.code = payload.code || "";
      throw error;
    }
    return payload;
  }

  function handleChatRoomToggleClick() {
    return handleChatRoomToggle().catch((error) => {
      if (!isAbortError(error)) {
        setChatFeedback(error.message || t("chatLoadFailed"), true, { source: "room", force: true });
      }
    });
  }

  async function retryChatMessages() {
    const scope = activeRouteScope("chatroom");
    if (!scope?.isActive() || chatState.loading || chatState.roomSwitching) {
      return;
    }
    const retryButton = document.getElementById("chat-retry-button");
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      chatState.connectionState = "offline";
      updateChatSyncStatus();
      setChatFeedbackKey("chatOffline", true, { source: "network", force: true });
      retryButton?.focus({ preventScroll: true });
      return;
    }
    chatState.connectionState = "reconnecting";
    updateChatSyncStatus();
    setChatFeedbackKey("chatReconnecting", false, { source: "network", force: true });
    chatState.idlePolls = 0;
    const newCount = await refreshChatMessages({ initial: !chatState.hasLoadedInitial });
    if (!scope.isActive()) return;
    if (chatState.lastRefreshSucceeded) {
      chatState.connectionState = "online";
      updateChatSyncStatus();
      setChatFeedbackKey("chatReconnectSuccess", false, { source: "network", force: true });
      scheduleChatPolling(nextChatPollDelay(newCount || 0));
      document.getElementById("chat-message-input")?.focus({ preventScroll: true });
      return;
    }
    chatState.connectionState = "reconnecting";
    updateChatSyncStatus();
    setChatFeedbackKey("chatLoadFailed", true, { source: "network", force: true });
    scheduleChatPolling(15000);
    retryButton?.focus({ preventScroll: true });
  }

  function handleChatVisibilityChange() {
    if (document.hidden || !activeRouteScope("chatroom")) {
      stopChatPolling();
      return;
    }
    if (chatState.connectionState === "offline") return;
    chatState.idlePolls = 0;
    refreshChatMessages().then((newCount) => {
      if (activeRouteScope("chatroom")) {
        scheduleChatPolling(nextChatPollDelay(newCount || 0));
      }
    });
  }

  function handleChatOffline() {
    chatState.connectionState = "offline";
    chatState.lastRefreshSucceeded = false;
    stopChatPolling();
    updateChatSyncStatus();
    setChatFeedbackKey("chatOffline", true, { source: "network" });
  }

  async function handleChatOnline() {
    if (!activeRouteScope("chatroom")) return;
    chatState.connectionState = "reconnecting";
    updateChatSyncStatus();
    setChatFeedbackKey("chatReconnecting", false, { source: "network" });
    chatState.idlePolls = 0;
    const newCount = await refreshChatMessages({ initial: !chatState.hasLoadedInitial });
    if (!activeRouteScope("chatroom")) return;
    if (chatState.lastRefreshSucceeded) {
      chatState.connectionState = "online";
      updateChatSyncStatus();
      if (chatState.feedback.source === "network" || chatState.feedback.source === "sync") {
        setChatFeedbackKey("chatReconnectSuccess", false, { source: "network", force: true });
      }
      scheduleChatPolling(nextChatPollDelay(newCount || 0));
    } else {
      chatState.connectionState = "reconnecting";
      updateChatSyncStatus();
      setChatFeedbackKey("chatLoadFailed", true, { source: "network", force: true });
      scheduleChatPolling(15000);
    }
  }

  function enter(scope) {
    scope.listen(document.getElementById("chat-form"), "submit", submitChatMessage);
    scope.listen(document.getElementById("chat-message-input"), "input", handleChatDraftInput);
    scope.listen(document.getElementById("chat-edit-nickname"), "click", editChatNickname);
    scope.listen(document.getElementById("chat-nickname-form"), "submit", submitChatNickname);
    scope.listen(document.getElementById("chat-nickname-form"), "keydown", handleChatNicknameKeydown);
    scope.listen(document.getElementById("chat-nickname-cancel"), "click", hideChatNicknameForm);
    scope.listen(document.getElementById("chat-room-toggle"), "click", handleChatRoomToggleClick);
    scope.listen(document.getElementById("chat-private-room-form"), "submit", enterChatPrivateRoom);
    scope.listen(document.getElementById("chat-private-room-cancel"), "click", hideChatPrivateRoomForm);
    scope.listen(document.getElementById("chat-message-list"), "scroll", handleChatLogScroll, { passive: true });
    scope.listen(document.getElementById("chat-unread-button"), "click", scrollChatToBottom);
    scope.listen(document.getElementById("chat-retry-button"), "click", retryChatMessages);
    scope.listen(document.getElementById("chat-autoscroll"), "change", handleChatAutoscrollChange);
    scope.listen(document.getElementById("chat-private-password"), "input", handleChatPrivatePasswordInput);
    scope.listen(document, "visibilitychange", handleChatVisibilityChange);
    scope.listen(window, "offline", handleChatOffline);
    scope.listen(window, "online", handleChatOnline);
    return initChatroom(scope);
  }

  function leave() {
    captureChatRoomUiState();
    stopChatPolling();
    chatState.loading = false;
    chatState.roomRevision += 1;
    setChatRoomSwitching(false);
    hideChatPrivateRoomForm({ restoreFocus: false, force: true });
    hideChatNicknameForm({ restoreFocus: false });
  }

  function syncLanguage() {
    updateChatSyncStatus();
    syncChatRoomUi();
    syncChatPrivateSafetyDisclosure();
    const privatePasswordError = document.getElementById("chat-private-password-error");
    if (privatePasswordError?.dataset.errorKey) {
      privatePasswordError.textContent = t(privatePasswordError.dataset.errorKey);
    }
    renderChatNicknameError();
    renderChatFeedback();
    syncChatRetryButton();
    syncChatRoomBusyState();
    updateChatUnreadButton();
    if (chatState.liveSummary.key) {
      const live = document.getElementById("chat-live-summary");
      if (live) live.textContent = formatChatCount(chatState.liveSummary.key, chatState.liveSummary.count);
    }
  }

  return Object.freeze({ enter, leave, syncLanguage, hideChatPrivateRoomForm });
}
