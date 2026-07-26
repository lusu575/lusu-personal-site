import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sourceHtml = read("games/life-restart/source/index.html");
const touchSource = read("games/life-restart/source/lusu-mobile-touch.js");
const touchVersion = "20260726-life-mobile-touch-r1";

class FakeNode {
  constructor(properties = {}, children = []) {
    Object.assign(this, {
      name: "",
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      centerX: Number.NaN,
      centerY: Number.NaN,
      pivotX: 0,
      pivotY: 0,
      visible: true,
      alpha: 1,
      mouseEnabled: true,
      hitArea: null,
      destroyed: false
    }, properties);
    this.children = children;
    for (const child of children) child.parent = this;
  }

  get numChildren() {
    return this.children.length;
  }

  getChildAt(index) {
    return this.children[index];
  }

  getChildByName(name) {
    return this.children.find((child) => child.name === name) || null;
  }
}

function runTouchPatch({ canvasWidth, canvasHeight, innerWidth, innerHeight, coarse = true }) {
  const stage = new FakeNode({ width: 1827, height: 2436 });
  const label = new FakeNode({ name: "label", fontSize: 70 });
  const main = new FakeNode({
    name: "btnRemake",
    width: 600,
    height: 150,
    x: 614,
    y: 1743,
    centerX: 0,
    centerY: 600
  }, [label]);
  const github = new FakeNode({
    name: "btnGithub",
    width: 160,
    height: 160,
    x: 0,
    y: 0
  });
  const save = new FakeNode({
    name: "btnSmall",
    width: 110,
    height: 110,
    x: 1722,
    y: 2201,
    pivotX: 55,
    pivotY: 55
  });
  const theme = new FakeNode({
    name: "btnThemes",
    width: 110,
    height: 110,
    x: 1722,
    y: 2331,
    pivotX: 55,
    pivotY: 55
  });
  const root = new FakeNode({ width: stage.width, height: stage.height }, [
    main,
    github,
    save,
    theme
  ]);
  root.parent = stage;
  stage.children = [root];

  class Rectangle {
    constructor(x, y, width, height) {
      Object.assign(this, { x, y, width, height });
    }
  }

  const canvas = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: canvasWidth,
      height: canvasHeight
    })
  };
  const mediaQuery = {
    matches: coarse,
    addEventListener() {}
  };
  const documentElement = { dataset: {}, style: {} };
  const body = { style: {} };
  const window = {
    Laya: { stage, Rectangle },
    innerWidth,
    innerHeight,
    matchMedia: () => mediaQuery,
    addEventListener() {}
  };
  const context = {
    window,
    document: {
      hidden: false,
      documentElement,
      body,
      querySelector: (selector) => selector === "canvas" ? canvas : null
    },
    navigator: { maxTouchPoints: coarse ? 5 : 0 },
    requestAnimationFrame: (callback) => callback(),
    setInterval: () => 1
  };
  runInNewContext(touchSource, context, { filename: "lusu-mobile-touch.js" });
  return {
    audit: window.__lusuLifeRestartTouchAudit,
    documentElement,
    main,
    github,
    save,
    theme,
    scaleX: canvasWidth / stage.width,
    scaleY: canvasHeight / stage.height
  };
}

test("Life Restart source keeps one explicit internal mobile-touch cache version", () => {
  assert.match(
    sourceHtml,
    new RegExp(`assets/index-ZpiTsTqN\\.js\\?v=${touchVersion}`)
  );
  assert.match(
    sourceHtml,
    new RegExp(`lusu-mobile-touch\\.js\\?v=${touchVersion}`)
  );
  assert.equal((sourceHtml.match(new RegExp(touchVersion, "g")) || []).length, 2);
});

test("Life Restart portrait coarse-pointer controls expose non-overlapping 44px targets", () => {
  const result = runTouchPatch({
    canvasWidth: 371,
    canvasHeight: 494,
    innerWidth: 372,
    innerHeight: 494
  });
  assert.equal(result.audit.active, true);
  assert.equal(result.audit.version, touchVersion);
  assert.ok(result.audit.main.visualHeight >= 44);
  assert.ok(result.audit.main.targetWidth >= 44);
  assert.ok(result.audit.main.targetHeight >= 44);
  assert.ok(result.audit.controls.every((control) => (
    control.width >= 44 && control.height >= 44
  )));
  assert.ok(Math.abs((result.theme.y - result.save.y) * result.scaleY - 44) < 0.01);
  assert.equal(result.documentElement.dataset.lusuMobileTouch, "active");
});

test("Life Restart short landscape keeps the main action above a distinct 44px utility row", () => {
  const result = runTouchPatch({
    canvasWidth: 125,
    canvasHeight: 166,
    innerWidth: 826,
    innerHeight: 166
  });
  assert.equal(result.audit.landscape, true);
  assert.ok(result.audit.main.visualWidth >= 107.99);
  assert.ok(result.audit.main.visualHeight >= 44);
  assert.ok(Math.abs((result.theme.x - result.save.x) * result.scaleX - 44) < 0.01);
  assert.ok(Math.abs((166 - (result.save.y * result.scaleY)) - 22) < 0.01);
  assert.ok(result.audit.controls.every((control) => (
    control.width >= 44 && control.height >= 44
  )));
});

test("Life Restart fine-pointer desktop leaves original canvas geometry unchanged", () => {
  const result = runTouchPatch({
    canvasWidth: 465,
    canvasHeight: 620,
    innerWidth: 1260,
    innerHeight: 620,
    coarse: false
  });
  assert.equal(result.audit.active, false);
  assert.equal(result.main.width, 600);
  assert.equal(result.main.height, 150);
  assert.equal(result.save.x, 1722);
  assert.equal(result.theme.y, 2331);
  assert.equal(result.documentElement.dataset.lusuMobileTouch, "off");
});
