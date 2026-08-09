import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ACCOUNT_REQUEST_TIMEOUT_MS,
  accountRequestFailure,
  normalizeAccountMode,
  requestAccountJson,
  validateAccountDraft
} from "../js/features/account.mjs";
import { translations } from "../js/core/i18n.mjs";

const accountSource = await readFile(new URL("../js/features/account.mjs", import.meta.url), "utf8");
const publicStyles = await readFile(new URL("../css/style.css", import.meta.url), "utf8");
const transferSource = await readFile(new URL("../js/transfer.js", import.meta.url), "utf8");
const transferFragment = await readFile(new URL("../fragments/quick-transfer.html", import.meta.url), "utf8");

test("account modes and registration confirmation validate without mutating drafts", () => {
  assert.equal(normalizeAccountMode("register"), "register");
  assert.equal(normalizeAccountMode("unexpected"), "login");

  assert.deepEqual(validateAccountDraft({
    mode: "login",
    email: "person@example.com",
    password: "correct-horse",
    confirmPassword: ""
  }), {});

  assert.deepEqual(validateAccountDraft({
    mode: "register",
    email: "not-an-email",
    password: "short",
    confirmPassword: "different"
  }), {
    email: "accountErrorInvalidEmail",
    password: "accountErrorPasswordLength",
    confirmPassword: "accountErrorPasswordMismatch"
  });

  assert.deepEqual(validateAccountDraft({
    mode: "register",
    email: "new@example.com",
    password: "eight-or-more",
    confirmPassword: "eight-or-more"
  }), {});
});

test("account request failures map to a real field and recoverable localized status", () => {
  assert.deepEqual(accountRequestFailure({ status: 401 }, "login"), {
    key: "accountErrorInvalidCredentials",
    field: "password"
  });
  assert.deepEqual(accountRequestFailure({ status: 400, code: "REGISTRATION_FAILED" }, "register"), {
    key: "accountErrorRegistrationFailed",
    field: "email"
  });
  assert.deepEqual(accountRequestFailure({ status: 409 }, "register"), {
    key: "accountErrorRegistrationFailed",
    field: "email"
  });
  assert.deepEqual(accountRequestFailure({ status: 429, code: "RATE_LIMITED" }, "login"), {
    key: "accountErrorRateLimited",
    field: "password"
  });
  assert.deepEqual(accountRequestFailure({ status: 0 }, "login", "email"), {
    key: "accountErrorNetwork",
    field: "email"
  });
  assert.deepEqual(accountRequestFailure({ status: 500 }, "login", "email"), {
    key: "accountErrorServiceUnavailable",
    field: "email"
  });
});

test("account requests have a bounded timeout and keep successful JSON behavior", async () => {
  assert.equal(ACCOUNT_REQUEST_TIMEOUT_MS, 8000);
  const hangingFetch = (_path, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      reject(new DOMException("aborted", "AbortError"));
    }, { once: true });
  });
  await assert.rejects(
    requestAccountJson(hangingFetch, "/api/auth/me", {}, 5),
    (error) => error?.code === "ACCOUNT_TIMEOUT" && error?.status === 0
  );

  const payload = await requestAccountJson(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ user: null })
  }), "/api/auth/me", {}, 50);
  assert.deepEqual(payload, { user: null });
});

