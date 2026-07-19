export const VIDEO_IFRAME_LOAD_TIMEOUT_MS = 8000;

export function createVideosRoute({
  state: videoState,
  activeFilters,
  content,
  siteUpdateCategory,
  requestJson,
  isAbortError,
  t,
  localText,
  formatArticleDate,
  safeHttpUrl,
  markStatusMessage,
  getCurrentLang,
  videoWindowState,
  modalFocusState,
  cancelSurfaceClose,
  modalTriggerCandidate,
  syncModalIsolation,
  runWindowLayoutTransition,
  runSurfaceClose,
  restoreModalFocus
}) {
  async function loadVideos(options = {}) {
    const requestId = videoState.requestId + 1;
    const requestedLang = getCurrentLang();
    videoState.requestId = requestId;
    videoState.loading = true;
    videoState.error = "";
    renderVideos();
    const applyResult = (result, { background = false } = {}) => {
      if (requestId !== videoState.requestId || getCurrentLang() !== requestedLang) return;
      const payload = result.data || {};
      videoState.categories = payload.categories || [];
      videoState.videos = payload.videos || [];
      videoState.error = result.error ? (result.error.message || "failed") : "";
      const known = new Set(["all", ...videoState.categories.map((category) => category.category_id)]);
      if (!known.has(activeFilters.videos)) activeFilters.videos = "all";
      if (background && document.body.dataset.route === "videos") renderVideos();
    };
    try {
      const result = await requestJson("videos", `/api/videos?lang=${encodeURIComponent(requestedLang)}`, {
        signal: options.signal,
        force: options.force === true,
        maxAgeMs: 30000,
        staleWhileRevalidate: options.force !== true,
        onRevalidated: (revalidated) => applyResult(revalidated, { background: true })
      });
      applyResult(result);
    } catch (error) {
      if (requestId !== videoState.requestId || isAbortError(error)) return;
      videoState.error = error.message || "failed";
    } finally {
      if (requestId === videoState.requestId) {
        videoState.loading = false;
        renderVideos();
      }
    }
  }

  function renderVideos() {
    const list = document.getElementById("video-list");
    renderVideoCategoryButtons();
    list.replaceChildren();
    if (videoState.loading && !videoState.videos.length) {
      list.appendChild(renderVideoStatusState("loading"));
      return;
    }
    if (videoState.error && !videoState.videos.length) {
      list.appendChild(renderVideoStatusState("failed"));
      return;
    }
    const items = videoState.videos.filter((item) => (
      activeFilters.videos === "all"
        || (item.categories || []).some((category) => category.category_id === activeFilters.videos)
    ));
    if (!items.length) {
      list.appendChild(renderVideoEmptyState(videoState.videos.length > 0));
      return;
    }
    items.forEach((item) => list.appendChild(videoCardElement(item)));
    if (videoState.loading) list.prepend(renderVideoRecoveryNotice("loading"));
    else if (videoState.error) list.prepend(renderVideoRecoveryNotice("failed"));
  }

  function renderVideoRecoveryNotice(kind) {
    const notice = document.createElement("div");
    notice.className = `content-recovery-notice ${kind === "failed" ? "is-error" : "is-loading"}`;
    markStatusMessage(notice);
    const copy = document.createElement("p");
    copy.textContent = videoUiText(kind);
    notice.appendChild(copy);
    if (kind === "failed") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "xp-button";
      retry.dataset.videoRetry = "";
      retry.textContent = videoUiText("retryAction");
      notice.appendChild(retry);
    }
    return notice;
  }

  function renderVideoStatusState(kind) {
    const state = document.createElement("article");
    state.className = "video-empty-state video-status-state";

    const icon = document.createElement("span");
    icon.className = `video-empty-icon${kind === "failed" ? " is-error" : ""}`;
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    copy.className = "video-empty-copy";
    markStatusMessage(copy);
    const title = document.createElement("h2");
    title.textContent = videoUiText(kind);

    copy.appendChild(title);
    state.append(icon, copy);
    if (kind === "failed") {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "xp-button";
      action.dataset.videoRetry = "";
      action.textContent = videoUiText("retryAction");
      state.appendChild(action);
    }
    return state;
  }

  function renderVideoEmptyState(isFiltered = false) {
    const state = document.createElement("article");
    state.className = "video-empty-state";

    const icon = document.createElement("span");
    icon.className = "video-empty-icon";
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    copy.className = "video-empty-copy";
    const title = document.createElement("h2");
    title.textContent = videoUiText("emptyTitle");
    const text = document.createElement("p");
    text.textContent = videoUiText(isFiltered ? "emptyFiltered" : "emptyBody");
    copy.append(title, text);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "xp-button";
    action.dataset.articleCategory = siteUpdateCategory;
    action.textContent = videoUiText("emptyAction");

    state.append(icon, copy, action);
    return state;
  }

  function renderVideoCategoryButtons() {
    const target = document.getElementById("video-categories");
    target.replaceChildren();
    target.hidden = videoState.videos.length === 0;
    if (target.hidden) {
      activeFilters.videos = "all";
      return;
    }
    const counts = new Map(videoState.categories.map((category) => [category.category_id, 0]));
    videoState.videos.forEach((item) => {
      (item.categories || []).forEach((category) => {
        const key = category.category_id;
        if (counts.has(key)) {
          counts.set(key, counts.get(key) + 1);
        }
      });
    });

    const categories = [{ category_id: "all", name: t("all") }, ...videoState.categories];
    categories.forEach((category) => {
      const button = document.createElement("button");
      const name = category.name || category.name_zh || category.slug || t("all");
      const countValue = category.category_id === "all" ? videoState.videos.length : counts.get(category.category_id) || 0;
      button.type = "button";
      button.dataset.filterType = "videos";
      button.dataset.filter = category.category_id;
      button.title = name;
      button.setAttribute("aria-label", `${name} ${countValue}`);
      const active = activeFilters.videos === category.category_id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      const labelNode = document.createElement("span");
      labelNode.textContent = name;
      const countNode = document.createElement("span");
      countNode.className = "filter-count";
      countNode.textContent = String(countValue);
      button.append(labelNode, countNode);
      target.appendChild(button);
    });
  }

  function videoCardElement(item) {
    const card = document.createElement("article");
    card.className = "video-card";
    const videoTitleText = item.title || videoUiText("untitled");
    const videoPlayLabel = `${videoUiText("playAria")}: ${videoTitleText}`;

    const thumb = document.createElement("div");
    thumb.className = "video-thumb";
    thumb.dataset.videoId = item.video_id;
    thumb.dataset.videoSource = "thumbnail";
    thumb.setAttribute("aria-hidden", "true");
    const thumbnailUrl = safeVideoThumbnailSrc(item.thumbnail_url);
    if (thumbnailUrl) {
      const image = document.createElement("img");
      image.src = thumbnailUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.fetchPriority = "low";
      const thumbnailWidth = Number(item.thumbnail_width) || 0;
      const thumbnailHeight = Number(item.thumbnail_height) || 0;
      if (thumbnailWidth > 0 && thumbnailWidth <= 960 && thumbnailHeight > 0 && thumbnailHeight <= 540) {
        image.width = thumbnailWidth;
        image.height = thumbnailHeight;
      }
      image.addEventListener("error", () => {
        thumb.classList.add("is-fallback");
        image.remove();
      }, { once: true });
      thumb.appendChild(image);
    } else {
      thumb.classList.add("is-fallback");
    }

    const body = document.createElement("div");
    body.className = "video-body";
    const platform = document.createElement("span");
    platform.className = `platform ${String(item.platform || "").toLowerCase()}`;
    platform.textContent = item.platform === "youtube" ? "YouTube" : "Bilibili";
    const title = document.createElement("h2");
    title.textContent = videoTitleText;
    const desc = document.createElement("p");
    desc.textContent = item.description || videoUiText("noDescription");
    const meta = document.createElement("div");
    meta.className = "video-meta";
    [item.author_name, formatArticleDate(item.published_at)].filter(Boolean).forEach((text) => {
      const span = document.createElement("span");
      span.textContent = text;
      meta.appendChild(span);
    });
    const button = document.createElement("button");
    button.className = "card-action";
    button.type = "button";
    button.dataset.videoId = item.video_id;
    button.setAttribute("aria-label", videoPlayLabel);
    button.textContent = t("playButton");

    body.append(platform, title, desc, meta, button);
    card.append(thumb, body);
    return card;
  }

  function safeVideoThumbnailSrc(src) {
    const value = String(src || "").trim();
    if (!value) {
      return "";
    }
    if (/^data:image\/(avif|jpe?g|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value)) {
      return value;
    }
    try {
      const url = new URL(value, window.location.origin);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const allowed = new Set([
        "i.ytimg.com",
        "img.youtube.com",
        "i0.hdslb.com",
        "i1.hdslb.com",
        "i2.hdslb.com",
        "archive.biliimg.com"
      ]);
      const controlledLocalThumbnail = url.origin === window.location.origin
        && /^\/api\/videos\/[^/]+\/thumbnail$/.test(url.pathname);
      return url.protocol === "https:" && (allowed.has(host) || controlledLocalThumbnail) ? url.toString() : "";
    } catch (error) {
      return "";
    }
  }

  function safeVideoSourceUrl(src) {
    const url = safeHttpUrl(src);
    if (!url) {
      return "";
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      return host === "youtube.com"
        || host === "youtu.be"
        || host === "bilibili.com"
        || host.endsWith(".bilibili.com")
        || host === "b23.tv"
        ? parsed.toString()
        : "";
    } catch (error) {
      return "";
    }
  }

  function safeVideoEmbedUrl(src) {
    const url = safeHttpUrl(src);
    if (!url) {
      return null;
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      const isYoutube = host === "youtube.com" && parsed.pathname.startsWith("/embed/");
      const isBilibili = host === "player.bilibili.com" && parsed.pathname === "/player.html";
      return isYoutube || isBilibili ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function videoAutoplayUrl(src) {
    const url = safeVideoEmbedUrl(src);
    if (!url) {
      return "";
    }
    if (url.hostname.toLowerCase().includes("youtube.com")) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("rel", "0");
      url.searchParams.set("modestbranding", "1");
      url.searchParams.set("iv_load_policy", "3");
    }
    if (url.hostname.toLowerCase().includes("bilibili.com")) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("high_quality", "1");
      url.searchParams.set("as_wide", "1");
      url.searchParams.set("danmaku", "0");
    }
    return url.toString();
  }

  function videoUiText(key) {
    const copy = {
      loading: { zh: "正在读取视频...", en: "Loading videos...", ja: "動画を読み込み中..." },
      failed: { zh: "视频读取失败，请稍后再试。", en: "Videos failed to load. Please try again later.", ja: "動画を読み込めませんでした。後でお試しください。" },
      empty: { zh: "这里还没有发布的视频。", en: "No published videos yet.", ja: "公開済みの動画はまだありません。" },
      emptyTitle: { zh: "视频还在整理中", en: "Videos are being organized", ja: "動画を整理中です" },
      emptyBody: { zh: "这里会放 Bilibili / YouTube 作品、收藏和网站施工记录。可以先查看最近的网站更新。", en: "Bilibili / YouTube works, favorites, and build logs will live here. You can check recent site updates first.", ja: "ここには Bilibili / YouTube の作品、保存動画、制作記録を置く予定です。まずは最近のサイト更新を確認できます。" },
      emptyFiltered: { zh: "当前分类暂时没有公开视频，换个分类或先看看网站更新记录。", en: "This category has no published videos yet. Try another category or check site updates.", ja: "このカテゴリには公開動画がまだありません。別のカテゴリ、またはサイト更新記録を確認してください。" },
      emptyAction: { zh: "查看网站更新", en: "View site updates", ja: "サイト更新を見る" },
      retryAction: { zh: "重新读取视频", en: "Retry loading videos", ja: "動画を再読み込み" },
      untitled: { zh: "未命名视频", en: "Untitled video", ja: "無題の動画" },
      noDescription: { zh: "暂无简介。", en: "No description yet.", ja: "説明はまだありません。" },
      unsupported: { zh: "该视频暂不支持站内播放", en: "This video cannot be played inline right now.", ja: "この動画は現在サイト内再生に対応していません。" },
      playAria: { zh: "播放视频", en: "Play video", ja: "動画を再生" },
      playerFailedTitle: { zh: "播放器暂时无法载入", en: "The player could not load", ja: "プレーヤーを読み込めませんでした" },
      playerFailedBody: { zh: "可以重试站内播放，或打开原视频继续观看。", en: "Retry the embedded player or open the original video to keep watching.", ja: "埋め込み再生を再試行するか、元の動画を開いて視聴を続けられます。" },
      playerRetry: { zh: "重试播放器", en: "Retry player", ja: "プレーヤーを再試行" },
      playerUnsupportedTitle: { zh: "此视频暂不支持站内播放", en: "Inline playback is unavailable", ja: "サイト内再生には対応していません" },
      playerUnsupportedBody: { zh: "请使用下方按钮打开原视频。", en: "Use the button below to open the original video.", ja: "下のボタンから元の動画を開いてください。" }
    };
    return copy[key]?.[getCurrentLang()] || copy[key]?.zh || key;
  }

  function clearVideoPlayerTimer() {
    if (!videoState.playerTimer) return;
    window.clearTimeout(videoState.playerTimer);
    videoState.playerTimer = 0;
  }

  function invalidateVideoPlayer() {
    clearVideoPlayerTimer();
    videoState.playerRequestId = (videoState.playerRequestId || 0) + 1;
  }

  function renderVideoPlayerFailure(video, { retryable = true, requestId = 0 } = {}) {
    if (requestId && requestId !== videoState.playerRequestId) return;
    clearVideoPlayerTimer();
    const frame = document.getElementById("video-frame");
    if (!frame) return;
    frame.dataset.videoPlayerState = retryable ? "failed" : "unsupported";
    frame.removeAttribute("aria-busy");
    const fallback = document.createElement("div");
    fallback.className = "video-player-fallback";
    fallback.setAttribute("role", "status");
    fallback.setAttribute("aria-live", "polite");
    const icon = document.createElement("span");
    icon.className = "video-placeholder-asset";
    icon.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    copy.className = "video-player-fallback-copy";
    const title = document.createElement("h2");
    title.textContent = videoUiText(retryable ? "playerFailedTitle" : "playerUnsupportedTitle");
    const body = document.createElement("p");
    body.textContent = video.metadata_error || videoUiText(retryable ? "playerFailedBody" : "playerUnsupportedBody");
    copy.append(title, body);
    fallback.append(icon, copy);
    if (retryable) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "xp-button";
      retry.dataset.videoPlayerRetry = video.video_id || video.external_id || "";
      retry.textContent = videoUiText("playerRetry");
      fallback.appendChild(retry);
    }
    frame.replaceChildren(fallback);
    window.lusuTrackClick?.("video:play-failed", video.video_id || video.external_id || "video", { route: "videos" });
  }

  function mountVideoPlayer(video, { focusPlayer = false } = {}) {
    const frame = document.getElementById("video-frame");
    const embedUrl = videoAutoplayUrl(video.embed_url);
    invalidateVideoPlayer();
    const requestId = videoState.playerRequestId;
    if (!embedUrl) {
      renderVideoPlayerFailure(video, { retryable: false, requestId });
      return;
    }
    frame.dataset.videoPlayerState = "loading";
    frame.setAttribute("aria-busy", "true");
    const shell = document.createElement("div");
    shell.className = "video-embed-shell";
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.title = localText(video.title) || "Video Player";
    iframe.allow = "autoplay; fullscreen; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.dataset.videoPlayer = "";
    const settleLoaded = () => {
      if (requestId !== videoState.playerRequestId) return;
      clearVideoPlayerTimer();
      frame.dataset.videoPlayerState = "ready";
      frame.removeAttribute("aria-busy");
      if (focusPlayer) iframe.focus({ preventScroll: true });
    };
    const settleFailed = () => renderVideoPlayerFailure(video, { retryable: true, requestId });
    iframe.addEventListener("load", settleLoaded, { once: true });
    iframe.addEventListener("error", settleFailed, { once: true });
    shell.appendChild(iframe);
    frame.replaceChildren(shell);
    videoState.playerTimer = window.setTimeout(settleFailed, VIDEO_IFRAME_LOAD_TIMEOUT_MS);
    window.lusuTrackClick?.("video:player-open", video.video_id || video.external_id || "video", { route: "videos" });
  }

  function retryVideoPlayer(videoId) {
    const video = videoState.videos.find((item) => item.video_id === videoId)
      || videoState.videos.find((item) => item.external_id === videoId);
    if (!video) return;
    mountVideoPlayer(video, { focusPlayer: true });
  }

  function openVideo(index, options) {
    const modalOptions = options && typeof options === "object" ? options : {};
    const video = typeof index === "number"
      ? content.videos[index]
      : videoState.videos.find((item) => item.video_id === index);
    const modal = document.getElementById("video-modal");
    const frame = document.getElementById("video-frame");
    const sourceLink = document.getElementById("video-link");
    cancelSurfaceClose(modal);
    frame.replaceChildren();
    if (!video) {
      window.lusuTrackClick?.("video:play-failed", "video not found", { route: "videos" });
      return;
    }
    modalFocusState.videoTrigger = modalTriggerCandidate(modalOptions.trigger, modal)
      || modalTriggerCandidate(document.activeElement, modal);
    const videoTitle = localText(video.title) || "Video Player";
    document.getElementById("modal-title").textContent = videoTitle;
    if (sourceLink) {
      const originalUrl = safeVideoSourceUrl(video.original_url || video.url || "");
      if (originalUrl) {
        const sourceLabel = `${t("openOriginal")}: ${videoTitle}`;
        sourceLink.href = originalUrl;
        sourceLink.target = "_blank";
        sourceLink.rel = "noreferrer noopener";
        sourceLink.setAttribute("aria-label", sourceLabel);
        sourceLink.setAttribute("title", sourceLabel);
        sourceLink.hidden = false;
      } else {
        sourceLink.hidden = true;
        sourceLink.removeAttribute("href");
        sourceLink.removeAttribute("aria-label");
        sourceLink.removeAttribute("title");
      }
    }
    videoState.activeVideoId = video.video_id || video.external_id || "";
    mountVideoPlayer(video);
    modal.hidden = false;
    syncModalIsolation();
    setVideoWindowMaximized(false);
    modal.querySelector("button[data-close-modal]")?.focus({ preventScroll: true });
  }

  function updateVideoWindowButton() {
    const button = document.getElementById("video-window-maximize");
    if (!button) {
      return;
    }
    const labelText = videoWindowState.maximized ? t("videoRestore") : t("videoFullscreen");
    button.setAttribute("aria-label", labelText);
    button.setAttribute("title", labelText);
    button.setAttribute("aria-pressed", String(videoWindowState.maximized));
  }

  function setVideoWindowMaximized(maximized) {
    const modal = document.getElementById("video-modal");
    videoWindowState.maximized = Boolean(maximized);
    modal?.classList.toggle("is-video-maximized", videoWindowState.maximized);
    updateVideoWindowButton();
  }

  function fullscreenVideo() {
    const nextMaximized = !videoWindowState.maximized;
    const modal = document.getElementById("video-modal");
    const windowSurface = modal?.querySelector(".xp-window") || modal;
    runWindowLayoutTransition(nextMaximized ? "window-maximize" : "window-restore", windowSurface, () => {
      setVideoWindowMaximized(nextMaximized);
    });
  }

  function closeVideo(options = {}) {
    const modal = document.getElementById("video-modal");
    const wasOpen = modal && !modal.hidden;
    invalidateVideoPlayer();
    const finalizeClose = () => {
      videoState.activeVideoId = "";
      setVideoWindowMaximized(false);
      if (modal) modal.hidden = true;
      syncModalIsolation();
      const frame = document.getElementById("video-frame");
      const sourceLink = document.getElementById("video-link");
      frame.replaceChildren();
      frame.dataset.videoPlayerState = "idle";
      frame.removeAttribute("aria-busy");
      if (sourceLink) {
        sourceLink.hidden = true;
        sourceLink.removeAttribute("href");
        sourceLink.removeAttribute("aria-label");
        sourceLink.removeAttribute("title");
      }
      const placeholder = document.createElement("div");
      placeholder.className = "video-placeholder";
      const icon = document.createElement("span");
      icon.className = "video-placeholder-asset";
      icon.setAttribute("aria-hidden", "true");
      const text = document.createElement("p");
      text.textContent = t("videoPlaceholder");
      placeholder.append(icon, text);
      frame.appendChild(placeholder);
      if (wasOpen && options.restoreFocus !== false) restoreModalFocus("videoTrigger");
    };
    if (!wasOpen) {
      finalizeClose();
      return;
    }
    runSurfaceClose(modal, {
      motion: options.motion,
      origin: modalFocusState.videoTrigger
    }, finalizeClose);
  }

  return Object.freeze({
    loadVideos,
    renderVideos,
    renderVideoCategoryButtons,
    openVideo,
    retryVideoPlayer,
    updateVideoWindowButton,
    setVideoWindowMaximized,
    fullscreenVideo,
    closeVideo
  });
}
