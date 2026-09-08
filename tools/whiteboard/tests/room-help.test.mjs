import assert from "node:assert/strict";
import test from "node:test";
import { roomHelpState } from "../src/room-help-state.js";

test("a desktop click cannot keep password help open after the pointer leaves", () => {
  let state = roomHelpState(null, { type: "pointer-enter", pointerType: "mouse" });
  assert.ok(state);
  state = roomHelpState(state, { type: "focus", keyboard: false });
  state = roomHelpState(state, { type: "activate", pointerType: "mouse" });
  state = roomHelpState(state, { type: "pointer-leave" });
  assert.equal(state, null);
  assert.equal(roomHelpState(null, { type: "activate", pointerType: "mouse" }), null);
});

test("keyboard help can be dismissed without removing focus and explicitly reopened", () => {
  let state = roomHelpState(null, { type: "focus", keyboard: true });
  assert.ok(state);
  state = roomHelpState(state, { type: "dismiss" });
  assert.equal(state, null);
  // Unrelated pointer movement cannot resurrect an Escape-dismissed explanation.
  state = roomHelpState(state, { type: "pointer-leave" });
  assert.equal(state, null);
  state = roomHelpState(state, { type: "activate", pointerType: "" });
  assert.ok(state);
});

test("touch and pen open on activation, survive pointer departure, and close on a second tap", () => {
  for (const pointerType of ["touch", "pen"]) {
    let state = roomHelpState(null, { type: "pointer-enter", pointerType });
    assert.equal(state, null);
    state = roomHelpState(state, { type: "focus", keyboard: false });
    state = roomHelpState(state, { type: "activate", pointerType });
    state = roomHelpState(state, { type: "pointer-leave" });
    assert.ok(state);
    state = roomHelpState(state, { type: "activate", pointerType });
    assert.equal(state, null);
  }
});

test("outside interaction or focus departure closes every help mode", () => {
  for (const state of ["touch", "keyboard", "hover", null]) {
    assert.equal(roomHelpState(state, { type: "dismiss" }), null);
  }
});

test("a hybrid device can return from touch disclosure to transient mouse hover", () => {
  let state = roomHelpState(null, { type: "activate", pointerType: "touch" });
  state = roomHelpState(state, { type: "pointer-enter", pointerType: "mouse" });
  assert.ok(state);
  state = roomHelpState(state, { type: "activate", pointerType: "mouse" });
  state = roomHelpState(state, { type: "pointer-leave" });
  assert.equal(state, null);
});