test("account UI keeps one stable safe-DOM tree with explicit labels and busy/error semantics", () => {
  assert.doesNotMatch(accountSource, /\.replaceChildren\s*\(/);
  assert.doesNotMatch(accountSource, /\.innerHTML\s*=/);
  assert.match(accountSource, /refs\.form\.noValidate = true/);
  assert.match(accountSource, /name: "confirmPassword"[\s\S]*autocomplete: "new-password"/);
  assert.match(accountSource, /refs\.confirmGroup\.hidden = !registering/);
  assert.match(accountSource, /refs\.form\.hidden = signedIn[\s\S]*refs\.signedIn\.hidden = !signedIn/);
  assert.match(accountSource, /refs\.signedEmail\.textContent = t\("accountLoggedIn"\)/);
  assert.doesNotMatch(accountSource, /refs\.signedEmail\.textContent = authUser\?\.email/);
  assert.match(publicStyles, /\.account-form\[hidden\],[\s\S]*\.account-signed-in\[hidden\],[\s\S]*\.account-field\[hidden\]\s*\{\s*display:\s*none !important/);
  assert.match(accountSource, /refs\.password\.autocomplete = registering \? "new-password" : "current-password"/);
  assert.match(accountSource, /setAttribute\("aria-errormessage", error\.id\)/);
  assert.match(accountSource, /error\?\.dataset\.errorKey[\s\S]*t\(error\.dataset\.errorKey\)/);
  assert.match(accountSource, /refs\.status\.setAttribute\("aria-live", "polite"\)/);
  assert.match(accountSource, /setAccountStatus\(mode === "register" \? "accountBusyRegister" : "accountBusyLogin"\)/);
  assert.match(accountSource, /setAccountStatus\("accountBusyLogout"\)/);
  assert.match(accountSource, /setAccountStatus\("accountLogoutFailed", \{ error: true \}\)/);
  assert.match(accountSource, /accountFocusRequest[\s\S]*requestAnimationFrame[\s\S]*account-popover-focus/);
  assert.match(accountSource, /dataset: \{ accountRetryCheck: "" \}/);
  assert.match(accountSource, /refs\.retryCheck\.addEventListener\("click", retryAccountCheck\)/);
  assert.match(accountSource, /error\?\.code === "ACCOUNT_TIMEOUT" \? "accountCheckTimeout" : "accountUnavailable"/);
  assert.match(accountSource, /preserveEditingFocus[\s\S]*activeBeforeRetry\.focus\(\{ preventScroll: true \}\)/);
  assert.match(accountSource, /const nextView = authUser \? "signed-in" : "signed-out"/);
  assert.match(accountSource, /function cancelAccountViewMotion\([\s\S]*accountContentMotionGeneration \+= 1[\s\S]*getAnimations\?\.\(\)[\s\S]*animation\.cancel\(\)/);
  assert.match(accountSource, /function accountContentMotionProfile\([\s\S]*prefers-reduced-motion: reduce[\s\S]*motionMode === "off"/);
  assert.match(accountSource, /function animateAccountContentTransition\([\s\S]*profile\.reduced[\s\S]*surface\.animate\([\s\S]*opacity: 1[\s\S]*translate3d\(0,0,0\)/);
  assert.match(accountSource, /const generation = \+\+accountContentMotionGeneration[\s\S]*generation !== accountContentMotionGeneration[\s\S]*accountContentAnimation !== animation/);
  assert.doesNotMatch(accountSource, /\.animate\(\[[\s\S]{0,240}height:/);
  assert.match(accountSource, /root\?\.dataset\.inputMethod === "keyboard"/);
  assert.doesNotMatch(accountSource, /`form:\$\{accountMode\}`/);
  assert.match(accountSource, /const motion = document\.documentElement\?\.dataset\.inputMethod === "keyboard" \? false : undefined/);
  assert.match(accountSource, /syncAccountView\(\{ motion \}\)[\s\S]*openAccountPopover\(\{ focus: "status", motion \}\)/);
  assert.match(accountSource, /const wasClosing = popover\.getAttribute\("data-ui-closing"\) === "true"[\s\S]*accountPopoverCloseGeneration \+= 1[\s\S]*cancelSurfaceClose\(popover\)[\s\S]*popover\.inert = false/);
  assert.match(accountSource, /const closeGeneration = \+\+accountPopoverCloseGeneration[\s\S]*popover\.inert = true[\s\S]*closeGeneration !== accountPopoverCloseGeneration/);
  assert.match(accountSource, /const closing = popover\.getAttribute\("data-ui-closing"\) === "true"[\s\S]*popover\.hidden \|\| closing[\s\S]*openAccountPopover\(options\)/);
  assert.match(accountSource, /const expanded = !popover\.hidden && popover\.getAttribute\("data-ui-closing"\) !== "true"[\s\S]*popover\.inert = !expanded/);
  assert.match(accountSource, /const focusBeforeHide = document\.activeElement[\s\S]*focusStayedInPopover[\s\S]*&& focusStayedInPopover[\s\S]*returnFocus\.focus/);
});

test("all account copy keys exist in Chinese, English, and Japanese", () => {
  const requiredKeys = [
    "accountClose",
    "accountModeSelectorLabel",
    "accountLoginModeHint",
    "accountRegisterModeHint",
    "accountConfirmPasswordLabel",
    "accountConfirmPasswordPlaceholder",
    "accountShowPassword",
    "accountHidePassword",
    "accountChecking",
    "accountCheckRetry",
    "accountCheckTimeout",
    "accountBusyLogin",
    "accountBusyRegister",
    "accountBusyLogout",
    "accountErrorInvalidEmail",
    "accountErrorPasswordLength",
    "accountErrorPasswordMismatch",
    "accountErrorInvalidCredentials",
    "accountErrorRegistrationFailed",
    "accountErrorRateLimited",
    "accountErrorRequest",
    "accountErrorNetwork",
    "accountErrorServiceUnavailable",
    "accountLogoutFailed"
  ];

  for (const lang of ["zh", "en", "ja"]) {
    for (const key of requiredKeys) {
      assert.equal(typeof translations[lang][key], "string", `${lang}.${key} must exist`);
      assert.ok(translations[lang][key].trim().length > 0, `${lang}.${key} must not be empty`);
    }
  }
});

test("Quick Transfer presents one contextual login task and returns to its own context", () => {
  assert.match(transferFragment, /id="transfer-login-button"/);
  assert.match(transferFragment, /data-transfer-login-back/);
  assert.match(transferFragment, /class="transfer-icon transfer-icon-download transfer-icon-back"/);
  assert.doesNotMatch(transferFragment, /transfer-icon-cancel/);
  assert.match(transferSource, /openAccountPopover\(\{ returnFocus: trigger, mode: "login", context: "transfer" \}\)/);
  assert.match(transferSource, /if \(error\.status === 401\)[\s\S]*refs\.loginGate\.hidden = false[\s\S]*setFeedback\(""\)/);
  assert.match(transferSource, /function syncAccountState[\s\S]*await loadConfig\(\)[\s\S]*refs\.roomPassword/);
});
