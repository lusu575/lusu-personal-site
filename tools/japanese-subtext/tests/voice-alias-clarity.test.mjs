import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const exampleUrl = new URL("../config/tts.local.example.json", import.meta.url);
const config = JSON.parse(await readFile(exampleUrl, "utf8"));

test("high-volume narrator and robot roles avoid the low-intelligibility voice", () => {
  assert.equal(config.voiceAliases.narrator, "kohaku-normal");
  assert.equal(config.voiceAliases.robot, "kohaku-sweet");
  assert.notEqual(config.voiceAliases.narrator, "fumifumi-normal");
  assert.notEqual(config.voiceAliases.robot, "fumifumi-normal");
});
