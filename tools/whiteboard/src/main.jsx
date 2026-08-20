import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Excalidraw,
  exportToBlob,
  exportToSvg,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "../whiteboard.css";
import {
  getAnonymousIdentity,
  joinRoom,
  normalizeRoomPassword,
  rotateAnonymousIdentity,
  subscribeAnonymousIdentityChanges,
  trackWhiteboardEvent,
} from "./api.js";
import {
  getExcalidrawLanguage,
  getHtmlLanguage,
  getLanguage,
  languageHref,
  translate,
} from "./i18n.js";
import { YSceneController } from "./y-scene.js";
import { WhiteboardCollaboration } from "./collaboration.js";
import {
  WHITEBOARD_IMAGE_ACCEPT,
  WhiteboardAssetManager,
  whiteboardImageFilesAreSupported,
} from "./assets.js";

const RECENT_ROOM_KEY = "lusu-whiteboard-recent-room-v1";
const WHITEBOARD_VERSION = "1.0.8";
const NAME_COOLDOWN_MS = 30_000;
const PASSWORD_MIN_LENGTH = 4;
const PASSWORD_MAX_LENGTH = 128;
const CONNECTION_NOTICE_DELAY_MS = 3_000;
const ALL_ROOM_SKETCH_APP_STATE = Object.freeze({
  viewBackgroundColor: "#f7f1e5",
  currentItemFontFamily: 1,
  currentItemStrokeColor: "#4a4640",
  currentItemBackgroundColor: "transparent",
  currentItemFillStyle: "hachure",
  currentItemStrokeWidth: 1,
  currentItemRoughness: 2,
  currentItemOpacity: 92,
});

function createAllRoomSketchInitialData() {
  return { appState: { ...ALL_ROOM_SKETCH_APP_STATE } };
}

function durationBucket(milliseconds) {
  const minutes = Math.max(0, milliseconds) / 60_000;
  if (minutes < 1) return "lt_1m";
  if (minutes < 5) return "m1_5";
  if (minutes < 15) return "m5_15";
  if (minutes < 60) return "m15_60";
  return "gte_60m";
}

function onlineCountBucket(count) {
  const value = Math.max(1, Number(count || 1));
  if (value === 1) return "one";
  if (value <= 4) return "two_four";
  if (value <= 16) return "five_sixteen";
  return "gte_seventeen";
}

function readRecentRoom() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_ROOM_KEY) || "null");
    if (
      !parsed
      || !["public", "private"].includes(parsed.roomType)
      || !Number.isFinite(Number(parsed.usedAt))
    ) {
      return null;
    }
    return {
      roomType: parsed.roomType,
      usedAt: Number(parsed.usedAt),
    };
  } catch {
    return null;
  }
}

function writeRecentRoom(roomType) {
  const recent = { roomType, usedAt: Date.now() };
  try {
    window.localStorage.setItem(RECENT_ROOM_KEY, JSON.stringify(recent));
  } catch {
    // Recent-room convenience is intentionally optional.
  }
  return recent;
}

function useVisualViewport() {
  useEffect(() => {
    let frame = 0;
    const viewport = window.visualViewport;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const height = viewport?.height || window.innerHeight;
        const top = viewport?.offsetTop || 0;
        document.documentElement.style.setProperty("--whiteboard-height", `${Math.round(height)}px`);
        document.documentElement.style.setProperty("--whiteboard-top", `${Math.round(top)}px`);
      });
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    viewport?.addEventListener("resize", update, { passive: true });
    viewport?.addEventListener("scroll", update, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);
}

function safeIdentity(source, fallback) {
  const displayName = String(source?.displayName || source?.name || fallback?.displayName || "")
    .normalize("NFKC")
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, 32);
  const colorCandidate = String(source?.color || fallback?.color || "");
  return {
    ...fallback,
    anonymousId: typeof source?.anonymousId === "string"
      ? source.anonymousId
      : fallback?.anonymousId || "",
    displayName: displayName || fallback?.displayName || "",
    color: /^#[0-9a-f]{6}$/i.test(colorCandidate)
      ? colorCandidate.toLowerCase()
      : "#64748b",
    version: Number(source?.version || source?.identityVersion || fallback?.version || 1),
  };
}

