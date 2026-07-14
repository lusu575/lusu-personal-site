import test from "node:test";
import assert from "node:assert/strict";
import { AudioPlayer } from "../lib/audio-player.mjs";

class FakeAudio extends EventTarget {
  constructor() {
    super();
    this.src = "";
    this.currentTime = 0;
    this.duration = 12;
    this.readyState = 1;
    this.paused = true;
    this.playbackRate = 1;
    this.muted = false;
  }
  load() {}
  play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
  removeAttribute(name) { if (name === "src") this.src = ""; }
}

test("one audio element handles scene, sentence, token, option, seek, and stop", async () => {
  const player = new AudioPlayer(FakeAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: {
      scene: { path: "level-1/L1-001/scene.mp3", durationSeconds: 12 },
      token: { path: "level-1/L1-001/words/token.mp3" },
      option: { path: "level-1/L1-001/options/q1-a.mp3" }
    },
    stages: {
      "L1-001": {
        sceneAudioId: "scene",
        durationSeconds: 12,
        cues: [{ lineId: "line-001", start: 1.25, end: 3.5, tokens: [] }]
      }
    }
  };
  const audio = player.audio;
  player.setStage("L1-001");
  await player.playScene({ start: 4 });
  assert.equal(player.audio, audio);
  assert.equal(audio.currentTime, 4);
  assert.equal(player.stopAt, null);
  assert.equal(player.sceneDuration(), 12);
  assert.equal(player.isSceneLoaded(), true);
  await player.playLine("line-001");
  assert.equal(audio.currentTime, 1.25);
  assert.equal(player.stopAt, 3.5);
  await player.playToken("line-001", "token-001", "token");
  assert.equal(player.context.kind, "token");
  assert.equal(player.stopAt, null);
  await player.playOption("q1", "a", "option");
  assert.equal(player.context.kind, "option");
  assert.equal(player.stopAt, null);
  assert.equal(player.seek(6), false);
  await player.playScene({ start: 0 });
  assert.equal(player.seek(6), true);
  assert.equal(audio.currentTime, 6);
  player.stop();
  assert.equal(audio.src, "");
  assert.equal(player.itemId, "");
  assert.equal(player.seek(3), false);
});

test("manifest audioBaseUrl is normalized and traversal remains blocked", async () => {
  const player = new AudioPlayer(FakeAudio);
  const manifest = { schemaVersion: 1, contentVersion: "1.0.3", audioBaseUrl: "https://cdn.example.test/jp-audio", items: {}, stages: {} };
  await player.loadManifest(async () => ({ ok: true, json: async () => manifest }));
  assert.equal(player.audioRoot.href, "https://cdn.example.test/jp-audio/");
  player.manifest.items.bad = { path: "../secret.mp3" };
  await assert.rejects(() => player.playItem("bad"), /missing/i);
});

test("unsafe or missing audio paths fail closed", async () => {
  const player = new AudioPlayer(FakeAudio);
  player.manifest = { schemaVersion: 1, contentVersion: "1.0.2", items: { bad: { path: "../secret.mp3" } }, stages: {} };
  await assert.rejects(
    () => player.playOption("q1", "a", "bad"),
    (error) => error.audioContext?.kind === "option" && error.audioItemId === "bad",
  );
  await assert.rejects(
    () => player.playOption("q1", "a", "none"),
    (error) => error.audioContext?.kind === "option" && error.audioItemId === "none",
  );
  await assert.rejects(
    () => player.playToken("line-001", "token-001", "none"),
    (error) => error.audioContext?.kind === "token" && error.audioContext?.tokenId === "token-001",
  );
});

test("validated content hashes bust cached audio without weakening the path guard", async () => {
  const player = new AudioPlayer(FakeAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: {
      fresh: { path: "level-1/L1-001/scene.mp3", contentHash: "a".repeat(64) },
      legacy: { path: "level-1/L1-001/line.mp3", contentHash: "not-a-hash?x=1" }
    },
    stages: {}
  };
  await player.playItem("fresh");
  assert.match(player.audio.src, /scene\.mp3\?v=aaaaaaaaaaaa$/);
  await player.playItem("legacy");
  assert.match(player.audio.src, /line\.mp3$/);
  assert.doesNotMatch(player.audio.src, /not-a-hash/);
});

test("a newer playback request cancels an older metadata wait", async () => {
  class DeferredAudio extends FakeAudio {
    constructor() {
      super();
      this.readyState = 0;
    }
  }
  const player = new AudioPlayer(DeferredAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: {
      first: { path: "level-1/L1-001/first.mp3" },
      second: { path: "level-1/L1-001/second.mp3" }
    },
    stages: {}
  };
  const first = player.playItem("first");
  const second = player.playItem("second");
  await assert.rejects(first, { name: "AbortError" });
  player.audio.readyState = 1;
  player.audio.dispatchEvent(new Event("loadedmetadata"));
  await second;
  assert.match(player.audio.src, /second\.mp3$/);
  assert.equal(player.context.kind, "");
});

