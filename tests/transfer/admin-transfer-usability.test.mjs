import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../../admin/transfer.js", import.meta.url), "utf8");
const settings = {
  normalMaxFileBytes: 95 * 1024 ** 2,
  normalUser24hBytes: 300 * 1024 ** 2,
  normalUserDailyFiles: 30,
  normalUserInitPerMinute: 3,
  normalRoomActiveBytes: 1024 ** 3,
  normalPoolActiveBytes: 8 * 1024 ** 3,
  normalPoolYellowRatio: 0.7,
  normalPoolRedRatio: 0.9,
  alertThresholds: "1,3,5",
  updatedAt: "revision-original"
};

function createClient() {
  const elements = {};
  const units = new Map();
  const nodes = new Map();
  const node = () => ({
    value: "", dataset: {}, disabled: false, hidden: true,
    classList: { toggle() {} }, setCustomValidity(message) { this.error = message; }, reportValidity() { return !this.error; }
  });
  for (const name of ["normal_max_file_bytes", "normal_user_24h_bytes", "normal_room_active_bytes", "normal_pool_active_bytes", "normal_user_daily_files", "normal_user_init_per_minute", "normal_pool_yellow_ratio", "normal_pool_red_ratio", "alert_thresholds"]) {
    elements[name] = node();
    units.set(name, { value: "MiB", dataset: { quotaUnit: name, previousUnit: "MiB" } });
  }
  nodes.set("settings-form", { elements, reportValidity: () => true });
  const context = vm.createContext({
    document: {
      getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
      querySelector(selector) { return units.get(selector.match(/"([^"]+)"/)?.[1]); }
    }
  });
  const instrumented = source.replace(/ {2}bind\(\);\s+syncSettingsDirty\(\);\s+void load\(\);/, "globalThis.client = { quotaToBytes, bytesToQuota, testAlertMessage, applySettings, settingsPayload, settingsSnapshot, changeQuotaUnit, syncSettingsDirty, state };");
  vm.runInContext(instrumented, context);
  return { ...context.client, elements, units, nodes };
}

test("capacity unit conversion keeps arbitrary server bytes exactly through repeated MiB/GiB switches", () => {
  const client = createClient();
  for (const value of [1, 1048577, 99614720, 1073741825, 8589934591, 9 * 1024 ** 3]) {
    for (const unit of ["MiB", "GiB"]) {
      assert.equal(client.quotaToBytes(client.bytesToQuota(value, unit), unit), value);
    }
  }
  assert.equal(client.quotaToBytes("1.5", "GiB"), 1610612736);
  assert.throws(() => client.quotaToBytes("0.1", "MiB"), /整数个字节/);
  for (const value of ["", "-1", "Infinity", "1e12", "NaN"]) assert.throws(() => client.quotaToBytes(value, "GiB"));
});

test("changing a display unit does not dirty settings or change the byte payload / CAS baseline", () => {
  const client = createClient();
  client.applySettings(settings);
  const before = client.settingsSnapshot();
  const unit = client.units.get("normal_user_24h_bytes");
  unit.value = "GiB";
  client.changeQuotaUnit(unit);
  assert.equal(client.settingsSnapshot(), before);
  assert.equal(client.state.settingsDirty, false);
  assert.equal(client.settingsPayload().normal_user_24h_bytes, settings.normalUser24hBytes);
  assert.equal(client.settingsPayload().expectedUpdatedAt, "revision-original");
  assert.equal(Object.keys(client.settingsPayload()).length, 10);
  client.elements.normal_user_24h_bytes.value = "0.5";
  client.syncSettingsDirty();
  assert.equal(client.state.settingsDirty, true);
  assert.equal(client.settingsPayload().normal_user_24h_bytes, 512 * 1024 ** 2);
});

test("quota payload rejects server-range overflow without changing input or loaded revision", () => {
  const client = createClient();
  client.applySettings(settings);
  client.elements.normal_max_file_bytes.value = "96";
  assert.throws(() => client.settingsPayload(), /容量须在/);
  assert.equal(client.elements.normal_max_file_bytes.value, "96");
  assert.equal(client.state.settingsVersion, "revision-original");
});

test("alert feedback never reports delivery merely because an HTTP 200 record was created", () => {
  const { testAlertMessage } = createClient();
  assert.match(testAlertMessage({ ok: true, delivered: false, notification: { webhookConfigured: true } }), /发送失败/);
  assert.match(testAlertMessage({ ok: true, delivered: false, notification: { webhookConfigured: false } }), /没有对外发送/);
  assert.match(testAlertMessage({ ok: true, delivered: true }), /接收服务接收.*继续核对送达/);
});
