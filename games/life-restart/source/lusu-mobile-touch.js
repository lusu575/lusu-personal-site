(function () {
  "use strict";

  const VERSION = "20260726-life-mobile-touch-r1";
  const MIN_TOUCH_TARGET_PX = 44;
  const MAIN_BUTTON_MIN_WIDTH_PX = 108;
  const SYNC_INTERVAL_MS = 400;
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  const baseState = new WeakMap();
  const trackedNodes = new Set();

  function usesCoarseTouch() {
    return coarsePointer.matches || navigator.maxTouchPoints > 0;
  }

  function effectiveVisible(node, stage) {
    for (let current = node; current && current !== stage; current = current.parent) {
      if (current.visible === false || Number(current.alpha) <= 0) return false;
    }
    return true;
  }

  function collectNodes(stage) {
    const nodes = [];
    const visit = (node) => {
      nodes.push(node);
      const count = Number(node.numChildren || 0);
      for (let index = 0; index < count; index += 1) {
        visit(node.getChildAt(index));
      }
    };
    visit(stage);
    return nodes;
  }

  function remember(node) {
    if (baseState.has(node)) {
      trackedNodes.add(node);
      return baseState.get(node);
    }
    const label = node.getChildByName?.("label");
    const state = {
      width: Number(node.width || 0),
      height: Number(node.height || 0),
      x: Number(node.x || 0),
      y: Number(node.y || 0),
      centerX: Number(node.centerX),
      centerY: Number(node.centerY),
      hasCenterX: Number.isFinite(Number(node.centerX)),
      hasCenterY: Number.isFinite(Number(node.centerY)),
      hitArea: node.hitArea || null,
      label,
      labelFontSize: Number(label?.fontSize || 0),
      labelSize: Number(node.labelSize || 0)
    };
    baseState.set(node, state);
    trackedNodes.add(node);
    return state;
  }

  function restoreNode(node) {
    const state = baseState.get(node);
    if (!state || node.destroyed) return;
    node.width = state.width;
    node.height = state.height;
    node.x = state.x;
    node.y = state.y;
    if (state.hasCenterX) node.centerX = state.centerX;
    if (state.hasCenterY) node.centerY = state.centerY;
    node.hitArea = state.hitArea;
    if (state.label && !state.label.destroyed && state.labelFontSize > 0) {
      state.label.fontSize = state.labelFontSize;
    }
    if (state.labelSize > 0 && "labelSize" in node) node.labelSize = state.labelSize;
  }

  function restoreAll() {
    for (const node of trackedNodes) restoreNode(node);
    trackedNodes.clear();
  }

  function setNumber(node, property, value) {
    if (Math.abs(Number(node[property] || 0) - value) > 0.01) {
      node[property] = value;
    }
  }

  function centerNodeAt(node, logicalX, logicalY) {
    const pivotX = Number(node.pivotX || 0);
    const pivotY = Number(node.pivotY || 0);
    setNumber(node, "x", logicalX + pivotX - (Number(node.width || 0) / 2));
    setNumber(node, "y", logicalY + pivotY - (Number(node.height || 0) / 2));
  }

  function setMinimumHitArea(node, Laya, scaleX, scaleY) {
    const visualWidth = Number(node.width || 0);
    const visualHeight = Number(node.height || 0);
    const targetWidth = Math.max(visualWidth, MIN_TOUCH_TARGET_PX / scaleX);
    const targetHeight = Math.max(visualHeight, MIN_TOUCH_TARGET_PX / scaleY);
    const x = (visualWidth - targetWidth) / 2;
    const y = (visualHeight - targetHeight) / 2;
    const area = node.__lusuLifeRestartTouchArea || new Laya.Rectangle(
      x,
      y,
      targetWidth,
      targetHeight
    );
    area.x = x;
    area.y = y;
    area.width = targetWidth;
    area.height = targetHeight;
    node.__lusuLifeRestartTouchArea = area;
    if (node.hitArea !== area) node.hitArea = area;
    return {
      name: String(node.name || node.constructor?.name || "control"),
      width: targetWidth * scaleX,
      height: targetHeight * scaleY
    };
  }

  function syncTouchTargets() {
    const Laya = window.Laya;
    const stage = Laya?.stage;
    const canvas = document.querySelector("canvas");
    if (!stage || !canvas || !stage.width || !stage.height) return false;

    if (!usesCoarseTouch()) {
      restoreAll();
      document.documentElement.dataset.lusuMobileTouch = "off";
      window.__lusuLifeRestartTouchAudit = {
        version: VERSION,
        active: false,
        minimumTarget: MIN_TOUCH_TARGET_PX
      };
      return true;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / stage.width;
    const scaleY = canvasRect.height / stage.height;
    if (!(scaleX > 0) || !(scaleY > 0)) return false;

    const landscape = canvasRect.width < canvasRect.height
      && window.innerWidth > window.innerHeight;
    const nodes = collectNodes(stage);
    const visibleControls = nodes.filter((node) => (
      /^btn/i.test(String(node.name || ""))
      && node.mouseEnabled !== false
      && effectiveVisible(node, stage)
    ));
    const mainButton = visibleControls.find((node) => (
      node.name === "btnRemake" || node.name === "btnAgain"
    ));

    if (mainButton) {
      const state = remember(mainButton);
      const maximumWidth = Math.max(0, stage.width - (16 / scaleX));
      setNumber(mainButton, "width", Math.max(
        state.width,
        Math.min(maximumWidth, MAIN_BUTTON_MIN_WIDTH_PX / scaleX)
      ));
      setNumber(
        mainButton,
        "height",
        Math.max(state.height, MIN_TOUCH_TARGET_PX / scaleY)
      );

      if (state.label && !state.label.destroyed) {
        setNumber(
          state.label,
          "fontSize",
          Math.max(state.labelFontSize, 16 / scaleY)
        );
      }
      if (state.labelSize > 0 && "labelSize" in mainButton) {
        setNumber(
          mainButton,
          "labelSize",
          Math.max(state.labelSize, 16 / scaleY)
        );
      }

      if (landscape && state.hasCenterY) {
        const toolbarTopPx = canvasRect.height - MIN_TOUCH_TARGET_PX;
        const mainCenterPx = toolbarTopPx - (MIN_TOUCH_TARGET_PX / 2);
        setNumber(
          mainButton,
          "centerY",
          (mainCenterPx / scaleY) - (stage.height / 2)
        );
      } else if (state.hasCenterY) {
        setNumber(mainButton, "centerY", state.centerY);
      }
    }

    const compactUtilities = visibleControls.filter((node) => {
      const state = remember(node);
      return (
        node !== mainButton
        && state.width <= 140
        && state.height <= 140
        && state.y > stage.height * 0.72
        && (node.name === "btnSmall" || node.name === "btnThemes")
      );
    });
    const saveButton = compactUtilities.find((node) => node.name === "btnSmall");
    const themeButton = compactUtilities.find((node) => node.name === "btnThemes");

    if (saveButton && themeButton) {
      if (landscape) {
        const toolbarY = stage.height - (MIN_TOUCH_TARGET_PX / 2 / scaleY);
        centerNodeAt(
          saveButton,
          MIN_TOUCH_TARGET_PX / 2 / scaleX,
          toolbarY
        );
        centerNodeAt(
          themeButton,
          MIN_TOUCH_TARGET_PX * 1.5 / scaleX,
          toolbarY
        );
      } else {
        const utilityX = stage.width - (MIN_TOUCH_TARGET_PX / 2 / scaleX);
        centerNodeAt(
          saveButton,
          utilityX,
          stage.height - (MIN_TOUCH_TARGET_PX * 1.5 / scaleY)
        );
        centerNodeAt(
          themeButton,
          utilityX,
          stage.height - (MIN_TOUCH_TARGET_PX / 2 / scaleY)
        );
      }
    }

    const controls = visibleControls.map((node) => {
      remember(node);
      return setMinimumHitArea(node, Laya, scaleX, scaleY);
    });
    const mainTarget = mainButton
      ? controls[visibleControls.indexOf(mainButton)]
      : null;

    document.documentElement.dataset.lusuMobileTouch = "active";
    document.documentElement.style.touchAction = "manipulation";
    document.body.style.touchAction = "manipulation";
    window.__lusuLifeRestartTouchAudit = {
      version: VERSION,
      active: true,
      minimumTarget: MIN_TOUCH_TARGET_PX,
      landscape,
      canvasScale: { x: scaleX, y: scaleY },
      main: mainButton && {
        name: mainButton.name,
        visualWidth: Number(mainButton.width || 0) * scaleX,
        visualHeight: Number(mainButton.height || 0) * scaleY,
        targetWidth: mainTarget?.width || 0,
        targetHeight: mainTarget?.height || 0
      },
      controls
    };
    return true;
  }

  let scheduled = false;
  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncTouchTargets();
    });
  }

  window.addEventListener("resize", scheduleSync, { passive: true });
  window.addEventListener("orientationchange", scheduleSync, { passive: true });
  coarsePointer.addEventListener?.("change", scheduleSync);
  setInterval(() => {
    if (!document.hidden) syncTouchTargets();
  }, SYNC_INTERVAL_MS);
  scheduleSync();
})();