test("a newly loaded source resumes when the activation play settles paused", async () => {
  class SettlingAudio extends FakeAudio {
    constructor() {
      super();
      this.playCalls = 0;
    }
    play() {
      this.playCalls += 1;
      if (this.playCalls === 1) return Promise.resolve();
      return super.play();
    }
  }
  const player = new AudioPlayer(SettlingAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: { option: { path: "level-1/L1-001/options/q1-a.mp3" } },
    stages: {}
  };
  const states = [];
  player.addEventListener("state", ({ detail }) => states.push(detail.state));
  await player.playItem("option", { context: { kind: "option", questionId: "q1", optionId: "a" } });
  assert.equal(player.audio.playCalls, 2);
  assert.equal(player.audio.paused, false);
  assert.equal(states.at(-1), "playing");
});

test("a failed source is invalidated so the same item can be retried", async () => {
  class MetadataFailureAudio extends FakeAudio {
    constructor() {
      super();
      this.readyState = 0;
    }
  }
  const player = new AudioPlayer(MetadataFailureAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: { scene: { path: "level-1/L1-001/scene.mp3" } },
    stages: { "L1-001": { sceneAudioId: "scene", cues: [] } }
  };
  player.setStage("L1-001");
  const failed = player.playScene();
  player.audio.dispatchEvent(new Event("error"));
  await assert.rejects(failed, /metadata failed/i);
  assert.equal(player.itemId, "");
  assert.equal(player.audio.src, "");

  player.audio.readyState = 1;
  await player.playScene();
  assert.equal(player.itemId, "scene");
  assert.equal(player.audio.paused, false);
});

test("a failed item preserves its logical playback context for an exact retry", async () => {
  class MetadataFailureAudio extends FakeAudio {
    constructor() {
      super();
      this.readyState = 0;
    }
  }
  const player = new AudioPlayer(MetadataFailureAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: { option: { path: "level-1/L1-001/options/q1-a.mp3" } },
    stages: {},
  };
  const failed = player.playOption("q1", "a", "option");
  player.audio.dispatchEvent(new Event("error"));
  await assert.rejects(failed, (error) => {
    assert.deepEqual(error.audioContext, {
      kind: "option",
      lineId: "",
      tokenId: "",
      questionId: "q1",
      optionId: "a",
    });
    assert.equal(error.audioItemId, "option");
    return true;
  });
  assert.equal(player.context.kind, "");
  assert.equal(player.itemId, "");
});

test("natural and clipped endings expose a stopped transport state", async () => {
  const player = new AudioPlayer(FakeAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: { scene: { path: "level-1/L1-001/scene.mp3" } },
    stages: { "L1-001": { sceneAudioId: "scene", cues: [{ lineId: "line-001", start: 1, end: 2 }] } }
  };
  const states = [];
  player.addEventListener("state", ({ detail }) => states.push(detail.state));
  player.setStage("L1-001");
  await player.playScene();
  player.audio.currentTime = player.audio.duration;
  player.audio.dispatchEvent(new Event("ended"));
  assert.equal(states.at(-1), "stopped");
  await player.playLine("line-001");
  player.audio.currentTime = 2;
  player.audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(states.at(-1), "stopped");
});

test("a stale ended event at the start of a new source cannot complete the scene", async () => {
  const player = new AudioPlayer(FakeAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: { scene: { path: "level-1/L1-001/scene.mp3" } },
    stages: { "L1-001": { sceneAudioId: "scene", cues: [] } }
  };
  let ended = 0;
  player.addEventListener("ended", () => { ended += 1; });
  player.setStage("L1-001");
  await player.playScene();
  player.audio.currentTime = 0;
  player.audio.dispatchEvent(new Event("ended"));
  assert.equal(ended, 0);
  player.audio.currentTime = player.audio.duration;
  player.audio.dispatchEvent(new Event("ended"));
  assert.equal(ended, 1);
});

test("an asynchronous native pause cannot overwrite a clipped segment's stopped state", async () => {
  class AsyncPauseAudio extends FakeAudio {
    pause() {
      if (this.paused) return;
      this.paused = true;
      queueMicrotask(() => this.dispatchEvent(new Event("pause")));
    }
  }
  const player = new AudioPlayer(AsyncPauseAudio);
  player.manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    items: { scene: { path: "level-1/L1-001/scene.mp3" } },
    stages: { "L1-001": { sceneAudioId: "scene", cues: [{ lineId: "line-001", start: 1, end: 2 }] } }
  };
  const states = [];
  player.addEventListener("state", ({ detail }) => states.push(detail.state));
  player.setStage("L1-001");
  await player.playLine("line-001");
  player.audio.currentTime = 2;
  player.audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(states.at(-1), "stopped");
  await Promise.resolve();
  assert.equal(states.at(-1), "stopped");
});
