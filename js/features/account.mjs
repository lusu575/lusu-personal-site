const ACCOUNT_MODES = Object.freeze(["login", "register"]);
export const ACCOUNT_REQUEST_TIMEOUT_MS = 8000;

export function normalizeAccountMode(value) {
  return ACCOUNT_MODES.includes(value) ? value : "login";
}

export function validateAccountDraft({ mode, email, password, confirmPassword }) {
  const normalizedMode = normalizeAccountMode(mode);
  const normalizedEmail = String(email || "").trim();
  const normalizedPassword = String(password || "");
  const normalizedConfirmation = String(confirmPassword || "");
  const errors = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalizedEmail) || normalizedEmail.length > 254) {
    errors.email = "accountErrorInvalidEmail";
  }
  if (normalizedPassword.length < 8 || normalizedPassword.length > 128) {
    errors.password = "accountErrorPasswordLength";
  }
  if (normalizedMode === "register" && normalizedConfirmation !== normalizedPassword) {
    errors.confirmPassword = "accountErrorPasswordMismatch";
  }

  return errors;
}

export function accountRequestFailure(error, mode, lastField = "password") {
  const normalizedMode = normalizeAccountMode(mode);
  if (error?.status === 429 || error?.code === "RATE_LIMITED") {
    return { key: "accountErrorRateLimited", field: normalizedMode === "register" ? "email" : "password" };
  }
  if (error?.status === 401 && normalizedMode === "login") {
    return { key: "accountErrorInvalidCredentials", field: "password" };
  }
  if (normalizedMode === "register" && (error?.code === "REGISTRATION_FAILED" || error?.status === 409)) {
    return { key: "accountErrorRegistrationFailed", field: "email" };
  }
  const recoverField = ["email", "password", "confirmPassword"].includes(lastField)
    ? lastField
    : "password";
  if (Number(error?.status || 0) >= 500) {
    return { key: "accountErrorServiceUnavailable", field: recoverField };
  }
  if (Number(error?.status || 0) === 0) {
    return { key: "accountErrorNetwork", field: recoverField };
  }
  return {
    key: "accountErrorRequest",
    field: recoverField
  };
}

export async function requestAccountJson(fetchImpl, path, options = {}, timeoutMs = ACCOUNT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  let timedOut = false;
  const forwardAbort = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) {
    forwardAbort();
  } else {
    upstreamSignal?.addEventListener?.("abort", forwardAbort, { once: true });
  }
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, Number(timeoutMs) || ACCOUNT_REQUEST_TIMEOUT_MS));

  try {
    const response = await fetchImpl(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(payload.error || `HTTP ${response.status}`), {
        status: response.status,
        code: payload.code || "",
        payload
      });
    }
    return payload;
  } catch (cause) {
    if (timedOut) {
      throw Object.assign(new Error("Account request timed out"), {
        status: 0,
        code: "ACCOUNT_TIMEOUT",
        cause
      });
    }
    if (upstreamSignal?.aborted || cause?.name === "AbortError") {
      throw cause;
    }
    if (Number.isFinite(cause?.status)) {
      throw cause;
    }
    throw Object.assign(new Error("Account request failed"), { status: 0, cause });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener?.("abort", forwardAbort);
  }
}

