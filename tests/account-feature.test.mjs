import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  accountRequestFailure,
  normalizeAccountMode,
  validateAccountDraft
} from "../js/features/account.mjs";
import { translations } from "../js/core/i18n.mjs";

const accountSource = await readFile(new URL("../js/features/account.mjs", import.meta.url), "utf8");
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
  assert.deepEqual(accountRequestFailure({ status: 409 }, "register"), {
    key: "accountErrorEmailExists",
    field: "email"
  });
  assert.deepEqual(accountRequestFailure({ status: 0 }, "login", "email"), {
    key: "accountErrorRequest",
    field: "email"
  });
});

test("account UI keeps one stable safe-DOM tree with explicit labels and busy/error semantics", () => {
  assert.doesNotMatch(accountSource, /\.replaceChildren\s*\(/);
  assert.doesNotMatch(accountSource, /\.innerHTML\s*=/);
  assert.match(accountSource, /refs\.form\.noValidate = true/);
  assert.match(accountSource, /name: "confirmPassword"[\s\S]*autocomplete: "new-password"/);
  assert.match(accountSource, /refs\.password\.autocomplete = registering \? "new-password" : "current-password"/);
  assert.match(accountSource, /setAttribute\("aria-errormessage", error\.id\)/);
  assert.match(accountSource, /error\?\.dataset\.errorKey[\s\S]*t\(error\.dataset\.errorKey\)/);
  assert.match(accountSource, /refs\.status\.setAttribute\("aria-live", "polite"\)/);
  assert.match(accountSource, /setAccountStatus\(mode === "register" \? "accountBusyRegister" : "accountBusyLogin"\)/);
  assert.match(accountSource, /setAccountStatus\("accountBusyLogout"\)/);
  assert.match(accountSource, /setAccountStatus\("accountLogoutFailed", \{ error: true \}\)/);
  assert.match(accountSource, /accountFocusRequest[\s\S]*requestAnimationFrame[\s\S]*account-popover-focus/);
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
    "accountBusyLogin",
    "accountBusyRegister",
    "accountBusyLogout",
    "accountErrorInvalidEmail",
    "accountErrorPasswordLength",
    "accountErrorPasswordMismatch",
    "accountErrorInvalidCredentials",
    "accountErrorEmailExists",
    "accountErrorRequest",
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
