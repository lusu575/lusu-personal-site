import assert from "node:assert/strict";

const windowListeners = new Map();
const documentListeners = new Map();
const storageWrites = [];
const addListener = (registry, type, listener) => {
  const listeners = registry.get(type) || new Set();
  listeners.add(listener);
  registry.set(type, listeners);
};
const removeListener = (registry, type, listener) => {
  registry.get(type)?.delete(listener);
};

globalThis.window = {
  innerHeight: 844,
  innerWidth: 390,
  location: {
    host: "lusu.example",
    origin: "https://lusu.example",
    protocol: "https:",
  },
  addEventListener: (type, listener) => addListener(windowListeners, type, listener),
  removeEventListener: (type, listener) => removeListener(windowListeners, type, listener),
  localStorage: {
    setItem: (key, value) => storageWrites.push({ key, value }),
    removeItem: () => {},
  },
  setTimeout,
};
globalThis.document = {
  visibilityState: "visible",
  documentElement: { lang: "zh" },
  addEventListener: (type, listener) => addListener(documentListeners, type, listener),
  removeEventListener: (type, listener) => removeListener(documentListeners, type, listener),
};

class FakeBroadcastChannel {
  static instances = [];

  constructor(name) {
    this.name = name;
    this.listeners = new Set();
    this.closed = false;
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(type, listener) {
    if (type === "message") this.listeners.add(listener);
  }

  postMessage(data) {
    for (const instance of FakeBroadcastChannel.instances) {
      if (instance !== this && !instance.closed && instance.name === this.name) {
        for (const listener of instance.listeners) listener({ data });
      }
    }
  }

  emit(data) {
    for (const listener of this.listeners) listener({ data });
  }

  close() {
    this.closed = true;
  }
}
globalThis.BroadcastChannel = FakeBroadcastChannel;

const {
  getAnonymousIdentity,
  joinRoom,
  normalizeRoomPassword,
  rotateAnonymousIdentity,
  subscribeAnonymousIdentityChanges,
  validatedWebSocketConfig,
} = await import("../src/api.js");

assert.equal(normalizeRoomPassword("  ｔｅｓｔ  "), "test");

let requestBody = null;
globalThis.fetch = async (_url, options) => {
  requestBody = JSON.parse(options.body);
  return new Response(JSON.stringify({
    identity: {
      anonymousId: "anonymous_identity_for_test",
      displayName: "像素海豹",
      color: "#245edc",
      version: 1,
    },
    room: { type: "private" },
    wsUrl: "/api/whiteboard/realtime",
    wsProtocol: "whiteboard.v1",
    ticket: "ticket_test_value",
    accessToken: "access_test_value",
    ticketExpiresAt: "2026-07-30T00:00:00.000Z",
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const session = await joinRoom("private", "  ｔｅｓｔ  ");
assert.deepEqual(requestBody, { type: "private", password: "test" });
assert.equal(session.roomType, "private");

const websocket = validatedWebSocketConfig(session);
assert.equal(websocket.url, "wss://lusu.example/api/whiteboard/realtime");
assert.deepEqual(websocket.protocols, ["whiteboard.v1", "ticket_test_value"]);

assert.throws(
  () => validatedWebSocketConfig({
    ...session,
    wsUrl: "https://other.example/api/whiteboard/realtime",
  }),
  /Unsafe WebSocket URL/,
);

const longTicket = "a".repeat(4096);
assert.equal(
  validatedWebSocketConfig({ ...session, ticket: longTicket }).protocols[1].length,
  4096,
);

let identityFetches = 0;
globalThis.fetch = async () => {
  identityFetches += 1;
  return new Response(JSON.stringify({
    identity: {
      displayName: "月球旅人",
      color: "#2563eb",
      version: 2,
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
let synchronizedIdentity = null;
const unsubscribe = subscribeAnonymousIdentityChanges((identity) => {
  synchronizedIdentity = identity;
});
const subscriberChannel = FakeBroadcastChannel.instances.at(-1);
subscriberChannel.emit({
  type: "identity-changed",
  source: "another_context",
  version: 2,
  at: Date.now(),
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(identityFetches, 1);
assert.equal(synchronizedIdentity.displayName, "月球旅人");
unsubscribe();
assert.equal(subscriberChannel.closed, true);

globalThis.fetch = async () => new Response(JSON.stringify({
  identity: {
    displayName: "云端信使",
    color: "#7c3aed",
    version: 3,
  },
}), {
  status: 200,
  headers: { "content-type": "application/json" },
});
const rotated = await rotateAnonymousIdentity();
assert.equal(rotated.displayName, "云端信使");
assert.ok(storageWrites.length > 0);
const storedSignal = JSON.parse(storageWrites.at(-1).value);
assert.equal(storedSignal.type, "identity-changed");
assert.equal(storedSignal.version, 3);
assert.equal("displayName" in storedSignal, false);
assert.equal("anonymousId" in storedSignal, false);
assert.equal("credential" in storedSignal, false);

assert.equal((await getAnonymousIdentity()).displayName, "云端信使");

console.log("whiteboard API contract tests passed");