export function createAccountFeature({
  t,
  requestMobileFocusReveal,
  cancelSurfaceClose,
  runSurfaceClose,
  fetchImpl,
  requestTimeoutMs = ACCOUNT_REQUEST_TIMEOUT_MS
}) {
  let authUser = null;
  let authState = "checking";
  let accountMode = "login";
  let accountSubmitting = "";
  let accountPopoverReturnFocus = null;
  let accountLastEditingField = "password";
  let accountFocusRequest = 0;
  let sessionRevision = 0;
  let initRequestId = 0;
  let accountStatus = { key: "accountChecking", raw: "", error: false };
  const refs = {};

  async function accountApi(path, options = {}) {
    return requestAccountJson(fetchImpl, path, options, requestTimeoutMs);
  }

  function appendTextButton(parent, { className, dataset = {}, type = "button" } = {}) {
    const button = document.createElement("button");
    button.type = type;
    button.className = className || "";
    Object.entries(dataset).forEach(([name, value]) => {
      button.dataset[name] = value;
    });
    parent.appendChild(button);
    return button;
  }

  function createField(form, {
    name,
    type,
    autocomplete,
    labelKey,
    placeholderKey,
    minLength = 0,
    maxLength = 0
  }) {
    const group = document.createElement("div");
    group.className = "account-field";
    group.dataset.accountField = name;

    const label = document.createElement("label");
    label.htmlFor = `account-${name}`;

    const controlRow = document.createElement("div");
    controlRow.className = "account-control-row";
    const input = document.createElement("input");
    input.id = `account-${name}`;
    input.name = name;
    input.type = type;
    input.autocomplete = autocomplete;
    input.required = true;
    input.dataset.accountInput = name;
    input.dataset.labelKey = labelKey;
    input.dataset.placeholderKey = placeholderKey;
    if (minLength) input.minLength = minLength;
    if (maxLength) input.maxLength = maxLength;
    input.setAttribute("aria-describedby", `account-mode-hint account-form-note`);

    const error = document.createElement("p");
    error.id = `account-${name}-error`;
    error.className = "account-field-error";
    error.hidden = true;

    label.dataset.copyKey = labelKey;
    controlRow.appendChild(input);
    group.append(label, controlRow, error);
    form.appendChild(group);
    return { group, label, controlRow, input, error };
  }

  function ensureAccountDom() {
    const widget = document.getElementById("account-widget");
    if (!widget || (refs.widget === widget && refs.popover?.isConnected)) {
      return widget;
    }

    refs.widget = widget;
    refs.toggle = appendTextButton(widget, { className: "account-button", dataset: { accountToggle: "" } });
    refs.toggle.setAttribute("aria-controls", "account-popover");
    refs.toggle.setAttribute("aria-expanded", "false");
    refs.toggleText = document.createElement("span");
    refs.toggle.appendChild(refs.toggleText);

    refs.popover = document.createElement("div");
    refs.popover.className = "account-popover";
    refs.popover.id = "account-popover";
    refs.popover.setAttribute("role", "group");
    refs.popover.setAttribute("aria-labelledby", "account-popover-title");
    refs.popover.hidden = true;

    const header = document.createElement("header");
    header.className = "account-popover-header";
    refs.title = document.createElement("strong");
    refs.title.id = "account-popover-title";
    refs.title.tabIndex = -1;
    refs.close = appendTextButton(header, { className: "account-close-button", dataset: { accountClose: "" } });
    refs.close.textContent = "\u00d7";
    header.prepend(refs.title);

    refs.form = document.createElement("form");
    refs.form.className = "account-form";
    refs.form.id = "account-form";
    refs.form.noValidate = true;
    refs.form.dataset.accountMode = accountMode;

    refs.modeSwitch = document.createElement("div");
    refs.modeSwitch.className = "account-mode-switch";
    refs.modeSwitch.setAttribute("role", "group");
    refs.loginMode = appendTextButton(refs.modeSwitch, {
      className: "account-mode-button",
      dataset: { accountMode: "login" }
    });
    refs.registerMode = appendTextButton(refs.modeSwitch, {
      className: "account-mode-button",
      dataset: { accountMode: "register" }
    });
    refs.modeHint = document.createElement("p");
    refs.modeHint.id = "account-mode-hint";
    refs.modeHint.className = "account-mode-hint";
    refs.form.append(refs.modeSwitch, refs.modeHint);

    const emailField = createField(refs.form, {
      name: "email",
      type: "email",
      autocomplete: "email",
      labelKey: "accountEmailLabel",
      placeholderKey: "accountEmailPlaceholder",
      maxLength: 254
    });
    const passwordField = createField(refs.form, {
      name: "password",
      type: "password",
      autocomplete: "current-password",
      labelKey: "accountPasswordLabel",
      placeholderKey: "accountPasswordPlaceholder",
      minLength: 8,
      maxLength: 128
    });
    const confirmField = createField(refs.form, {
      name: "confirmPassword",
      type: "password",
      autocomplete: "new-password",
      labelKey: "accountConfirmPasswordLabel",
      placeholderKey: "accountConfirmPasswordPlaceholder",
      minLength: 8,
      maxLength: 128
    });

    refs.emailGroup = emailField.group;
    refs.emailLabel = emailField.label;
    refs.email = emailField.input;
    refs.emailError = emailField.error;
    refs.passwordGroup = passwordField.group;
    refs.passwordLabel = passwordField.label;
    refs.password = passwordField.input;
    refs.passwordError = passwordField.error;
    refs.confirmGroup = confirmField.group;
    refs.confirmLabel = confirmField.label;
    refs.confirmPassword = confirmField.input;
    refs.confirmPasswordError = confirmField.error;

    refs.passwordToggle = appendTextButton(passwordField.controlRow, {
      className: "account-password-toggle",
      dataset: { accountPasswordToggle: "password" }
    });
    refs.passwordToggle.setAttribute("aria-controls", refs.password.id);
    refs.confirmPasswordToggle = appendTextButton(confirmField.controlRow, {
      className: "account-password-toggle",
      dataset: { accountPasswordToggle: "confirmPassword" }
    });
    refs.confirmPasswordToggle.setAttribute("aria-controls", refs.confirmPassword.id);

    refs.formActions = document.createElement("div");
    refs.formActions.className = "account-actions account-form-actions";
    refs.submit = appendTextButton(refs.formActions, {
      className: "account-button account-primary-action",
      type: "submit",
      dataset: { accountSubmit: "" }
    });
    refs.form.appendChild(refs.formActions);

    refs.signedIn = document.createElement("section");
    refs.signedIn.className = "account-signed-in";
    refs.signedIn.hidden = true;
    refs.signedEmail = document.createElement("p");
    refs.signedEmail.className = "account-signed-email";
    const signedActions = document.createElement("div");
    signedActions.className = "account-actions";
    refs.logout = appendTextButton(signedActions, {
      className: "account-button account-danger-action",
      dataset: { accountLogout: "" }
    });
    refs.signedIn.append(refs.signedEmail, signedActions);

    refs.status = document.createElement("p");
    refs.status.className = "account-note account-status";
    refs.status.id = "account-form-note";
    refs.status.setAttribute("role", "status");
    refs.status.setAttribute("aria-live", "polite");
    refs.status.setAttribute("aria-atomic", "true");

    refs.recoveryActions = document.createElement("div");
    refs.recoveryActions.className = "account-actions account-recovery-actions";
    refs.retryCheck = appendTextButton(refs.recoveryActions, {
      className: "account-button account-retry-action",
      dataset: { accountRetryCheck: "" }
    });
    refs.retryCheck.hidden = true;

    refs.popover.append(header, refs.form, refs.signedIn, refs.status, refs.recoveryActions);
    widget.appendChild(refs.popover);

    refs.form.addEventListener("submit", submitAccountForm);
    refs.loginMode.addEventListener("click", () => setAccountMode("login", { focus: true }));
    refs.registerMode.addEventListener("click", () => setAccountMode("register", { focus: true }));
    refs.close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAccountPopover();
    });
    refs.logout.addEventListener("click", logoutAccount);
    refs.retryCheck.addEventListener("click", retryAccountCheck);
    [refs.email, refs.password, refs.confirmPassword].forEach((input) => {
      input.addEventListener("focus", () => {
        accountLastEditingField = input.name;
      });
      input.addEventListener("input", () => {
        clearFieldError(input.name);
        if (input === refs.password) clearFieldError("confirmPassword");
      });
    });
    [refs.passwordToggle, refs.confirmPasswordToggle].forEach((button) => {
      button.addEventListener("click", () => togglePasswordVisibility(button.dataset.accountPasswordToggle));
    });

    return widget;
  }

  function statusMessage() {
    if (accountStatus.raw) return accountStatus.raw;
    return accountStatus.key ? t(accountStatus.key) : "";
  }

  function setAccountStatus(key = "", options = {}) {
    accountStatus = {
      key,
      raw: options.raw || "",
      error: Boolean(options.error)
    };
    syncAccountStatus();
  }

  function syncAccountStatus() {
    if (!refs.status) return;
    const message = statusMessage();
    refs.status.textContent = message;
    refs.status.hidden = !message;
    refs.status.classList.toggle("is-error", accountStatus.error);
    refs.status.setAttribute("aria-live", "polite");
    requestMobileFocusReveal(accountStatus.error ? "account-status-error" : "account-status");
  }

  function syncPasswordToggle(button, input) {
    if (!button || !input) return;
    const isVisible = input.type === "text";
    const label = t(isVisible ? "accountHidePassword" : "accountShowPassword");
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(isVisible));
  }

  function syncAccountCopy() {
    refs.title.textContent = t("accountTitle");
    refs.close.setAttribute("aria-label", t("accountClose"));
    refs.close.title = t("accountClose");
    refs.modeSwitch.setAttribute("aria-label", t("accountModeSelectorLabel"));
    refs.loginMode.textContent = t("accountLogin");
    refs.registerMode.textContent = t("accountRegister");
    refs.emailLabel.textContent = t("accountEmailLabel");
    refs.passwordLabel.textContent = t("accountPasswordLabel");
    refs.confirmLabel.textContent = t("accountConfirmPasswordLabel");
    refs.email.placeholder = t("accountEmailPlaceholder");
    refs.password.placeholder = t("accountPasswordPlaceholder");
    refs.confirmPassword.placeholder = t("accountConfirmPasswordPlaceholder");
    refs.signedEmail.textContent = t("accountLoggedIn");
    refs.logout.textContent = t("accountLogout");
    refs.retryCheck.textContent = t("accountCheckRetry");
    refs.toggleText.textContent = authUser ? t("accountTitle") : t("accountLogin");
    refs.toggle.setAttribute("aria-label", authUser ? t("accountTitle") : t("accountLogin"));
    refs.toggle.dataset.analyticsLabel = authUser ? "account:signed-in-toggle" : "account:login-toggle";
    refs.toggle.classList.toggle("signed-in", Boolean(authUser));
    syncPasswordToggle(refs.passwordToggle, refs.password);
    syncPasswordToggle(refs.confirmPasswordToggle, refs.confirmPassword);
    [refs.emailError, refs.passwordError, refs.confirmPasswordError].forEach((error) => {
      if (error?.dataset.errorKey) error.textContent = t(error.dataset.errorKey);
    });
    syncAccountStatus();
    syncAccountRecoveryState();
  }

  function syncAccountMode() {
    refs.form.dataset.accountMode = accountMode;
    const registering = accountMode === "register";
    refs.loginMode.classList.toggle("is-active", !registering);
    refs.registerMode.classList.toggle("is-active", registering);
    refs.loginMode.setAttribute("aria-pressed", String(!registering));
    refs.registerMode.setAttribute("aria-pressed", String(registering));
    refs.modeHint.textContent = t(registering ? "accountRegisterModeHint" : "accountLoginModeHint");
    refs.confirmGroup.hidden = !registering;
    refs.confirmPassword.required = registering;
    refs.password.autocomplete = registering ? "new-password" : "current-password";
    refs.submit.textContent = t(registering ? "accountRegister" : "accountLogin");
    if (!registering) clearFieldError("confirmPassword");
  }

  function syncAccountView() {
    if (!ensureAccountDom()) return;
    const signedIn = Boolean(authUser);
    refs.form.hidden = signedIn;
    refs.signedIn.hidden = !signedIn;
    refs.popover.dataset.accountState = signedIn ? "signed-in" : authState;
    syncAccountMode();
    syncAccountCopy();
    syncAccountBusyState();
    syncAccountPopoverState();
  }

  function renderAccountWidget(message = "") {
    if (message) setAccountStatus("", { raw: message });
    syncAccountView();
  }

  function setAccountMode(mode, options = {}) {
    accountMode = normalizeAccountMode(mode);
    if (!ensureAccountDom()) return;
    if (options.resetErrors !== false) clearAllFieldErrors();
    if (options.resetStatus !== false) setAccountStatus("accountGuestNote");
    syncAccountMode();
    syncAccountCopy();
    if (options.focus) {
      refs.email.focus({ preventScroll: true });
      requestMobileFocusReveal("account-mode-focus");
    }
  }

  function togglePasswordVisibility(fieldName) {
    const input = fieldName === "confirmPassword" ? refs.confirmPassword : refs.password;
    const button = fieldName === "confirmPassword" ? refs.confirmPasswordToggle : refs.passwordToggle;
    if (!input || !button) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.type = input.type === "password" ? "text" : "password";
    syncPasswordToggle(button, input);
    input.focus({ preventScroll: true });
    if (Number.isInteger(start) && Number.isInteger(end)) input.setSelectionRange(start, end);
  }

  function fieldRefs(name) {
    if (name === "email") return { input: refs.email, error: refs.emailError };
    if (name === "confirmPassword") return { input: refs.confirmPassword, error: refs.confirmPasswordError };
    return { input: refs.password, error: refs.passwordError };
  }

  function clearFieldError(name) {
    const { input, error } = fieldRefs(name);
    if (!input || !error) return;
    error.hidden = true;
    error.textContent = "";
    delete error.dataset.errorKey;
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-errormessage");
  }

  function setFieldError(name, key) {
    const { input, error } = fieldRefs(name);
    if (!input || !error) return;
    error.textContent = t(key);
    error.dataset.errorKey = key;
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-errormessage", error.id);
  }

  function clearAllFieldErrors() {
    ["email", "password", "confirmPassword"].forEach(clearFieldError);
  }

  function applyValidationErrors(errors) {
    clearAllFieldErrors();
    const orderedFields = ["email", "password", "confirmPassword"];
    orderedFields.forEach((field) => {
      if (errors[field]) setFieldError(field, errors[field]);
    });
    const firstField = orderedFields.find((field) => errors[field]);
    if (firstField) {
      const { input } = fieldRefs(firstField);
      input.focus({ preventScroll: true });
      requestMobileFocusReveal("account-validation-error-focus");
    }
    return firstField;
  }

  async function initAccountWidget() {
    syncAccountView();
    const requestId = ++initRequestId;
    const revision = sessionRevision;
    authState = "checking";
    setAccountStatus("accountChecking");
    syncAccountView();
    try {
      const payload = await accountApi("/api/auth/me");
      if (requestId !== initRequestId || revision !== sessionRevision) return;
      authUser = payload.user || null;
      authState = authUser ? "signed-in" : "guest";
      setAccountStatus(authUser ? "" : "accountGuestNote");
      syncAccountView();
    } catch (error) {
      if (requestId !== initRequestId || revision !== sessionRevision) return;
      authState = "unavailable";
      setAccountStatus(error?.code === "ACCOUNT_TIMEOUT" ? "accountCheckTimeout" : "accountUnavailable", { error: true });
      syncAccountView();
    }
  }

  async function retryAccountCheck() {
    if (authState === "checking") return;
    const retryButton = refs.retryCheck;
    const activeBeforeRetry = document.activeElement;
    const preserveEditingFocus = refs.popover?.contains(activeBeforeRetry)
      && activeBeforeRetry !== retryButton;
    await initAccountWidget();
    if (!refs.popover || refs.popover.hidden) return;
    if (preserveEditingFocus
      && activeBeforeRetry?.isConnected
      && !activeBeforeRetry.disabled
      && !activeBeforeRetry.closest?.("[hidden]")) {
      activeBeforeRetry.focus({ preventScroll: true });
      return;
    }
    const target = authState === "unavailable"
      ? retryButton
      : authUser
        ? refs.logout
        : refs.email;
    target?.focus?.({ preventScroll: true });
    requestMobileFocusReveal("account-retry-focus");
  }

  async function submitAccountForm(event) {
    event.preventDefault();
    if (accountSubmitting) return;
    const mode = accountMode;
    const errors = validateAccountDraft({
      mode,
      email: refs.email.value,
      password: refs.password.value,
      confirmPassword: refs.confirmPassword.value
    });
    if (Object.keys(errors).length) {
      applyValidationErrors(errors);
      setAccountStatus(errors.email || errors.password || errors.confirmPassword, { error: true });
      return;
    }

    const requestRevision = ++sessionRevision;
    const editingField = accountLastEditingField;
    clearAllFieldErrors();
    setAccountSubmitting(mode);
    setAccountStatus(mode === "register" ? "accountBusyRegister" : "accountBusyLogin");
    try {
      const payload = await accountApi(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          email: refs.email.value.trim(),
          password: refs.password.value
        })
      });
      if (requestRevision !== sessionRevision) return;
      authUser = payload.user || null;
      authState = "signed-in";
      refs.password.value = "";
      refs.confirmPassword.value = "";
      refs.password.type = "password";
      refs.confirmPassword.type = "password";
      setAccountStatus("");
      syncAccountView();
      openAccountPopover({ focus: "status" });
      window.dispatchEvent(new CustomEvent("lusu:accountchange", {
        detail: { signedIn: true, source: mode }
      }));
    } catch (error) {
      if (requestRevision !== sessionRevision) return;
      const failure = accountRequestFailure(error, mode, editingField);
      setFieldError(failure.field, failure.key);
      setAccountStatus(failure.key, { error: true });
      openAccountPopover({ focus: "error" });
      const { input } = fieldRefs(failure.field);
      input.focus({ preventScroll: true });
      requestMobileFocusReveal("account-form-error-focus");
    } finally {
      if (requestRevision === sessionRevision) setAccountSubmitting("");
    }
  }

  async function logoutAccount() {
    if (accountSubmitting || !authUser) return;
    const requestRevision = ++sessionRevision;
    setAccountSubmitting("logout");
    setAccountStatus("accountBusyLogout");
    try {
      await accountApi("/api/auth/logout", { method: "POST", body: "{}" });
      if (requestRevision !== sessionRevision) return;
      authUser = null;
      authState = "guest";
      accountMode = "login";
      setAccountStatus("accountLoggedOut");
      syncAccountView();
      openAccountPopover({ focus: "status" });
      window.dispatchEvent(new CustomEvent("lusu:accountchange", {
        detail: { signedIn: false, source: "logout" }
      }));
    } catch {
      if (requestRevision !== sessionRevision) return;
      setAccountStatus("accountLogoutFailed", { error: true });
      syncAccountView();
      openAccountPopover({ focus: "status" });
      refs.logout.focus({ preventScroll: true });
      requestMobileFocusReveal("account-logout-error-focus");
    } finally {
      if (requestRevision === sessionRevision) setAccountSubmitting("");
    }
  }

  function setAccountSubmitting(operation) {
    accountSubmitting = operation || "";
    syncAccountBusyState();
  }

  function syncAccountBusyState() {
    if (!refs.form) return;
    const busy = Boolean(accountSubmitting);
    refs.form.setAttribute("aria-busy", String(busy));
    refs.signedIn.setAttribute("aria-busy", String(busy));
    [
      refs.loginMode,
      refs.registerMode,
      refs.email,
      refs.password,
      refs.confirmPassword,
      refs.passwordToggle,
      refs.confirmPasswordToggle,
      refs.submit,
      refs.logout
    ].forEach((control) => {
      if (control) control.disabled = busy;
    });
    refs.popover.dataset.accountBusy = accountSubmitting || "idle";
    syncAccountRecoveryState();
  }

  function syncAccountRecoveryState() {
    if (!refs.retryCheck || !refs.recoveryActions) return;
    const retryAvailable = authState === "unavailable" && !accountSubmitting;
    refs.retryCheck.hidden = !retryAvailable;
    refs.retryCheck.disabled = authState === "checking" || Boolean(accountSubmitting);
    refs.recoveryActions.hidden = !retryAvailable;
  }

  function focusAccountPopover(preference = "auto") {
    if (!refs.popover || refs.popover.hidden) return;
    const requestId = ++accountFocusRequest;
    const activeAtSchedule = document.activeElement;
    window.requestAnimationFrame(() => {
      if (requestId !== accountFocusRequest || refs.popover.hidden || refs.popover.contains(document.activeElement)) return;
      if (document.activeElement !== activeAtSchedule && document.activeElement !== document.body) return;
      let target;
      if (preference === "status" && !refs.status.hidden) target = refs.status;
      if (!target && authUser) target = !refs.status.hidden ? refs.status : refs.logout;
      if (!target) target = refs.popover.querySelector('[aria-invalid="true"]') || refs.email;
      if (target === refs.status) refs.status.tabIndex = -1;
      target?.focus({ preventScroll: true });
      requestMobileFocusReveal("account-popover-focus");
    });
  }

  function openAccountPopover(options = {}) {
    syncAccountView();
    const popover = refs.popover;
    if (!popover) return;
    if (options.returnFocus instanceof HTMLElement && options.returnFocus.isConnected) {
      accountPopoverReturnFocus = options.returnFocus;
    }
    if (options.mode) setAccountMode(options.mode, { resetStatus: false });
    const wasHidden = popover.hidden;
    cancelSurfaceClose(popover);
    popover.hidden = false;
    syncAccountPopoverState(popover);
    requestMobileFocusReveal("account-popover-open");
    if (wasHidden || options.focus) focusAccountPopover(options.focus || "auto");
  }

  function closeAccountPopover(options = {}) {
    const popover = refs.popover || document.getElementById("account-popover");
    const wasOpen = popover && !popover.hidden;
    if (!popover || !wasOpen) return;
    accountFocusRequest += 1;
    const toggle = refs.toggle || document.querySelector("[data-account-toggle]");
    const returnFocus = accountPopoverReturnFocus?.isConnected ? accountPopoverReturnFocus : toggle;
    runSurfaceClose(popover, {
      motion: options.motion,
      origin: returnFocus
    }, () => {
      popover.hidden = true;
      syncAccountPopoverState(popover);
      accountPopoverReturnFocus = null;
      if (options.restoreFocus !== false && returnFocus && typeof returnFocus.focus === "function") {
        returnFocus.focus({ preventScroll: true });
      }
    });
  }

  function toggleAccountPopover(trigger = null) {
    syncAccountView();
    const popover = refs.popover;
    if (!popover) return;
    if (popover.hidden) {
      if (trigger instanceof HTMLElement && trigger.isConnected) accountPopoverReturnFocus = trigger;
      openAccountPopover();
    } else {
      closeAccountPopover();
    }
  }

  function syncAccountPopoverState(popover = refs.popover || document.getElementById("account-popover")) {
    const toggle = refs.toggle || document.querySelector("[data-account-toggle]");
    if (!toggle || !popover) return;
    toggle.setAttribute("aria-expanded", String(!popover.hidden));
  }

  return Object.freeze({
    renderAccountWidget,
    initAccountWidget,
    logoutAccount,
    openAccountPopover,
    closeAccountPopover,
    toggleAccountPopover,
    syncAccountPopoverState
  });
}