function errorCopyKey(error, fallback = "genericError", kind = "") {
  const code = [kind, error?.code, error?.reason, error?.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (error?.status === 429 || code.includes("rate")) return "rateLimited";
  if (error?.status === 403 || error?.status === 401 || code.includes("access")) return "accessDenied";
  if (error?.status === 503) return "serverBusy";
  if (error?.status === 409 && code.includes("full")) return "roomFull";
  if (code.includes("object") || code.includes("document") || code.includes("scene")) return "sceneLimit";
  if (code.includes("locked") || code.includes("read-only")) return "lockedError";
  if (code.includes("unsupported-image")) return "uploadType";
  if (code.includes("image-too-large")) return "uploadSize";
  if (code.includes("image")) return "uploadFailed";
  return fallback;
}

function LanguageLinks({ lang, label }) {
  return (
    <nav className="language-links" aria-label={label}>
      {[
        ["zh", "中文"],
        ["en", "English"],
        ["ja", "日本語"],
      ].map(([code, text]) => (
        <a
          aria-current={lang === code ? "page" : undefined}
          className={lang === code ? "is-active" : ""}
          href={languageHref(code)}
          key={code}
        >
          {text}
        </a>
      ))}
    </nav>
  );
}

function IdentityPanel({
  identity,
  rotating,
  cooldown,
  onRotate,
  t,
  compact = false,
}) {
  return (
    <div className={`identity-panel${compact ? " is-compact" : ""}`}>
      {!compact && <span className="field-caption">{t("currentIdentity")}</span>}
      <strong style={{ color: identity?.color || "#64748b" }}>
        {identity?.displayName || "—"}
      </strong>
      <button
        className="whiteboard-button is-secondary"
        disabled={!identity || rotating || cooldown}
        onClick={onRotate}
        type="button"
      >
        {rotating ? t("rotatingName") : t("rotateName")}
      </button>
      {!compact && cooldown && (
        <small aria-live="polite">{t("rotateCooldown")}</small>
      )}
    </div>
  );
}

function Lobby({
  identity,
  identityError,
  identityLoading,
  joining,
  recentRoom,
  lang,
  onJoin,
  onRetryIdentity,
  onRotate,
  rotating,
  rotateCooldown,
  t,
}) {
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  const submitPrivate = (event) => {
    event.preventDefault();
    const normalized = normalizeRoomPassword(password);
    const characterLength = Array.from(normalized).length;
    if (
      characterLength < PASSWORD_MIN_LENGTH
      || characterLength > PASSWORD_MAX_LENGTH
    ) {
      setFormError(t("invalidPassword"));
      return;
    }
    setFormError("");
    setPassword("");
    onJoin("private", normalized);
  };

  const recentLabel = recentRoom?.roomType === "private"
    ? t("recentPrivate")
    : t("recentPublic");
  const recentTime = recentRoom
    ? new Intl.DateTimeFormat(
      lang === "ja" ? "ja-JP" : lang === "en" ? "en" : "zh-CN",
      { dateStyle: "medium", timeStyle: "short" },
    ).format(new Date(recentRoom.usedAt))
    : "";

  return (
    <main className="lobby-main">
      <section className="lobby-intro" aria-labelledby="whiteboard-heading">
        <img
          alt=""
          aria-hidden="true"
          className="lobby-app-icon"
          height="192"
          src="/assets/images/generated-icons/whiteboard.png?v=20260820-whiteboard-lobby-r1"
          width="192"
        />
        <div className="lobby-intro-copy">
          <p className="section-label">
            LUSU LIVE CANVAS
            <span className="subproject-version">v{WHITEBOARD_VERSION}</span>
          </p>
          <h1 id="whiteboard-heading">{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
      </section>

      <section className="lobby-grid" aria-label={t("title")}>
        <article className="lobby-card identity-card">
          <h2>{t("currentIdentity")}</h2>
          {identityLoading && <p role="status">{t("loadingBoard")}</p>}
          {identityError && (
            <div className="inline-error" role="alert">
              <p>{t("identityUnavailable")}</p>
              <button className="whiteboard-button" onClick={onRetryIdentity} type="button">
                {t("retry")}
              </button>
            </div>
          )}
          {!identityLoading && !identityError && (
            <IdentityPanel
              cooldown={rotateCooldown}
              identity={identity}
              onRotate={onRotate}
              rotating={rotating}
              t={t}
            />
          )}
        </article>

        <article className="lobby-card public-card">
          <h2>{t("publicTitle")}</h2>
          <p>{t("publicDescription")}</p>
          <button
            className="whiteboard-button is-primary"
            disabled={!identity || joining}
            onClick={() => onJoin("public", "")}
            type="button"
          >
            {joining ? t("joining") : t("enterPublic")}
          </button>
        </article>

        <article className="lobby-card private-card">
          <div className="lobby-card-heading">
            <h2>{t("privateTitle")}</h2>
            <details className="room-help">
              <summary aria-label={t("passwordHelpLabel")} title={t("passwordHelpLabel")}>?</summary>
              <div className="room-help-popover" role="note">{t("passwordHelp")}</div>
            </details>
          </div>
          <p>{t("privateDescription")}</p>
          <form onSubmit={submitPrivate}>
            <label className="password-field">
              <span>{t("passwordLabel")}</span>
              <input
                autoCapitalize="off"
                autoComplete="new-password"
                disabled={!identity || joining}
                maxLength={PASSWORD_MAX_LENGTH}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError("");
                }}
                placeholder={t("passwordPlaceholder")}
                spellCheck="false"
                type="password"
                value={password}
              />
            </label>
            {formError && <p className="field-error" role="alert">{formError}</p>}
            <button
              className="whiteboard-button is-primary"
              disabled={!identity || joining}
              type="submit"
            >
              {joining ? t("joining") : t("enterPrivate")}
            </button>
          </form>
          <small>{t("passwordPrivacy")}</small>
        </article>

        <article className="lobby-card recent-card">
          <h2>{t("recentRoom")}</h2>
          {recentRoom ? (
            <>
              <strong>{recentLabel}</strong>
              <p>{t("recentAt", { time: recentTime })}</p>
              {recentRoom.roomType === "public" && (
                <button
                  className="whiteboard-button is-secondary"
                  disabled={!identity || joining}
                  onClick={() => onJoin("public", "")}
                  type="button"
                >
                  {t("enterPublic")}
                </button>
              )}
            </>
          ) : (
            <p>{t("noRecentRoom")}</p>
          )}
        </article>
      </section>

      <p className="share-note">{t("shareHint")}</p>
    </main>
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function WhiteboardRoom({
  initialSession,
  initialIdentity,
  lang,
  onLeave,
  onRotateIdentity,
  rotating,
  rotateCooldown,
  t,
}) {
  const scene = useMemo(() => new YSceneController(), []);
  const sketchInitialData = useMemo(createAllRoomSketchInitialData, []);
  const apiRef = useRef(null);
  const canvasRegionRef = useRef(null);
  const collaborationRef = useRef(null);
  const assetManagerRef = useRef(null);
  const sessionRef = useRef(initialSession);
  const identityVersionRef = useRef(Number(initialSession.identity?.version || initialIdentity?.version || 1));
  const sessionMetricsRef = useRef({ startedAt: Date.now(), maxOnline: 1 });
  const [identity, setIdentity] = useState(
    safeIdentity(initialSession.identity, initialIdentity),
  );
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [showConnectionNotice, setShowConnectionNotice] = useState(false);
  const [members, setMembers] = useState([]);
  const [locked, setLocked] = useState(false);
  const [synced, setSynced] = useState(false);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const roomType = initialSession.roomType;

  useEffect(() => {
    if (connectionStatus === "connected") {
      setShowConnectionNotice(false);
      return undefined;
    }
    if (connectionStatus === "error") {
      setShowConnectionNotice(true);
      return undefined;
    }
    setShowConnectionNotice(false);
    const timer = window.setTimeout(
      () => setShowConnectionNotice(true),
      CONNECTION_NOTICE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [connectionStatus]);

  useEffect(() => {
    const collaboration = new WhiteboardCollaboration({
      roomSession: initialSession,
      scene,
      getApi: () => apiRef.current,
      callbacks: {
        onStatus: setConnectionStatus,
        onMembers: setMembers,
        onLocked: setLocked,
        onSynced: () => setSynced(true),
        onSyncReset: () => setSynced(false),
        onCleared: () => setNotice(t("cleared")),
        onSession: (session) => {
          sessionRef.current = session;
          setIdentity((current) => safeIdentity(session.identity, current));
        },
        onIdentity: (nextIdentity) => {
          setIdentity((current) => {
            const normalized = safeIdentity(nextIdentity, current);
            if (
              normalized.displayName
              && current.displayName
              && normalized.displayName !== current.displayName
            ) {
              setNotice(t("roomNameAdjusted", { name: normalized.displayName }));
            }
            return normalized;
          });
        },
        onError: (kind, error) => {
          if (["connection", "rate-limited", "reconnect"].includes(kind)) {
            if (kind === "reconnect") {
              trackWhiteboardEvent("whiteboard_reconnect_failed");
            }
            return;
          }
          setNotice(t(errorCopyKey(error, "genericError", kind)));
        },
      },
    });
    collaborationRef.current = collaboration;
    const assets = new WhiteboardAssetManager({
      scene,
      getApi: () => apiRef.current,
      getAccessToken: () => collaborationRef.current?.getAccessToken()
        || sessionRef.current.accessToken,
      onError: (error) => {
        trackWhiteboardEvent("whiteboard_image_upload_failed");
        setNotice(t(errorCopyKey(error, "uploadFailed")));
      },
      onUploaded: () => trackWhiteboardEvent("whiteboard_image_upload_success"),
    });
    assetManagerRef.current = assets;
    collaboration.start();
    return () => {
      assets.destroy();
      assetManagerRef.current = null;
      collaboration.destroy();
      collaborationRef.current = null;
      scene.destroy();
    };
  }, [initialSession, scene, t]);

  const bindApi = useCallback((api) => {
    apiRef.current = api;
    if (api) scene.bindApi(api);
  }, [scene]);

  useEffect(() => {
    const root = canvasRegionRef.current;
    if (!root) return undefined;
    const narrowFileInputs = () => {
      root.querySelectorAll('input[type="file"]').forEach((input) => {
        input.accept = WHITEBOARD_IMAGE_ACCEPT;
      });
    };
    narrowFileInputs();
    const observer = new window.MutationObserver(narrowFileInputs);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleSceneChange = useCallback((elements, appState, files) => {
    assetManagerRef.current?.processFiles(elements, files);
    scene.handleSceneChange(elements, appState, files);
  }, [scene]);

  const rejectUnsupportedImageInput = useCallback((event) => {
    const fileList = (
      event.clipboardData?.files
      || event.dataTransfer?.files
      || event.target?.files
    );
    if (!fileList?.length || whiteboardImageFilesAreSupported(fileList)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.target?.tagName === "INPUT" && event.target.type === "file") {
      event.target.value = "";
    }
    setNotice(t("uploadType"));
  }, [t]);

  const handlePointerUpdate = useCallback((payload) => {
    collaborationRef.current?.sendPointerUpdate(payload);
  }, []);

  const handleRotate = async () => {
    const nextIdentity = await onRotateIdentity();
    if (!nextIdentity) return;
    identityVersionRef.current = Number(nextIdentity.version || identityVersionRef.current);
    setIdentity((current) => safeIdentity(nextIdentity, current));
    collaborationRef.current?.forceIdentityReconnect();
  };

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    await collaborationRef.current?.waitForPendingUpdates(3_000);
    onLeave();
  };

  useEffect(() => {
    const nextVersion = Number(initialIdentity?.version || 0);
    if (!nextVersion || nextVersion === identityVersionRef.current) return;
    identityVersionRef.current = nextVersion;
    setIdentity((current) => safeIdentity(initialIdentity, current));
    collaborationRef.current?.forceIdentityReconnect();
  }, [initialIdentity]);

  const handleExport = async (format) => {
    const api = apiRef.current;
    if (!api || exporting) return;
    setExporting(format);
    try {
      const elements = api.getSceneElements();
      const appState = {
        ...api.getAppState(),
        exportBackground: true,
        exportWithDarkMode: false,
      };
      const files = api.getFiles();
      if (format === "png") {
        const blob = await exportToBlob({
          elements,
          appState,
          files,
          mimeType: "image/png",
          exportPadding: 24,
        });
        downloadBlob(blob, "lusu-whiteboard.png");
        trackWhiteboardEvent("whiteboard_export_png");
      } else {
        const svg = await exportToSvg({
          elements,
          appState,
          files,
          exportPadding: 24,
        });
        const blob = new Blob(
          [new XMLSerializer().serializeToString(svg)],
          { type: "image/svg+xml;charset=utf-8" },
        );
        downloadBlob(blob, "lusu-whiteboard.svg");
        trackWhiteboardEvent("whiteboard_export_svg");
      }
    } catch (error) {
      setNotice(t(errorCopyKey(error)));
    } finally {
      setExporting("");
    }
  };

  const shareEntry = async () => {
    const entry = new URL("/tools/whiteboard/", window.location.origin);
    entry.searchParams.set("lang", lang);
    try {
      await navigator.clipboard.writeText(entry.href);
      setNotice(t("shareCopied"));
      trackWhiteboardEvent("whiteboard_share_entry");
    } catch {
      setNotice(t("shareCopyFailed"));
    }
  };

  const allMembers = [
    {
      presenceId: "self",
      displayName: identity.displayName,
      color: identity.color,
      focused: true,
    },
    ...members,
  ];
  sessionMetricsRef.current.maxOnline = Math.max(
    sessionMetricsRef.current.maxOnline,
    allMembers.length,
  );

  useEffect(() => () => {
    const metrics = sessionMetricsRef.current;
    trackWhiteboardEvent("whiteboard_session_end", {
      duration: durationBucket(Date.now() - metrics.startedAt),
      online: onlineCountBucket(metrics.maxOnline),
    });
  }, []);

  return (
    <main className="board-shell">
      <header className="board-header">
        <div className="board-header-primary">
          <a className="header-link" href={`/?lang=${lang}#resources`}>
            {t("backToTools")}
          </a>
          <div className="board-room-copy">
            <strong>{roomType === "private" ? t("roomPrivate") : t("roomPublic")}</strong>
            <span className="subproject-version">v{WHITEBOARD_VERSION}</span>
            <span className={`connection-state is-${connectionStatus}`}>
              {t(`connection${connectionStatus[0].toUpperCase()}${connectionStatus.slice(1)}`)}
            </span>
          </div>
        </div>

        <div className="board-header-actions">
          <IdentityPanel
            compact
            cooldown={rotateCooldown}
            identity={identity}
            onRotate={handleRotate}
            rotating={rotating}
            t={t}
          />
          <button
            aria-expanded={membersOpen}
            className="whiteboard-button is-secondary"
            onClick={() => setMembersOpen((open) => !open)}
            type="button"
          >
            {t("onlineCount", { count: allMembers.length })}
          </button>
          <details className="export-menu">
            <summary className="whiteboard-button is-secondary">{t("export")}</summary>
            <div className="export-actions">
              <button
                disabled={Boolean(exporting)}
                onClick={() => handleExport("png")}
                type="button"
              >
                {exporting === "png" ? t("exporting") : t("exportPng")}
              </button>
              <button
                disabled={Boolean(exporting)}
                onClick={() => handleExport("svg")}
                type="button"
              >
                {exporting === "svg" ? t("exporting") : t("exportSvg")}
              </button>
              <button onClick={shareEntry} type="button">{t("shareEntry")}</button>
            </div>
          </details>
          <button
            className="whiteboard-button is-danger"
            disabled={leaving}
            onClick={handleLeave}
            type="button"
          >
            {leaving ? t("leavingRoom") : t("leaveRoom")}
          </button>
        </div>
      </header>

      <div className="board-status-stack">
        {locked && <div className="locked-banner" role="status">{t("readOnly")}</div>}
        {notice && (
          <div className="notice-banner" role="alert">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} type="button">{t("dismiss")}</button>
          </div>
        )}
      </div>

      {showConnectionNotice && connectionStatus !== "connected" && (
        <div className={`connection-corner is-${connectionStatus}`} role="status">
          <span className="connection-corner-dot" aria-hidden="true" />
          <span>
            {["reconnecting", "offline"].includes(connectionStatus)
              ? t("reconnectingNotice")
              : t(`connection${connectionStatus[0].toUpperCase()}${connectionStatus.slice(1)}`)}
          </span>
        </div>
      )}

      <section
        className="canvas-region"
        aria-label={t("title")}
        onChangeCapture={rejectUnsupportedImageInput}
        onDropCapture={rejectUnsupportedImageInput}
        onPasteCapture={rejectUnsupportedImageInput}
        onPointerDownCapture={(event) => {
          collaborationRef.current?.notePointerType(event.pointerType);
        }}
        ref={canvasRegionRef}
      >
        {!synced && <div className="canvas-loading" role="status">{t("loadingBoard")}</div>}
        <Excalidraw
          aiEnabled={false}
          autoFocus
          excalidrawAPI={bindApi}
          generateIdForFile={async () => (
            `file_${crypto.randomUUID().replaceAll("-", "")}`
          )}
          initialData={sketchInitialData}
          isCollaborating
          langCode={getExcalidrawLanguage(lang)}
          onChange={handleSceneChange}
          onPointerUpdate={handlePointerUpdate}
          theme="light"
          UIOptions={{
            canvasActions: {
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveAsImage: false,
              saveToActiveFile: false,
            },
            tools: {
              image: true,
            },
          }}
          viewModeEnabled={locked || leaving}
        />
      </section>

      {membersOpen && (
        <aside className="members-panel" aria-label={t("members")}>
          <div className="members-heading">
            <h2>{t("members")}</h2>
            <button onClick={() => setMembersOpen(false)} type="button">{t("close")}</button>
          </div>
          <ul>
            {allMembers.map((member) => (
              <li
                key={member.presenceId}
                style={{ color: member.color }}
                title={member.displayName}
              >
                {member.displayName}
              </li>
            ))}
          </ul>
        </aside>
      )}

      <p className="mobile-gesture-hint">{t("mobileHint")}</p>
    </main>
  );
}

function App() {
  const lang = useMemo(getLanguage, []);
  const t = useCallback(
    (key, variables) => translate(lang, key, variables),
    [lang],
  );
  const [identity, setIdentity] = useState(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateCooldown, setRotateCooldown] = useState(false);
  const [recentRoom, setRecentRoom] = useState(readRecentRoom);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [roomSession, setRoomSession] = useState(null);

  useVisualViewport();

  useEffect(() => {
    document.documentElement.lang = getHtmlLanguage(lang);
    document.title = t("pageTitle");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("subtitle"));
    trackWhiteboardEvent("whiteboard_page_view");
  }, [lang, t]);

  const loadIdentity = useCallback(async () => {
    setIdentityLoading(true);
    setIdentityError(false);
    try {
      setIdentity(await getAnonymousIdentity());
    } catch {
      setIdentityError(true);
    } finally {
      setIdentityLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getAnonymousIdentity(controller.signal)
      .then(setIdentity)
      .catch((error) => {
        if (error?.name !== "AbortError") setIdentityError(true);
      })
      .finally(() => setIdentityLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => subscribeAnonymousIdentityChanges((nextIdentity) => {
    setIdentity((current) => {
      if (
        Number(current?.version || 0) === Number(nextIdentity.version || 0)
        && current?.displayName === nextIdentity.displayName
        && current?.color === nextIdentity.color
      ) {
        return current;
      }
      return nextIdentity;
    });
  }), []);

  const handleRotate = useCallback(async () => {
    if (rotating || rotateCooldown) return null;
    setRotating(true);
    try {
      const nextIdentity = await rotateAnonymousIdentity();
      setIdentity(nextIdentity);
      setRotateCooldown(true);
      window.setTimeout(() => setRotateCooldown(false), NAME_COOLDOWN_MS);
      trackWhiteboardEvent("whiteboard_name_rotate");
      return nextIdentity;
    } catch (error) {
      setJoinError(t(errorCopyKey(error)));
      return null;
    } finally {
      setRotating(false);
    }
  }, [rotateCooldown, rotating, t]);

  const handleJoin = useCallback(async (roomType, password) => {
    if (!identity || joining) return;
    setJoining(true);
    setJoinError("");
    try {
      const session = await joinRoom(roomType, password);
      setIdentity((current) => safeIdentity(session.identity, current));
      setRecentRoom(writeRecentRoom(roomType));
      setRoomSession({ ...session, roomType });
      trackWhiteboardEvent(
        roomType === "private" ? "whiteboard_private_join" : "whiteboard_public_join",
      );
    } catch (error) {
      setJoinError(t(errorCopyKey(error, "joinFailed")));
      trackWhiteboardEvent("whiteboard_join_failed");
    } finally {
      setJoining(false);
    }
  }, [identity, joining, t]);

  if (roomSession) {
    return (
      <WhiteboardRoom
        initialIdentity={identity}
        initialSession={roomSession}
        lang={lang}
        onLeave={() => {
          setRoomSession(null);
          setJoinError("");
        }}
        onRotateIdentity={handleRotate}
        rotateCooldown={rotateCooldown}
        rotating={rotating}
        t={t}
      />
    );
  }

  return (
    <div className="whiteboard-page">
      <header className="lobby-header">
        <a className="header-link" href={`/?lang=${lang}#resources`}>
          {t("backToTools")}
        </a>
        <LanguageLinks label={t("language")} lang={lang} />
      </header>
      {joinError && (
        <div className="page-error" role="alert">
          <span>{joinError}</span>
          <button onClick={() => setJoinError("")} type="button">{t("dismiss")}</button>
        </div>
      )}
      <Lobby
        identity={identity}
        identityError={identityError}
        identityLoading={identityLoading}
        joining={joining}
        lang={lang}
        onJoin={handleJoin}
        onRetryIdentity={loadIdentity}
        onRotate={handleRotate}
        recentRoom={recentRoom}
        rotateCooldown={rotateCooldown}
        rotating={rotating}
        t={t}
      />
    </div>
  );
}

createRoot(document.getElementById("whiteboard-root")).render(<App />);
