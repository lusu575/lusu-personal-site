// Active migration bundle. Keep the immediately preceding insert-only release here so
// databases upgrading across either release retain both public update records.
export function articleReleaseSeedStatements(env, { articleTranslationsStatements }) {
  return [
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-24-window-morph-step2-gate', '2026-11-24-window-morph-step2-gate', 'site-updates', '["site-updates","animation","ui"]', '', 'published', 0, 0, '2026-11-24T10:28:00+08:00', '2026-11-24T10:28:00+08:00', '2026-11-24T10:28:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-24-window-morph-step2-gate", {
  "zh": {
    "title": "窗口打开动画重构：纯色矩形几何扩张最小验证门槛上线",
    "summary": "按 Matched Geometry Shell Transition 技术方案启动窗口动画重构：完成 r61 冲突基线诊断，上线独立过渡层的纯深色圆角矩形 1000ms 线性几何验证门槛，待验收后进入后续阶段。",
    "content_markdown": "# 窗口打开动画重构：纯色矩形几何扩张最小验证门槛上线\n\n本次 `r64` 执行窗口打开动画重构第一步与第二步（硬门槛验证）：\n\n- **第一步基线诊断**：确认原 `r61` 因 `.xp-window` 同时存在 `ui-motion.js` WAAPI 动画与 CSS `transition: transform 0.2s`，导致内联 `transform` 被覆盖，表现为窗口直接出现并轻微抖动。\n- **第二步纯色矩形验证**：建立独立固定过渡层 `#pond-window-morph-layer`（`crt-window-morph-step2.mjs`），点击首页六枚桌面图标时用纯深色圆角矩形从实际图标矩形向目标窗口矩形执行 `1000ms` 线性几何扩张（不加载窗口内容，点空白或按 `Esc` 收起，池塘持续正常运行），等待第二步验收通过后推进第三至第八步。"
  },
  "en": {
    "title": "Window Animation Rebuild: Step 2 Pure-Rectangle Geometry Gate",
    "summary": "Started the Matched Geometry Shell Transition rebuild: completed r61 WAAPI/CSS conflict diagnosis and deployed the Step 2 independent pure dark rounded-rectangle 1000ms linear expansion gate.",
    "content_markdown": "# Window Animation Rebuild: Step 2 Pure-Rectangle Geometry Gate\n\nRelease `r64` completes Steps 1 and 2 (hard gate) of the window animation rebuild:\n\n- **Step 1 Diagnosis**: Confirmed `r61` was overridden by `ui-motion.js` WAAPI animations and `.xp-window` CSS `transition: transform 0.2s`.\n- **Step 2 Pure-Rectangle Gate**: Added an independent `#pond-window-morph-layer` overlay (`crt-window-morph-step2.mjs`) expanding a pure dark rounded rectangle linearly over 1000ms from the actual clicked icon rect to the target window rect without triggering business content while the pond runs uninterrupted."
  },
  "ja": {
    "title": "ウィンドウ開閉アニメーション再構築：ステップ2 純色矩形検証ゲート公開",
    "summary": "Matched Geometry Shell Transition 方針に基づき r61 の競合診断を完了し、独立オーバーレイ層でアイコン矩形からウィンドウ矩形へ 1000ms 線形拡張するステップ2 検証ゲートを公開しました。",
    "content_markdown": "# ウィンドウ開閉アニメーション再構築：ステップ2 純色矩形検証ゲート公開\n\n`r64` ではウィンドウアニメーション再構築のステップ1・ステップ2（検証ゲート）を実施しました：\n\n- **ステップ1 診断**：`r61` が `ui-motion.js` の WAAPI と `.xp-window` の CSS `transition` と競合し、`transform` が上書きされていた原因を特定しました。\n- **ステップ2 純色矩形ゲート**：独立オーバーレイ `#pond-window-morph-layer`（`crt-window-morph-step2.mjs`）を追加し、アイコン矩形から目標ウィンドウ矩形へ 1000ms 線形拡張する最小検証を公開しています。"
  }
}, "2026-11-24T10:28:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-chat-shift-enter-newline', '2026-11-23-pond-chat-shift-enter-newline', 'site-updates', '["site-updates","chatroom","ux"]', '', 'published', 0, 0, '2026-11-23T20:48:00+08:00', '2026-11-23T20:48:00+08:00', '2026-11-23T20:48:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-chat-shift-enter-newline", {
  "zh": {
    "title": "聊天室 Shift+Enter 换行兜底修复与输入法防误发保持",
    "summary": "修复部分浏览器及快捷键环境下聊天室按 Shift+Enter 未插入换行的问题：全程不阻断默认换行，并在宿主未自动插入时补齐单次换行，同时保持普通 Enter 发送与中文输入法防误发。",
    "content_markdown": "# 聊天室 Shift+Enter 换行兜底修复与输入法防误发保持\n\n本次 `r63` 修复聊天室 `Shift+Enter` 换行在部分环境被吞的问题：\n\n- **不阻断原生换行 + 单次补插兜底**：按 `Shift+Enter` 时绝不调用 `preventDefault()`；若浏览器已原生插入换行则不做任何操作，若宿主环境未插入换行则在光标位置补插一次 `\\n` 并同步字数统计，严格遵守 300 字上限且不产生双换行。\n- **其余交互不变**：普通无 Shift 且非中文输入法组合态的 `Enter` 仍直接发送，拼音选词确认绝不误发。"
  },
  "en": {
    "title": "Chatroom Shift+Enter Newline Fallback Fix",
    "summary": "Ensured Shift+Enter reliably inserts a single newline across browsers and automated key dispatch without calling preventDefault, while preserving plain Enter send and IME composition safety.",
    "content_markdown": "# Chatroom Shift+Enter Newline Fallback Fix\n\nRelease `r63` fixes cases where `Shift+Enter` did not insert a newline in the chatroom textarea:\n\n- **Non-blocking Native Newline + Fallback**: `Shift+Enter` never calls `preventDefault()`. If the host environment already inserted a newline natively, nothing extra runs; if no newline was inserted, a single `\\n` is inserted at the caret and synced with the 300-character counter.\n- **Unchanged Send & IME Safety**: Plain non-composing `Enter` still submits normally, and CJK IME candidate confirmation remains protected."
  },
  "ja": {
    "title": "チャット入力欄の Shift+Enter 改行フォールバック修正",
    "summary": "一部環境でチャット入力欄の Shift+Enter 改行が反映されない問題を修正しました。既定の改行動作を阻害せず未挿入時のみ1回改行を補完し、通常 Enter 送信と IME 誤送信防止を維持します。",
    "content_markdown": "# チャット入力欄の Shift+Enter 改行フォールバック修正\n\n`r63` ではチャット入力欄で `Shift+Enter` の改行が反映されないケースを修正しました：\n\n- **既定動作優先＋単一改行補完**：`Shift+Enter` で `preventDefault()` を呼ばず、ブラウザが改行を挿入しなかった環境のみカーソル位置へ `\\n` を1回補完し文字数カウントへ同期します。\n- **送信・IME 保護維持**：変換中でない通常 `Enter` での送信と IME 変換確定時の誤送信防止はそのまま維持されます。"
  }
}, "2026-11-23T20:48:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-chat-enter-send-ime', '2026-11-23-pond-chat-enter-send-ime', 'site-updates', '["site-updates","chatroom","ux"]', '', 'published', 0, 0, '2026-11-23T20:36:00+08:00', '2026-11-23T20:36:00+08:00', '2026-11-23T20:36:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-chat-enter-send-ime", {
  "zh": {
    "title": "聊天室支持回车直接发送、Shift+Enter 换行与中文输入法防误发",
    "summary": "聊天室输入框现在按 Enter 即可直接发送消息，按 Shift+Enter 换行；内置四重中文输入法组合态保护，拼音选词按回车确认绝不误发，限速与字数规则不变。",
    "content_markdown": "# 聊天室支持回车直接发送、Shift+Enter 换行与中文输入法防误发\n\n本次 `r62` 优化聊天室输入框键盘交互：\n\n- **Enter 发送 / Shift+Enter 换行**：在聊天室输入框中直接按 `Enter` 会调用原生表单提交发送消息，按 `Shift+Enter` 插入换行符。\n- **中文输入法防误发**：结合 `event.isComposing`、`compositionstart` / `compositionend` 状态、`keyCode === 229` 及组合结束 80ms 保护窗，拼音/日文选词按回车上屏时绝不会误触发发送。\n- **原有规则不变**：每 3 秒一条限速、300 字上限与发送成功后自动清空输入框均保持原样。"
  },
  "en": {
    "title": "Chatroom Enter-to-Send, Shift+Enter Newline & IME Composition Guard",
    "summary": "Pressing Enter in the chatroom input now sends the message while Shift+Enter inserts a newline, with full IME composition protection so confirming CJK candidates never submits prematurely.",
    "content_markdown": "# Chatroom Enter-to-Send, Shift+Enter Newline & IME Composition Guard\n\nRelease `r62` updates chatroom keyboard behavior:\n\n- **Enter to Send / Shift+Enter for Newline**: Pressing plain `Enter` submits `#chat-form` via `requestSubmit()`, while `Shift+Enter` inserts a newline.\n- **Bulletproof IME Guard**: Checks `event.isComposing`, `compositionstart`/`compositionend` state, `keyCode === 229`, and an 80ms post-composition grace window so confirming Pinyin/Japanese IME candidates with Enter never triggers an accidental send.\n- **Unchanged Rules**: The 3-second cooldown, 300-character limit, and automatic draft clear after send remain untouched."
  },
  "ja": {
    "title": "チャット入力欄の Enter 送信・Shift+Enter 改行と IME 変換誤送信防止",
    "summary": "チャット入力欄で Enter キーによる直接送信と Shift+Enter での改行に対応しました。日本語・中国語 IME 変換確定時の Enter で誤送信しない多重ガードを備えています。",
    "content_markdown": "# チャット入力欄の Enter 送信・Shift+Enter 改行と IME 変換誤送信防止\n\n`r62` ではチャット入力欄のキーボード操作を改善しました：\n\n- **Enter で送信 / Shift+Enter で改行**：通常の `Enter` でフォームを送信し、`Shift+Enter` で改行を挿入します。\n- **IME 変換中の誤送信防止**：`event.isComposing`、`compositionstart`/`compositionend`、`keyCode === 229`、確定直後の 80ms ガードにより、変換候補の確定時に誤送信されません。\n- **既存ルール維持**：3秒間隔制限・300文字上限・送信後の入力クリアは従来通りです。"
  }
}, "2026-11-23T20:36:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-window-spring-open-close', '2026-11-23-pond-window-spring-open-close', 'site-updates', '["site-updates","animation","ui"]', '', 'published', 0, 0, '2026-11-23T20:24:00+08:00', '2026-11-23T20:24:00+08:00', '2026-11-23T20:24:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-window-spring-open-close", {
  "zh": {
    "title": "全站板块窗口 120 FPS 阻尼弹簧开合动画上线",
    "summary": "点击首页图标、顶部欢迎入口或移动端底部 Dock 图标时，板块窗口从图标原位以二阶阻尼弹簧生长展开，关闭时镜像收回图标；纯合成层驱动稳住 120 FPS 且全程可打断。",
    "content_markdown": "# 全站板块窗口 120 FPS 阻尼弹簧开合动画上线\n\n本次 `r61` 补齐桌面端与移动端所有板块窗口的弹簧开合动效：\n\n- **统一弹簧物理**：严格采用 CRT 折射玻璃方案第二节弹簧参数——打开 `windowOpen`（`ζ=0.78, ω₀=17`，约 `450ms` 快起慢收），关闭 `windowClose`（`ζ=0.90, ω₀=20`，约 `300ms` 镜像收回图标），支持 60Hz/120Hz/240Hz 一致手感。\n- **纯合成层 120 FPS**：动画前仅单次测量目标窗口与图标中心差值，飞行中只更新 `transform: translate3d(...) scale(...)` 与 `opacity`，配合轻微压暗池塘背景层（`#pond-window-scrim`），零 Layout/Paint 抖动。\n- **全路径可打断与无障碍**：支持点击 ×、按 `Esc`、点击池塘空白处镜像收回，中途点击其他图标或再次操作立即从当前位置与速度顺滑接管；`prefers-reduced-motion` 自动降级为 `120ms` 淡入淡出。"
  },
  "en": {
    "title": "120 FPS Damped Spring Window Open & Close Animation",
    "summary": "Section windows now spring open smoothly from their desktop or mobile Dock icon origin and retract symmetrically on close using pure compositor transform/opacity at 120 FPS.",
    "content_markdown": "# 120 FPS Damped Spring Window Open & Close Animation\n\nRelease `r61` introduces damped spring open/close transitions for all desktop and mobile section windows:\n\n- **Unified Spring Physics**: Uses `CRT_GLASS_SPRINGS.windowOpen` (`zeta=0.78, omega0=17`, ~450ms) and `windowClose` (`zeta=0.90, omega0=20`, ~300ms) with frame-rate-independent sub-stepping.\n- **120 FPS Compositor-Only**: Measures origin-to-window delta once before flight and animates strictly `transform` and `opacity` with a subtle pond dimming scrim (`#pond-window-scrim`).\n- **Interruptible & Accessible**: Fully interruptible mid-flight across close buttons, `Escape`, backdrop clicks, and icon switches; degrades to a 120ms opacity fade under `prefers-reduced-motion`."
  },
  "ja": {
    "title": "全セクションウィンドウ 120 FPS 減衰バネ開閉アニメーション実装",
    "summary": "ホームの各アイコンやモバイル Dock からウィンドウがバネ物理で滑らかに展開し、閉じる際は元のアイコンへ反転収納される 120 FPS 開閉アニメーションを実装しました。",
    "content_markdown": "# 全セクションウィンドウ 120 FPS 減衰バネ開閉アニメーション実装\n\n`r61` ではデスクトップおよびモバイルの全ウィンドウに減衰バネ開閉アニメーションを導入しました：\n\n- **統一バネ物理**：仕様書第2節の `windowOpen`（`ζ=0.78, ω₀=17`, 約450ms）および `windowClose`（`ζ=0.90, ω₀=20`, 約300ms）を採用。\n- **120 FPS コンポジタ専用**：飛行中は `transform` と `opacity` のみを更新し、背景池を控えめに暗転させて視認性を高めます。\n- **割り込み対応・アクセシビリティ**：開閉途中での別アイコンクリックや再操作を滑らかに引き継ぎ、`prefers-reduced-motion` 環境では 120ms のフェードへ自動切替します。"
  }
}, "2026-11-23T20:24:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-chat-input-scrollbar', '2026-11-23-pond-chat-input-scrollbar', 'site-updates', '["site-updates","chatroom","ui"]', '', 'published', 0, 0, '2026-11-23T20:20:00+08:00', '2026-11-23T20:20:00+08:00', '2026-11-23T20:20:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-chat-input-scrollbar", {
  "zh": {
    "title": "聊天室输入框荧光细滚动条统一与发送按钮防重叠修复",
    "summary": "将聊天室输入框滚动条统一为深青荧光细条样式，隔离输入域与右侧字数统计及圆形发送按钮的弹性布局，彻底消除旧版白色滚动条遮挡按钮的问题。",
    "content_markdown": "# 聊天室输入框荧光细滚动条统一与发送按钮防重叠修复\n\n本次 `r60` 仅针对聊天室输入区做视觉与布局清理，不改动任何收发逻辑：\n\n- 复用全站统一的深青荧光细滚动条样式（`4px` 细轨、隐藏旧版上下箭头），仅在多行文本溢出时显现，单行或未溢出时不出现多余滚动条。\n- 将字数统计（`.chatroom-counter`）与圆形发送按钮（`.chat-send-button`）纳入 `.chatroom-input-shell` 弹性布局流，彻底隔离 `#chat-message-input` 与按钮区域，避免滚动条再压在发送按钮上。"
  },
  "en": {
    "title": "Chatroom Input Phosphor Scrollbar & Send Button Overlap Fix",
    "summary": "Unified the chatroom textarea scrollbar with the dark phosphor thin scrollbar style and isolated the input field from the counter and circular send button to prevent overlap.",
    "content_markdown": "# Chatroom Input Phosphor Scrollbar & Send Button Overlap Fix\n\nRelease `r60` applies a pure visual/layout fix to the chatroom composer without touching messaging logic:\n\n- Unified `#chat-message-input` with the site-wide 4px dark phosphor thin scrollbar (hiding legacy Windows scrollbar arrows), appearing only when multiline text overflows.\n- Moved `.chatroom-counter` and `.chat-send-button` into the `.chatroom-input-shell` flex flow so the textarea and its scrollbar never overlap the circular send button."
  },
  "ja": {
    "title": "チャット入力欄の蛍光細スクロールバー統一と送信ボタン重なり修正",
    "summary": "チャット入力欄のスクロールバーをサイト統一の深青蛍光細スタイルへ刷新し、文字数表示と丸型送信ボタンとの重なりを解消しました。",
    "content_markdown": "# チャット入力欄の蛍光細スクロールバー統一と送信ボタン重なり修正\n\n`r60` ではチャット機能のロジックを変更せず、入力欄の見た目とレイアウトを修正しました：\n\n- `#chat-message-input` にサイト統一の 4px 深青蛍光細スクロールバーを適用し、旧式の白い矢印付きスクロールバーを排除しました。未溢れ時は表示されません。\n- 文字数カウンターと丸型送信ボタンを `.chatroom-input-shell` のフレックス配置へ統合し、入力欄のスクロールバーが送信ボタンに重ならないように修正しました。"
  }
}, "2026-11-23T20:20:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-crt-glass-pilot', '2026-11-23-pond-crt-glass-pilot', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T18:15:00+08:00', '2026-11-23T18:15:00+08:00', '2026-11-23T18:15:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-crt-glass-pilot", {
  "zh": {
    "title": "CRT 折射玻璃统一参数表与欢迎窗主按钮按压波纹试点上线",
    "summary": "按 CRT 折射玻璃适配方案落地步骤 2–3：建立全站唯一权威玻璃与阻尼弹簧参数表，并在欢迎窗快捷按钮试点接触点高斯凹陷、320ms 非线性释放波与边缘吃光反馈，静默零重绘。",
    "content_markdown": "# CRT 折射玻璃统一参数表与欢迎窗主按钮按压波纹试点上线\n\n本次 `r59` 按《lusu575.com「液态玻璃」风格化适配方案》完成步骤 2 与步骤 3（试点验收节点）：\n\n- **统一参数表（`crt-glass-config.mjs`）**：集中维护光学折射（`IOR 1.46` / `8px` 肩部 / `2.5px` 最大位移）、二阶阻尼弹簧（`ζ/ω₀` 五场景表）、荧光粉玻璃色板、三级按钮等级与三档性能配置，自动同步 CSS 变量，杜绝魔法数字散落。\n- **欢迎窗按钮试点（`crt-glass-button.mjs`）**：接入 `#welcome-modal .quick-link` 主按钮（100% 保留原生 `<button>` 语义与键盘焦点）：支持非中心接触点高斯凹陷、120ms 阻尼按压下沉 `1.5px`、松手 320ms 非线性释放波、60ms `≤0.35px` 波峰短色散与 70ms 边缘吃光；双击替换旧波、取消仅释放视觉不误触业务、动画结束即零开销停帧，支持 `prefers-reduced-motion` 静态降级。"
  },
  "en": {
    "title": "CRT Refractive Glass Unified Config & Welcome Modal Button Press Pilot",
    "summary": "Implemented Steps 2–3 of the CRT Refractive Glass specification: single authoritative optical/spring token table and Welcome modal quick-link button pilot with off-center Gaussian indent, 320ms non-linear release wave, 70ms rim catch, and idle-stop.",
    "content_markdown": "# CRT Refractive Glass Unified Config & Welcome Modal Button Press Pilot\n\nRelease `r59` completes Steps 2 and 3 of the CRT Refractive Glass plan (pilot checkpoint):\n\n- **Single Authoritative Config (`crt-glass-config.mjs`)**: Centralizes optical geometry (`IOR 1.46`, `8px` shoulder, `2.5px` max refraction), unified second-order damped springs, CRT phosphor glass colors, 3 button tiers, and 3 performance tiers synced to CSS variables.\n- **Welcome Modal Pilot (`crt-glass-button.mjs`)**: Bound to `#welcome-modal .quick-link` native `<button>` controls with off-center contact Gaussian indentation, 120ms spring press (`1.5px` / `0.985`), 320ms non-linear release wave, 60ms `<=0.35px` crest dispersion, 70ms rim catch, double-tap wave replacement, safe `pointercancel`, keyboard center contact, `prefers-reduced-motion` fallback, and zero-cost idle-stop."
  },
  "ja": {
    "title": "CRT 屈折ガラス統一パラメータ表＆ようこそボタン波紋パイロット実装",
    "summary": "CRT 屈折ガラス仕様のステップ 2–3 を反映：光学・バネ物理の単一パラメータ定義を作成し、ようこそ画面ボタンで接触点ガウス凹み・320ms 非線形リリース波・縁発光をパイロット実装しました。",
    "content_markdown": "# CRT 屈折ガラス統一パラメータ表＆ようこそボタン波紋パイロット実装\n\n`r59` にて CRT 屈折ガラス仕様のステップ 2・3（パイロット検収ポイント）を公開しました：\n\n- **統一パラメータ定義（`crt-glass-config.mjs`）**：光学パラメータ、2次減衰バネ、蛍光カラー、3段階ボタン等級、3段階パフォーマンス設定を一元管理し CSS 変数へ同期。\n- **ようこそボタンパイロット（`crt-glass-button.mjs`）**：ネイティブ `<button>` を保持したまま、偏心クリック接触点でのガウス凹み、120ms バネ押し込み、320ms リリース波、60ms 短色分散、70ms 縁発光、ダブルクリック波置換、キーボード中央起動、reduced-motion 静的フォールバック、終了時完全停止を実装しました。"
  }
}, "2026-11-23T18:15:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-remove-corner-dock', '2026-11-23-pond-remove-corner-dock', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T16:12:00+08:00', '2026-11-23T16:12:00+08:00', '2026-11-23T16:12:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-remove-corner-dock", {
  "zh": {
    "title": "下线首页右下角「在线 / 公告」胶囊并清理专属样式",
    "summary": "彻底移除桌面与移动端首页右下角「在线」状态胶囊与「公告」入口按钮及其容器、脚本与全部专属 CSS，画面更纯净；欢迎窗弹窗本体保留不变。",
    "content_markdown": "# 下线首页右下角「在线 / 公告」胶囊并清理专属样式\n\n本次 `r58` 按站长确认对首页右下角进行减法清理：\n\n- **彻底移除右下角胶囊组**：删除 `#pond-corner-dock` 容器及其内部的「在线」状态灯胶囊与「公告」入口按钮。\n- **同步清零脚本与专属样式**：从 `js/pond-windows/pond-site-bridge.mjs`、`css/pond-windows.css` 与 `index.html` 中一并删净相关创建逻辑、监听与专属 CSS，仓库不留废弃样式。\n- **保留欢迎窗本体**：`#welcome-modal` 弹窗本体未动，桌面端仍可点击顶部时钟或访问 `#welcome` 打开。"
  },
  "en": {
    "title": "Removed Bottom-Right Online & Notice Capsules and Dedicated Styles",
    "summary": "Completely removed the bottom-right #pond-corner-dock container (Online status pill and Notice button) along with all dedicated scripts and CSS; the Welcome modal itself remains intact.",
    "content_markdown": "# Removed Bottom-Right Online & Notice Capsules and Dedicated Styles\n\nRelease `r58` removes the bottom-right corner capsule pair for a cleaner pond desktop:\n\n- **Removed Corner Dock**: Deleted `#pond-corner-dock` along with the Online status pill and Notice button.\n- **Zero Orphaned Code/Styles**: Cleaned all creation logic, observers, and dedicated CSS from `pond-site-bridge.mjs`, `pond-windows.css`, and `index.html`.\n- **Welcome Modal Intact**: `#welcome-modal` remains untouched and accessible via the top desktop clock or `#welcome`."
  },
  "ja": {
    "title": "右下「オンライン／お知らせ」カプセルと専用スタイルを完全撤去",
    "summary": "ホーム右下の #pond-corner-dock（オンライン表示・お知らせボタン）と関連スクリプト・専用 CSS をすべて削除し画面をすっきり整理しました。ようこそモーダル本体はそのまま維持しています。",
    "content_markdown": "# 右下「オンライン／お知らせ」カプセルと専用スタイルを完全撤去\n\n`r58` にてホーム右下のカプセル群を撤去しました：\n\n- **右下ドック削除**：`#pond-corner-dock`（オンライン状態表示・お知らせボタン）を削除しました。\n- **関連コード・専用 CSS の完全整理**：`pond-site-bridge.mjs`、`pond-windows.css`、`index.html` から専用ロジックとスタイルを残さず削除しました。\n- **ようこそ画面は維持**：`#welcome-modal` 本体は変更せず、上部時計クリックまたは `#welcome` から引き続き開けます。"
  }
}, "2026-11-23T16:12:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-crt-boot-preloader', '2026-11-23-pond-crt-boot-preloader', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T15:00:00+08:00', '2026-11-23T15:00:00+08:00', '2026-11-23T15:00:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-crt-boot-preloader", {
  "zh": {
    "title": "纯代码 CRT 进站启动动画与全站 32 项素材预加载上线",
    "summary": "交互与动画专项第一项上线：纯代码复用池塘自身 WebGL2 CRT 管线绘制无边框荧光亮线展开与分层显影，从冷加载第 0 帧接管画面，启动期间并行预加载并解码全站 32 项素材，结尾无缝交接首页本体。",
    "content_markdown": "# 纯代码 CRT 进站启动动画与全站 32 项素材预加载上线\n\n交互与动画专项第一项（`r57`）正式上线：\n\n- **冷加载第 0 帧接管**：`index.html` 内联深青绿水平荧光亮线与同步 `<head>` 脚本，冷加载首帧直接进入 CRT 开机仪式，不再出现全黑空白帧与孤立「检测中」角标。\n- **纯代码复用池塘管线**：零视频文件、无实体电视机边框，在池塘自身 WebGL2 着色器内完成「水平亮线 → 满屏无边框管面展开 → 水面先亮 → 荷叶/季节装饰/锦鲤依次成形 → 顶部点阵字 `LUSU575` 渐隐 → 6 颗图标与状态角标淡入」，最后一帧即首页本体，零切屏零闪烁。\n- **真实预加载与重访策略**：新增 `boot-preloader.mjs` 并发预加载并 `decode()` 全站 32 项素材（12 张四季 WebP 装饰、5 张游戏封面、6 张聊天室头像、6 张工具图标、关于页头像、2 份目录 JSON），进度条与真实加载严格绑定；首访封顶 2.6 秒、点击或 `Esc/Space` 可随时跳过，重访/缓存命中自动压缩为开机亮线一闪而过。"
  },
  "en": {
    "title": "Pure-Code CRT Pond Boot Sequence & 32-Asset Site-Wide Preloader",
    "summary": "Animation Phase Item 1: pure-code borderless CRT power-on beam reusing the live WebGL2 Pond pipeline, taking over from Frame 0 on cold load while preloading and decoding all 32 site assets with seamless final-frame handoff.",
    "content_markdown": "# Pure-Code CRT Pond Boot Sequence & 32-Asset Site-Wide Preloader\n\nAnimation Phase Item 1 (`r57`) is live:\n\n- **Frame-0 Cold-Load Takeover**: Inline critical CRT beam markup and synchronous `<head>` state prevent cold-load blank black frames and hide the corner status badge until boot completes.\n- **100% Live WebGL2 Pond Pipeline**: Zero video files and zero TV bezel—horizontal deep-teal phosphor beam unfolds into the borderless full-screen CRT tube, revealing water first, then lotus leaves, seasonal decor, and live koi, with dot-matrix `LUSU575` title and seamless final-frame handoff.\n- **Real Preload Progress & Repeat-Visit Compression**: `boot-preloader.mjs` preloads and decodes all 32 site assets (12 seasonal WebPs, 5 game covers, 6 chat avatars, 6 tool SVGs, About avatar, 2 JSON catalogs). Capped at 2.6s on first visit, skippable via click/Esc/Space, and compressed into a brief beam flash on repeat visits."
  },
  "ja": {
    "title": "純コード CRT 起動アニメーションと全サイト 32 素材プリロード実装",
    "summary": "アニメーション強化第1弾：動画を使わず池本体の WebGL2 CRT パイプラインで起動演出を生成し、初回ロード0フレーム目から黒画面を防止。全32素材を並列プリロード＆デコードし、最終フレームがそのままホームへシームレス接続します。",
    "content_markdown": "# 純コード CRT 起動アニメーションと全サイト 32 素材プリロード実装\n\nアニメーション強化第1弾（`r57`）を公開しました：\n\n- **コールドロード第0フレーム制御**：`index.html` に初期走査線と同期スクリプトをインライン配置し、初回読み込み時の無地黒画面を解消しました。\n- **池本体の WebGL2 パイプライン再利用**：動画やテレビ枠を使わず、水平蛍光ラインから全面 CRT へ展開し、水面→蓮葉・季節装飾・錦鯉の順に実読み込み進捗と連動して立ち上がり、最終フレームがそのままホーム画面へ途切れなく接続します。\n- **全32素材の並列プリロードと再訪短縮**：季節 WebP 12点・ゲーム表紙 5点・チャットアバター 6点・ツールアイコン 6点・プロフィール画像・カタログ JSON 2点を事前デコード。初回は最大 2.6 秒（クリック／Esc でスキップ可）、再訪時は一瞬のフラッシュ展開へ短縮されます。"
  }
}, "2026-11-23T15:00:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-game-covers-webp-zero-flash', '2026-11-23-pond-game-covers-webp-zero-flash', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T14:37:00+08:00', '2026-11-23T14:37:00+08:00', '2026-11-23T14:37:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-game-covers-webp-zero-flash", {
  "zh": {
    "title": "游戏封面 WebP 瘦身 93 倍、下架旧彩色图标与全站首帧防闪跳",
    "summary": "将游戏区封面从 5.53 MB PNG 压缩为 59.3 KB WebP 与独立 SVG，目录配置直指新版封面并彻底删除 5 张旧彩色 PNG，同时加入首帧同步模式初始化脚本消除页面闪跳。",
    "content_markdown": "# 游戏封面 WebP 瘦身 93 倍、下架旧彩色图标与全站首帧防闪跳\n\n本次 `r56` 专项根治游戏区封面加载慢与旧版本闪现问题：\n\n- **游戏封面瘦身 93 倍**：`cover-cat`、`cover-darkroom`、`cover-restart` 三张 `1024×1024` 原图（共 `5.53 MB`）压缩为 `280×280` WebP（共 `59.3 KB`），`2048` 与 `Hextris` 落地为独立 `.svg` 文件。\n- **下架旧彩色图标消除闪旧图**：`games/catalog.json` 直接指向新版 WebP/SVG 封面，并从仓库与线上部署彻底删除 5 张旧彩色游戏图标 PNG 及 3 张旧 PNG 封面，进出游戏区不再先闪旧彩图。\n- **首帧直出当前版**：在 `index.html` `<head>` 增加同步 `data-pond-mode` 初始化脚本，首帧直接按目标路由渲染，并同步清空 `css/cursor-system.css` 中的旧 XP 光标残留。"
  },
  "en": {
    "title": "93x Smaller WebP/SVG Game Covers, Legacy Icon Removal & Zero-Flash First Paint",
    "summary": "Compressed game covers from 5.53 MB PNGs into 59.3 KB WebP and standalone SVGs, updated games/catalog.json directly, removed 5 legacy colorful PNG icons, and added synchronous head mode initialization to prevent first-frame layout flashes.",
    "content_markdown": "# 93x Smaller WebP/SVG Game Covers, Legacy Icon Removal & Zero-Flash First Paint\n\nRelease `r56` eliminates game cover loading lag and first-frame legacy flashes:\n\n- **93x Smaller Game Covers**: Converted `cover-cat`, `cover-darkroom`, and `cover-restart` from 5.53 MB raw PNGs into 59.3 KB `280×280` WebP assets, and extracted `2048` and `Hextris` into standalone SVG files.\n- **Legacy Icon Removal**: Pointed `games/catalog.json` directly to the new WebP/SVG covers and deleted the 5 legacy colorful game PNGs plus 3 oversized cover PNGs so old icons never flash on load or return.\n- **Zero-Flash First Paint**: Added a synchronous `<head>` bootstrap script in `index.html` to set `data-pond-mode` before first paint, and cleared legacy XP cursor rules from `css/cursor-system.css`."
  },
  "ja": {
    "title": "ゲーム表紙 WebP 93倍軽量化・旧カラーアイコン撤去と初回描画ちらつき解消",
    "summary": "ゲーム表紙を 5.53 MB PNG から 59.3 KB WebP と独立 SVG へ圧縮し、catalog.json を新版へ直結・旧カラー PNG 5枚を完全削除。head 同期初期化で初回フレームのレイアウトちらつきも解消しました。",
    "content_markdown": "# ゲーム表紙 WebP 93倍軽量化・旧カラーアイコン撤去と初回描画ちらつき解消\n\n`r56` ではゲーム表紙の読み込み速度と初回描画のちらつきを根本改善しました：\n\n- **ゲーム表紙を 93 倍軽量化**：3枚の 1024×1024 PNG（計 5.53 MB）を 280×280 WebP（計 59.3 KB）へ圧縮し、2048 と Hextris を独立 SVG 化しました。\n- **旧カラーアイコンの完全撤去**：`games/catalog.json` を新版表紙へ直接向け、旧カラー PNG 5枚と未圧縮表紙 PNG 3枚をリポジトリから完全削除しました。\n- **初回フレームのちらつき防止**：`index.html` の `<head>` に同期 `data-pond-mode` 初期化を追加し、`css/cursor-system.css` の旧カーソル定義も整理しました。"
  }
}, "2026-11-23T14:37:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-toc-webp-cursor-close-hover', '2026-11-23-pond-toc-webp-cursor-close-hover', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T14:27:00+08:00', '2026-11-23T14:27:00+08:00', '2026-11-23T14:27:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-toc-webp-cursor-close-hover", {
  "zh": {
    "title": "文章目录跳转修复、四季装饰 WebP 提速 34 倍、回归原生光标与关闭键悬停零漂移",
    "summary": "修复文章左侧目录点击不跳转；将 12 张四季装饰图从 21.81 MB PNG 压缩为 642.7 KB WebP 并按当前季节优先加载；移除旧自定义光标回归系统原生指针；修复窗口关闭键悬停时叉号偏移问题。",
    "content_markdown": "# 文章目录跳转修复、四季装饰 WebP 提速 34 倍、回归原生光标与关闭键悬停零漂移\n\n本次 `r55` 针对站长实测反馈的四项体验问题逐一收口：\n\n- **文章目录点击跳转**：将左侧目录项 `.article-toc-link` 的点击平滑滚动绑定到实际滚动容器 `.article-detail-card`，点击任意章节标题即时跳转并同步高亮与阅读进度。\n- **四季装饰图提速 34.7 倍**：将 12 张 `1536×1024` 原始 PNG（总计 `21.81 MB`）按展示尺寸转为透明 WebP（总计 `642.7 KB`），开启 `manifest` 预加载与浏览器缓存，并在渲染引擎中优先加载当前季节部件、后台静默预载其余三季。\n- **移除旧自定义光标**：清除旧版 XP 像素鼠标残留，全站回归清晰锐利的系统原生指针（常规/手型/输入/禁用态完整保留）。\n- **关闭键悬停零漂移**：统一全部窗口与弹窗关闭键常态和悬停态的居中点阵叉号尺寸与定位，消除悬停时叉号缩放偏移或露出旧样式的问题。"
  },
  "en": {
    "title": "Article TOC Jump Fix, 34.7x Smaller WebP Seasonal Flora, Native Cursor & Zero-Drift Close Hover",
    "summary": "Fixed Article TOC click scrolling inside .article-detail-card, compressed 21.81 MB seasonal PNGs into 642.7 KB WebP with active-season priority loading, removed legacy custom cursors in favor of native OS cursors, and locked close-button hover optical centering.",
    "content_markdown": "# Article TOC Jump Fix, 34.7x Smaller WebP Seasonal Flora, Native Cursor & Zero-Drift Close Hover\n\nRelease `r55` resolves four owner-reported polish items:\n\n- **Article TOC Click-to-Jump**: Bound `.article-toc-link` clicks to the real `.article-detail-card` scroll container so clicking any heading smoothly scrolls to that section and updates active highlighting.\n- **34.7x Smaller Seasonal Flora**: Converted all 12 seasonal decoration assets from 21.81 MB raw PNGs to 642.7 KB display-sized transparent WebP, added manifest preloading, and prioritized the active season's parts first.\n- **Native System Cursors**: Removed legacy XP pixel cursor overrides in Pond mode so desktop interactions use crisp OS-native cursors.\n- **Zero-Drift Close Button Hover**: Unified normal and hover states of all window/modal close buttons to the exact same 16px centered dotted SVG (`font-size: 0; color: transparent; transform: none`)."
  },
  "ja": {
    "title": "記事目次ジャンプ修正・季節装飾 WebP 34倍軽量化・標準カーソル復元・閉じるボタンホバー固定",
    "summary": "記事左目次のクリック遷移を修正し、季節装飾12点を 21.81 MB PNG から 642.7 KB WebP へ圧縮・現季節優先読込に変更。旧カスタムカーソルを撤去しシステム標準へ統一、閉じるボタンのホバー時ズレも解消しました。",
    "content_markdown": "# 記事目次ジャンプ修正・季節装飾 WebP 34倍軽量化・標準カーソル復元・閉じるボタンホバー固定\n\n`r55` にて4点の体験改善を実施しました：\n\n- **記事目次クリック遷移**：実際のスクロール領域 `.article-detail-card` へスムーズスクロールするよう修正しました。\n- **季節装飾の大幅軽量化**：12点の PNG（計 21.81 MB）を WebP（計 642.7 KB）へ最適化し、現在の季節を最優先で読み込むよう改善しました。\n- **システム標準カーソルへ統一**：旧デザインのカスタムカーソルを撤去し、OS 標準のシャープなポインターに統一しました。\n- **閉じるボタンのホバーズレ解消**：通常時とホバー時で全く同じ中央配置ドット×アイコンを維持し、位置ズレをゼロにしました。"
  }
}, "2026-11-23T14:27:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-final-polish-r52-r54', '2026-11-23-pond-final-polish-r52-r54', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T10:45:00+08:00', '2026-11-23T10:45:00+08:00', '2026-11-23T10:45:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-final-polish-r52-r54", {
  "zh": {
    "title": "全站细节收尾汇总（货架许可证/聊天室前缀/画板 1.0.13/日语页居中/互传防断词）",
    "summary": "汇总上线 r52–r54 收尾优化：彻底消除游戏货架窄卡「源」字裁切与聊天室同步前缀叠字，画板升版 1.0.13 消除卡片空白与加深画布提示底，日语页垂直居中，提亮知识库底部计数行，并修复临时互传简介「登录后」「24 小时」断行孤字。",
    "content_markdown": "# 全站细节收尾汇总（r52–r54）\n\n本次合并记录 `r52`、`r53` 与 `r54` 三批线上细节收口：\n\n## 游戏货架与聊天室\n- **货架许可证零裁切**：调整首行窄卡封面列宽至 `88px`，`.game-main` 扩至 `158px`，全部 5 张卡片「许可证、全部语言与来源」完整显示。\n- **聊天室同步状态**：重置 `#chat-sync-status::before` 布局，清晰呈现「已同步 · 约 5 秒刷新」，无叠字。\n\n## 工具区、画板、日语页与知识库\n- **临时互传**：展开「版本与使用说明」限定内部滚动不挤出下方「打开」按钮；简介中为「登录后」与「24 小时」绑定不可拆连接符，消除断词与末行孤字。\n- **在线画板（v1.0.13）**：刷新主题缓存 `pond-tools-r5`，消除公共画板卡中部空白并为 Excalidraw 画布操作提示补齐深色圆角底。\n- **日语的言外之意 & 知识库**：日语页内容卡在视口内垂直居中以收敛底部留白；提亮知识库底部「已显示 X / Y 篇」汇总行对比度。"
  },
  "en": {
    "title": "Final Polish Rollup (r52–r54): Games License, Chat Prefix, Whiteboard 1.0.13, Trainer Centering & Transfer Line Breaks",
    "summary": "Consolidated r52–r54 polish: eliminated narrow Games card license clipping and Chat sync prefix overlap, bumped Whiteboard to 1.0.13 with balanced cards and dark canvas hint backdrop, centered Japanese Subtext vertically, brightened Knowledge footer count, and bound Transfer description line breaks.",
    "content_markdown": "# Final Polish Rollup (r52–r54)\n\nThis release records the `r52`, `r53`, and `r54` visual polish updates:\n\n## Games Shelf & Chatroom\n- **Games License Summary**: Widened the text column on narrow top-row cards (`88px` cover) so the full license summary renders with zero right-edge clipping across all 5 cards.\n- **Chatroom Sync Prefix**: Fixed `#chat-sync-status::before` inline layout so `Synced ·` sits cleanly before the refresh interval.\n\n## Tools, Whiteboard, Japanese Subtext & Knowledge\n- **Quick Transfer**: Made expanded card details independently scrollable so the Open button stays inside the window, and added non-breaking joiners so `24 小时` and `登录后` never break awkwardly.\n- **Online Whiteboard (v1.0.13)**: Refreshed `pond-tools-r5` cache to remove the public-card middle gap and add a dark backdrop behind Excalidraw's canvas hint.\n- **Japanese Subtext & Knowledge**: Vertically centered the trainer card in the viewport and brightened the Knowledge list footer count."
  },
  "ja": {
    "title": "最終細部調整まとめ（r52–r54）：ゲーム表記・チャット同期・画板 1.0.13・日本語中央配置・一時転送改行制御",
    "summary": "r52–r54 の仕上げ調整を統合：ゲーム一覧のライセンス見切れとチャット同期表記の重なりを解消、ホワイトボードを 1.0.13 へ更新し余白とヒント背景を反映、日本語ページを縦中央配置、知識庫下部の件数表示を明るくし、一時転送紹介文の途中改行を防止しました。",
    "content_markdown": "# 最終細部調整まとめ（r52–r54）\n\n`r52`〜`r54` の反映内容をまとめました：\n\n## ゲーム一覧・チャット\n- 上段カードの画像列幅を調整し、全5カードでライセンス行が右端で切れないよう修正しました。\n- チャットの「同期済 ·」プレフィックスの重なりを解消しました。\n\n## ツール・ホワイトボード・日本語・知識庫\n- 一時転送の説明展開を内部スクロール化し、紹介文の「24 時間」「ログイン後」が途中で改行されないよう調整しました。\n- オンラインホワイトボード（v1.0.13）のキャッシュを更新し、カード余白とキャンバスヒント背景を反映しました。\n- 日本語ページを画面縦中央に配置し、知識庫下部の表示件数行の視認性を高めました。"
  }
}, "2026-11-23T10:45:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-source-level-final-polish', '2026-11-23-pond-source-level-final-polish', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T09:32:00+08:00', '2026-11-23T09:32:00+08:00', '2026-11-23T09:32:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-source-level-final-polish", {
  "zh": {
    "title": "全站源头级视觉与交互收口（游戏壳层/互传/登录/聊天室/文章/画板/日语页）",
    "summary": "同步 5 款游戏壳层缓存版本并消除猫国进门 Oops 闪现；修复人生重开两侧黑带、货架许可证裁切、聊天室同步前缀、登录窗全宽与去重、文章元信息去秒提亮、互传展开避让与徽章对比、画板卡片留白与日语页底空。",
    "content_markdown": "# 全站源头级视觉与交互收口\n\n本次 `r51` 从源头统一收口全站剩余视觉与交互细节：\n\n## 游戏壳层与内嵌游戏\n- **同步全部 5 款游戏壳层缓存版本**：将 `life-restart`、`kittens-game`、`a-dark-room`、`2048`、`hextris` 的 `game-shell.js/css` 统一升级至 `r51`。\n- **猫国建设者消除进门 Oops 闪现**：仅在加载完成、`#game` 脱离 `display:none` 后才启用三栏网格布局，彻底消除进入时约 10 秒的 `Oops! Looks like the game is not working` 闪现。\n- **人生重开模拟器**：为外层 `#layaContainer` 与页面底色补齐深色池塘背景与微光描边，消除两侧纯黑带。\n\n## 主站窗口与工具子页\n- **游戏货架与聊天室**：收缩窄卡许可证行字号避免「源」字被右框裁切；为聊天室同步状态补齐「已同步 · / 重连中 ·」明确文字前缀。\n- **登录窗、知识库与文章页**：登录主按钮与容器统一全宽对齐、去除重复说明并消除注册态内部滚动条；文章元信息源头去除秒数、改为折行排布并放大提亮 17px 点阵图标；提亮知识库筛选计数与「已显示 X / Y 篇」行。\n- **工具互传、画板、日语页与视频弹窗**：互传展开时自动隐藏下方工具卡片避免遮挡，统一深色滚动条、青色虚线版本胶囊与高对比「在线」状态；视频失败态「重试播放器」换深色点阵样式；画板消除公共卡中部空白并为画布提示条加深色底；日语页收紧底部留白并提亮版本小字；首页右下角角标容器不遮挡附近导航区域。"
  },
  "en": {
    "title": "Site-Wide Source-Level Polish (Games, Transfer, Login, Chat, Reader, Whiteboard & Trainer)",
    "summary": "Synced game-shell cache across all 5 games, eliminated Kittens Game boot Oops flash, replaced Life Restart black side bands, fixed Games license clipping, Chat sync prefix, Login full-width button, Reader meta without seconds, Transfer panel overlap, Whiteboard card balance & Japanese Trainer spacing.",
    "content_markdown": "# Site-Wide Source-Level Polish\n\nRelease `r51` resolves the remaining visual and interaction items at their source:\n\n## Games Shell & Embedded Games\n- **Synced `game-shell` cache (`r51`)** across all 5 embedded games.\n- **Kittens Game**: Prevented `#game` from overriding `display:none` during initial loading, eliminating the 10-second `Oops!` flash.\n- **Life Restart**: Themed the outer LayaAir container with the dark Midnight Pond backdrop and subtle glow frame, removing the pure-black side bands.\n\n## Main Windows & Standalone Tools\n- **Games Shelf & Chatroom**: Prevented right-edge clipping on the license summary line and restored explicit `Synced ·` / `Reconnecting ·` status prefixes.\n- **Login, Knowledge & Article Reader**: Enforced full-width submit buttons, deduplicated helper notes, removed Register-mode scrollbars, removed seconds from Article timestamps at the source, enabled multi-line meta wrapping with brighter 17px icons, and boosted Knowledge status/count contrast.\n- **Quick Transfer, Whiteboard, Japanese Trainer & Video Modal**: Hid tool cards while Quick Transfer is open, applied dark scrollbars, cyan dotted version badges, and high-contrast Online pills; restyled Video retry button; removed Whiteboard middle void and added a dark backdrop to Excalidraw's HintViewer; tightened Japanese Trainer height and brightened its version label."
  },
  "ja": {
    "title": "全サイト根本修正（ゲーム・一時転送・ログイン・チャット・記事・ホワイトボード・日本語）",
    "summary": "全5ゲームのキャッシュ更新と Kittens Game 起動時 Oops 表示解消、Life Restart 左右黒帯改善、ライセンス見切れ・チャット同期表記・ログイン全幅・記事メタ秒数削除・一時転送重なり・ホワイトボード余白・日本語ページ下余白を一括修正しました。",
    "content_markdown": "# 全サイト根本修正\n\n`r51` にて各ページの残課題を根本から修正しました。\n\n## ゲームシェル・内蔵ゲーム\n- 全5ゲームの `game-shell` キャッシュを `r51` へ同期しました。\n- Kittens Game 読み込み中に `#game` が先行表示され `Oops!` が点滅する問題を解消しました。\n- Life Restart 外枠の黒帯をダークポンド背景へ統一しました。\n\n## 各画面とツール\n- ゲーム一覧ライセンス行の右端見切れを解消し、チャット同期状態に「同期済 ·」の明示ラベルを追加しました。\n- ログイン主ボタンの全幅化・注記整理・登録時スクロールバー解消、記事メタの秒数削除と 17px アイコン強調、知識庫件数の視認性向上を実施しました。\n- 一時転送展開時のカード重なり解消・ダークスクロールバー・高コントラストバッジ、動画エラー再試行ボタン、ホワイトボード余白とヒント背景、日本語ページの縦余白も調整しました。"
  }
}, "2026-11-23T09:32:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-systemic-gradient-contrast-polish', '2026-11-23-pond-systemic-gradient-contrast-polish', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T08:56:00+08:00', '2026-11-23T08:56:00+08:00', '2026-11-23T08:56:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-systemic-gradient-contrast-polish", {
  "zh": {
    "title": "全站渐变强调色清理、次要文字对比度提亮与各页细节收口",
    "summary": "清除全站 4 处残留渐变色并系统性提亮次要小字对比度；补齐游戏货架云存档状态栏、首页樱花枝避让与状态防卡死、欢迎窗实时问候与 5 条直显、人生重开暗色适配，并恢复关于页「资源」原文。",
    "content_markdown": "# 全站渐变强调色清理、次要文字对比度提亮与各页细节收口\n\n本次更新完成全站复查清单中的系统性视觉规范与逐页收尾修复。\n\n## 系统性优化\n\n- **清除渐变强调色残留**：知识库与视频分类选中胶囊、文章阅读进度条、聊天室「普通房间」徽章及登录主按钮全部统一为深夜池塘实心青绿与点阵边框风格。\n- **次要文字对比度提亮**：统一提亮关于页字段标签、欢迎窗更新正文与日期、登录窗标签与占位字、聊天室欢迎行与时间戳、视频筛选计数、画板最近使用时间及日语页版本小字的可读性。\n\n## 逐页修复要点\n\n- **首页与欢迎窗**：微调知识库图标避开春季樱花枝遮挡；为右下角状态角标加入 10 秒接口探测兜底防久留「检测中」；欢迎窗首开按真实本地小时渲染早/中/下午/晚上好，并收紧行距让 5 条最近更新完整直显。\n- **登录、知识库、文章与视频弹窗**：登录主按钮拉通全宽并隐藏重复提示、注册态不现内部滚动条；知识库提亮禁用态清空键并加顶距缓冲；文章目录加宽滚动条与 16px 点阵元信息图标；视频浮层提亮 18px 全屏图标并暗色化失败态按钮。\n- **工具、画板、游戏货架、人生重开、聊天室与关于页**：工具三卡简介定高对齐按钮基线，画板两卡垂直分布对齐并加深画布提示底色；游戏货架顶部补齐云存档总状态条并区分「日文 不支持」标签；人生重开消除两侧纯黑带与左上角标并胶囊化按钮；聊天室同步状态补齐文字前缀并降低背景色带干扰；关于页逐字核对并恢复原文「资源」。"
  },
  "en": {
    "title": "Site-Wide Gradient Cleanup, Contrast Boost, Cloud-Save Banner & Final Page Polish",
    "summary": "Replaced all 4 remaining gradient accents with solid Midnight Pond teal, lifted muted text contrast site-wide, added Games cloud-save status banner, fixed Home branch overlap and Welcome greeting timing, polished Life Restart, and restored About copy.",
    "content_markdown": "# Site-Wide Gradient Cleanup, Contrast Boost, Cloud-Save Banner & Final Page Polish\n\nThis release completes the full-site desktop inspection punch list across systemic tokens and individual pages.\n\n## Systemic improvements\n\n- **Gradient cleanup**: Replaced gradient fills on Knowledge/Video active pills, Article progress bar, Chatroom room badge, and Account submit button with solid Midnight Pond teal and dotted borders.\n- **Secondary text contrast**: Raised muted text contrast across About labels, Welcome summaries/dates, Login labels/placeholders, Chatroom timestamps, Video counts, Whiteboard timestamps, and Japanese Subtext version copy.\n\n## Page highlights\n\n- **Home & Welcome**: Nudged the Knowledge icon clear of the spring sakura branch, added a 10s connection-status fallback probe, fixed first-open Welcome greeting to match local time of day, and fitted all 5 recent updates cleanly.\n- **Knowledge, Article, Video Modal, Tools, Whiteboard, Games, Life Restart & Chatroom**: Aligned tool card button baselines, balanced Whiteboard cards, added a live Games Cloud-Save status banner, styled Life Restart buttons and side bands, added explicit Chatroom sync state prefixes, and verified About copy verbatim."
  },
  "ja": {
    "title": "全サイトグラデーション整理・コントラスト改善・クラウドセーブ表示と各画面最終調整",
    "summary": "4箇所のグラデーションを統一し補助文字の視認性を向上。ホーム枝被り回避、ようこそ挨拶時刻修正、ゲームクラウド状態バー追加、人生やり直し調整、プロフィール原文復元を実施しました。",
    "content_markdown": "# 全サイトグラデーション整理・コントラスト改善・クラウドセーブ表示と各画面最終調整\n\n今回の更新では、全サイト点検で挙げられた共通ルールと各ページの細部を一括調整しました。\n\n## 共通改善\n\n- **グラデーション整理**：ナレッジ・動画の選択カプセル、記事進捗バー、チャットルームバッジ、ログイン主ボタンを深夜の池テーマの単色ティールとドット枠へ統一しました。\n- **補助文字の視認性向上**：プロフィール項目名、更新日時、ログイン補助文字、チャットタイムスタンプ、各バージョン表記のコントラストを引き上げました。\n\n## 各画面の修正\n\n- **ホーム・ようこそ**：ナレッジアイコンを春の桜枝から離し、ステータス角標に10秒フォールバックを追加。初回表示時の挨拶を現在時刻に合わせ、最近更新5件をすべて見切れず表示しました。\n- **ゲーム・ツール・画板・チャット・プロフィール**：ゲーム一覧上部にクラウドセーブ状態バーを追加し、人生やり直し画面の黒帯・角装飾・ボタンを調整。チャット同期状態に明示ラベルを追加し、プロフィール紹介文の原文を復元しました。"
  }
}, "2026-11-23T08:56:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-reader-darkroom-whiteboard-polish', '2026-11-23-pond-reader-darkroom-whiteboard-polish', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T08:46:00+08:00', '2026-11-23T08:46:00+08:00', '2026-11-23T08:46:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-reader-darkroom-whiteboard-polish", {
  "zh": {
    "title": "文章阅读进度条与右下角回顶净空、小黑屋排版及画板匿名栏细节修复",
    "summary": "汇总修复文章阅读进度条随滚动实时更新、回到顶部按钮固定在窗口右下角永不压字、小黑屋消除标题与按钮重叠，以及在线画板匿名名字栏左内边距对称问题。",
    "content_markdown": "# 文章阅读进度条与右下角回顶净空、小黑屋排版及画板匿名栏细节修复\n\n本次更新将连续四项已上线的细节打磨整理同步至站内更新记录（对应 r45–r48）。\n\n## 本次修复明细\n\n- **文章阅读进度条跟随滚动（r45）**：在深夜池塘主题桥接层绑定实际滚动容器 `.article-detail-card`，滚动文章时顶部阅读进度条与百分比实时从 0% 过渡至 50% 直至 100%，点击「回到顶部」可平滑返回文章开头。\n- **小黑屋消除标题与按钮重叠（r46）**：清除小黑屋标题栏 `.headerButton` 的旧浮动塌陷，保持紧贴内容的紧凑居中卡片高度，同时让「小黑屋」标题与「生火 / 添柴」按钮留出清晰行距、按钮文字居中对齐。\n- **文章「回到顶部」固定右下角零压字（r47）**：修正父窗 `backdrop-filter` 包含块导致的底中偏移，将回顶按钮锚定在文章窗右下角（`right: 16px; bottom: 16px`），并为正文区预留右侧 126px 与底部 76px 安全净空，任意滚动位置及滚到底状态均不遮挡正文。\n- **在线画板匿名名字栏对称内边距（r48）**：为内层带边框容器 `.identity-panel` 补齐左右对称的 `18px` 内边距，消除「当前匿名名字」贴靠左边框的问题。"
  },
  "en": {
    "title": "Article Read-Progress & Corner Back-to-Top, A Dark Room Layout, and Whiteboard Identity Padding",
    "summary": "Consolidated updates for live article read-progress tracking, non-overlapping bottom-right Back-to-Top button, A Dark Room title/button separation, and symmetric Whiteboard identity bar padding.",
    "content_markdown": "# Article Read-Progress & Corner Back-to-Top, A Dark Room Layout, and Whiteboard Identity Padding\n\nThis site update documents four production polish fixes (r45–r48) across the Knowledge reader, A Dark Room, and Online Whiteboard.\n\n## Summary of fixes\n\n- **Live article read-progress tracking (r45)**: Bound scroll progress and the Back-to-Top threshold to the actual scrollable `.article-detail-card` container so progress updates smoothly from 0% to 100% and clicking Back-to-Top scrolls cleanly to the top.\n- **A Dark Room overlap fix (r46)**: Cleared legacy float collapse on `.headerButton` so the room title sits cleanly above the centered action buttons inside the compact centered card.\n- **Non-overlapping article Back-to-Top (r47)**: Anchored the Back-to-Top button to the bottom-right corner of the article window with dedicated right and bottom gutters so it never overlaps text at any scroll position, including 100% bottom scroll.\n- **Whiteboard identity bar padding (r48)**: Added symmetric 18px horizontal padding to `.identity-panel` so the anonymous nickname label no longer touches the left border."
  },
  "ja": {
    "title": "記事の読書進捗バーと右下トップ戻り、A Dark Room 重なり解消・画板の余白修正",
    "summary": "記事リーダーの進捗バー連動と右下コーナー固定のトップ戻り、A Dark Room の見出しとボタン重なり解消、オンライン画板の匿名欄パディング対称化を反映しました。",
    "content_markdown": "# 記事の読書進捗バーと右下トップ戻り、A Dark Room 重なり解消・画板の余白修正\n\n本更新では、r45〜r48 で本番反映した4件の細部修正をサイト内更新履歴にまとめました。\n\n## 主な修正内容\n\n- **記事リーダーの進捗バー連動（r45）**：実際にスクロールする `.article-detail-card` に進捗計算を連動させ、0%から100%までリアルタイムに追従し、トップへ戻るボタンも滑らかに機能するよう修正しました。\n- **A Dark Room の重なり解消（r46）**：`.headerButton` の浮動崩れを解消し、コンパクトな中央カード内でタイトルとボタンが重ならないよう整えました。\n- **トップへ戻るボタンの右下固定（r47）**：記事ウィンドウ右下に固定配置し右余白を確保することで、最下部までスクロールしても本文に一切重ならないようにしました。\n- **オンライン画板の匿名欄余白（r48）**：`.identity-panel` に左右対称の `18px` 余白を設定し、左枠との接触を解消しました。"
  }
}, "2026-11-23T08:46:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-taskbar-removal-article-top-about-avatar', '2026-11-23-pond-taskbar-removal-article-top-about-avatar', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T08:23:00+08:00', '2026-11-23T08:23:00+08:00', '2026-11-23T08:23:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-taskbar-removal-article-top-about-avatar", {
  "zh": {
    "title": "移除冗余底栏并低调收纳状态/公告角标、修复文章回顶按钮与关于页圆形头像",
    "summary": "桌面与手机端移除冗余底部任务栏，在右下角低调保留在线状态与公告入口；修复文章阅读页回到顶部在 0% 时压正文问题并替换元信息彩色图标；关于页去除头像方形底框只留圆本体。",
    "content_markdown": "# 移除冗余底栏并低调收纳状态/公告角标、修复文章回顶按钮与关于页圆形头像\n\n本次更新对全站悬浮控件、底栏导航、文章阅读页细节与关于页头像表现进行了减法清理与规范化。\n\n## 本次改动明细\n\n- **移除底部任务栏并清理旧样式**：桌面端与手机端均彻底隐藏冗余的底部任务栏（桌面六枚池塘图标与手机顶部返回键已满足全部导航），并删除了旧桌面底栏样式块，不留死代码。\n- **右下角低调收纳状态与公告入口**：参照左下角 ID 与语言切换的点阵收纳风格，在右下角放置低调的实时站点在线状态灯（在线/检测中/离线）与点阵「公告」按钮，点击即可打开欢迎与最近更新弹窗（顶部时间点击与 #welcome 哈希同样保留）。\n- **文章阅读页回顶按钮与元信息图标**：修复样式覆盖 hidden 属性导致「回到顶部」在 0% 进度常驻并压住正文首标题的问题，调整为滚动超过约一屏后固定显示在窗口右下角外缘、回到顶部自动隐藏；同步将分类/发布时间前的彩色 emoji 图标替换为点阵 SVG 图标，并全站补齐 [hidden] 安全防线。\n- **关于页纯粹圆形头像**：桌面与手机端均去掉头像外层的方形底板与外框衬底，仅保留干净居中的圆形头像本体。"
  },
  "en": {
    "title": "Remove Bottom Taskbar, Add Low-Key Corner Status/Notice, Fix Article Back-to-Top & About Avatar",
    "summary": "Removed the redundant bottom taskbar on desktop and mobile while keeping live status and Welcome Notice in a subtle corner dock; fixed article Back-to-Top overlap at 0% scroll, replaced metadata emojis with dotted icons, and removed the square About avatar frame.",
    "content_markdown": "# Remove Bottom Taskbar, Add Low-Key Corner Status/Notice, Fix Article Back-to-Top & About Avatar\n\nThis release streamlines floating chrome and cleans up overlapping controls across Home, Knowledge Article Reader, and About.\n\n## Key changes\n\n- **Bottom taskbar removed cleanly**: Removed the redundant bottom taskbar on both desktop and mobile and deleted the legacy desktop taskbar CSS block.\n- **Low-key corner status & notice dock**: Added a subtle dotted bottom-right corner cluster mirroring the bottom-left ID/Language controls, keeping the live service-online lamp and clickable Notice trigger for the Welcome modal.\n- **Article Back-to-Top & dotted metadata icons**: Fixed a CSS override that exposed the Back-to-Top button over the first heading at 0% scroll. It now appears only after scrolling roughly one screen, anchored cleanly to the bottom-right corner outside article text; replaced colorful category/published emojis with dotted SVGs and added a global [hidden] guard.\n- **Clean circular About avatar**: Removed the outer square backdrop and frame around the About avatar on desktop and mobile."
  },
  "ja": {
    "title": "下部バー削除・控えめな角ステータス/お知らせ配置・記事トップ戻り修正とプロフィール円形アイコン化",
    "summary": "デスクトップとモバイルの冗長な下部バーを削除し、右下に控えめなオンライン状態とお知らせ入口を配置。記事ページのトップへ戻る重なり修正とドットアイコン化、プロフィール画像の四角枠除去を実施しました。",
    "content_markdown": "# 下部バー削除・控えめな角ステータス/お知らせ配置・記事トップ戻り修正とプロフィール円形アイコン化\n\n今回の更新では、冗長な下部バーの整理と浮遊コントロールの重なり解消を行いました。\n\n## 主な変更点\n\n- **下部バーの削除と旧スタイル整理**：デスクトップ・モバイル双方の下部バーを非表示にし、不要となったデスクトップ下部バー用CSSを削除しました。\n- **右下コーナーへの控えめな集約**：左下のID・言語切替と対になるドット調で、オンライン稼働ランプとお知らせ（ようこそ窓）ボタンを右下に配置しました。\n- **記事リーダーのトップ戻りボタンとドットアイコン化**：0%位置で見出しに重なっていた不具合を修正し、約1画面スクロール後のみ右下枠外に表示されるように改善。カテゴリ・公開日のカラー絵文字もドットSVGへ統一し、全サイト共通の [hidden] 保護を追加しました。\n- **プロフィール画像の円形単体化**：外側の四角い背景枠を取り除き、すっきりとした円形アイコンのみに整えました。"
  }
}, "2026-11-23T08:23:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-23-pond-full-site-inspection-fixes', '2026-11-23-pond-full-site-inspection-fixes', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-23T00:20:00+08:00', '2026-11-23T00:20:00+08:00', '2026-11-23T00:20:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-23-pond-full-site-inspection-fixes", {
  "zh": {
    "title": "全站视觉点检修复：桌面底栏导航、欢迎窗入口、双工具页换装与四款游戏暗色适配",
    "summary": "恢复桌面端底栏主导航与站点服务在线状态，打通首页顶部与底栏时间点击打开欢迎窗；完成在线画板与日语的言外之意深色点阵换装，并修复 Hextris 白画布、猫国零存档排版与小黑屋居中。",
    "content_markdown": "# 全站视觉点检修复：桌面底栏导航、欢迎窗入口、双工具页换装与四款游戏暗色适配\n\n本次更新针对全站线上视觉点检提出的重项与逐页细节进行了集中修复，全部属于纯视觉与交互入口层调整，不改动原有业务与存档逻辑。\n\n## 核心修复清单\n\n- **桌面底栏主导航与服务状态显形**：在桌面端深夜池塘桌面底部恢复并重绘半透明点阵玻璃任务栏（位于池塘画布之上），完整展示「首页」、六大分区快捷入口、可点击时间与实时「站点服务在线」状态灯。\n- **欢迎窗多入口直达与 WebGL 恢复保护**：点击首页顶部正中时间/日期、点击底栏时间或访问 #welcome / ?welcome=1 均可直接打开欢迎窗；为池塘画布补齐 webglcontextlost/restored 自动恢复监听。\n- **在线画板与日语的言外之意完整暗色换装**：修正共享工具主题表的实际类名映射，替换两页的旧亮蓝顶栏与白底卡片，消除浅字配白底隐形问题，同时保持 Excalidraw 暖纸绘图区不变。\n- **四款游戏内页适配**：Hextris 中央画布改为深池塘暗色并提亮六向辐条；猫国建设者修正新访客零存档宽屏三栏对称并暗色化滚动条；小黑屋居中排版消除右侧大块留白；人生重开统一暗色背景边距。\n- **货架与浮层细节**：修复工具区临时互传展开防溢、提亮游戏货架语言支持标签并拉宽开始按钮、统一登录浮层按钮与输入框边框。"
  },
  "en": {
    "title": "Full-Site Visual Inspection Fixes: Desktop Taskbar, Welcome Triggers, Tool Reskins & Game Layouts",
    "summary": "Restored the desktop bottom navigation and live service status bar, wired clickable Welcome modal triggers, reskinned Whiteboard & Japanese Subtext in dark CRT style, and fixed Hextris, Kittens, A Dark Room, and Life Restart layouts.",
    "content_markdown": "# Full-Site Visual Inspection Fixes: Desktop Taskbar, Welcome Triggers, Tool Reskins & Game Layouts\n\nThis release addresses the priority items found during the full-site live visual inspection across desktop navigation, modals, standalone tools, and embedded games.\n\n## Key improvements\n\n- **Desktop bottom navigation & service status**: Restored and restyled the bottom taskbar above the Midnight Pond canvas as a frosted CRT pill dock displaying Home, all six route shortcuts, a clickable clock, and the live service-online status indicator.\n- **Clickable Welcome modal triggers & WebGL recovery**: Clicking the top-center pond clock, clicking the bottom taskbar clock, or navigating to #welcome now opens the Welcome modal directly; added WebGL context-loss recovery.\n- **Whiteboard & Japanese Subtext dark reskin**: Fixed real class-name selectors in the shared tool theme so both standalone tools render in crisp dark dotted CRT glass with high-contrast headings and subtitles while keeping the Excalidraw warm-paper canvas intact.\n- **Embedded game layouts**: Dark-themed the Hextris center canvas and brightened spokes, balanced Kittens Game zero-save widescreen columns with dark scrollbars, centered A Dark Room in a framed dark panel, and unified Life Restart side bands."
  },
  "ja": {
    "title": "全サイト視覚点検修正：下部ナビ復元、ようこそ入口追加、ツール暗色化とゲーム調整",
    "summary": "デスクトップ下部ナビと稼働状態バーを復元し、時計クリックや #welcome でようこそ窓を開けるように改善。お絵かきボードと日本語の行間を暗色化し、Hextris・Kittens・A Dark Room の表示を修正しました。",
    "content_markdown": "# 全サイト視覚点検修正：下部ナビ復元、ようこそ入口追加、ツール暗色化とゲーム調整\n\n今回の更新では、本番サイトの全ページ視覚点検で見つかった重要項目と細部の表示崩れをまとめて修正しました。機能やセーブデータ仕様は一切変更していません。\n\n## 主な修正内容\n\n- **デスクトップ下部ナビと接続状態バーの復元**：池キャンバスの手前に半透明ドットガラス調のボトムバーを配置し、ホーム・主要ナビ・クリック可能な時計・サービス稼働ランプを常時表示しました。\n- **ようこそ窓の入口追加と WebGL 復帰対策**：画面上部の時計、下部バーの時計、および #welcome ハッシュから直接ようこそ窓を開けるようにし、WebGL コンテキストロスト時の自動復帰を追加しました。\n- **お絵かきボード・日本語の行間の暗色統一**：共通テーマのクラス指定を実DOMに合わせて修正し、白背景に淡色文字で読めなかった箇所を解消しました（Excalidraw 描画紙面は維持）。\n- **ゲーム画面の最適化**：Hextris の白い中央キャンバスを暗色化してスポークを見やすくし、Kittens Game の初期状態3列バランスと暗色スクロールバー、A Dark Room の中央配置、Life Restart の背景余白を整えました。"
  }
}, "2026-11-23T00:20:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-button-spacing-system', '2026-11-22-pond-button-spacing-system', 'site-updates', 'undefined', '', 'published', 0, 0, '2026-11-22T23:41:00+08:00', '2026-11-22T23:41:00+08:00', '2026-11-22T23:41:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-button-spacing-system", {
  "zh": {
    "title": "全站按钮尺寸、光学居中与间距体系统一重构",
    "summary": "桌面与手机端全站拉网排查：消除标题栏横线压过关闭键问题，统一按钮最小尺寸、对称内边距与元素间距，并修复游戏展开溢边与移动端触碰。",
    "content_markdown": "# 全站按钮尺寸、光学居中与间距体系统一重构\n\n本次更新对桌面端与手机端全部窗口、弹窗、展开详情区和导航栏的可点击控件进行了系统性拉网排查与样式重构。\n\n## 本次改进重点\n\n- **标题栏与关闭键避让**：清除旧动效样式在标题栏顶部绘制的横线，避免其横穿欢迎窗与视频弹窗右上角关闭键；全站关闭键与视频最大化键统一放大至桌面 36x36、手机 44x44，完整落在标题栏内部并留足上下呼吸边距。\n- **欢迎窗快捷入口样板**：桌面端 4 枚快捷入口统一为等宽四列、38px 等高、10px 统一间距，图标与文字整体光学居中；手机端统一为 2x2 等宽网格与 46px 高度。\n- **全站按钮尺寸与对称内边距**：统一知识库清空/分类/继续加载、工具区打开/开始、游戏区开始/来源、聊天室换昵称/密码房/帮助/发送、账号浮层与关于页 RSS 订阅等按钮的最小宽高、垂直水平居中与左右对称内边距。\n- **溢出与相碰修复**：修复游戏卡展开许可证标签溢出边框及开始按钮压底边、手机端聊天室按钮零间距相碰、手机端关于页 RSS 按钮文字贴顶等细节问题。"
  },
  "en": {
    "title": "Site-Wide Button Sizing, Optical Centering, and Spacing System",
    "summary": "Full desktop and mobile audit fixing titlebar close-button line overlap, uneven quick-link alignment, undersized buttons, expanded card overflow, and tight gaps.",
    "content_markdown": "# Site-Wide Button Sizing, Optical Centering, and Spacing System\n\nThis release completes a full-site desktop and mobile audit across every window, modal, popover, expanded detail section, and toolbar control.\n\n## Key improvements\n\n- **Titlebar close-button clearance**: Removed the legacy inset top line inherited from motion styles that cut across the close and maximize buttons on modals; unified all close buttons to 36x36 on desktop and 44x44 on mobile with balanced top and bottom clearance.\n- **Welcome quick-entry benchmark**: Aligned the four quick-entry buttons into an equal-width 4-column desktop grid (2x2 on mobile) with uniform height, optically centered icon-plus-label pairs, and even gaps.\n- **Consistent button sizing and padding**: Standardized minimum widths, heights, symmetric horizontal padding, and centered flex alignment across Knowledge, Article Reader, Videos, Video Modal, Tools, Games, Chatroom, About, and Account Popover.\n- **Overflow and collision fixes**: Prevented expanded game license badges from overflowing card borders or pushing Start buttons onto the bottom border, separated touching mobile chatroom buttons, and centered the mobile About RSS button label."
  },
  "ja": {
    "title": "全サイト共通のボタンサイズ・中央揃え・余白設計の統一",
    "summary": "デスクトップとモバイル全画面のボタンを総点検し、閉じるボタンと線の重なり、サイズ不足、左右余白の偏り、ゲーム展開枠のはみ出しや要素接触を修正しました。",
    "content_markdown": "# 全サイト共通のボタンサイズ・中央揃え・余白設計の統一\n\n今回の更新では、デスクトップ版とモバイル版のすべてのウィンドウ、モーダル、展開パネル、ツールバーにあるボタンと操作要素を総点検し、サイズと余白の基準を統一しました。\n\n## 主な改善内容\n\n- **タイトルバーと閉じるボタンの余白確保**：旧スタイル由来の横線がモーダルの閉じるボタンや最大化ボタンを横切る不具合を解消し、デスクトップ 36x36・モバイル 44x44 で上下左右に十分な余白を確保しました。\n- **ようこそ窓のクイック入口統一**：デスクトップ 4 列・モバイル 2x2 の均等グリッドで高さと間隔を揃え、アイコンと文字を視覚的に中央配置しました。\n- **全ページの最小サイズと対称パディング**：ナレッジ、記事リーダー、動画モーダル、ツール、ゲーム、チャット、プロフィール、アカウントパネルの各ボタンで最小幅・高さ・中央揃えを統一しました。\n- **はみ出しと接触の解消**：ゲーム詳細展開時のライセンス表示はみ出しや開始ボタンの枠接触、モバイルチャット上部のボタン接触、プロフィール RSS ボタンの文字上寄りを修正しました。"
  }
}, "2026-11-22T23:41:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-welcome-rebuild-notice', '2026-11-22-pond-welcome-rebuild-notice', 'site-updates', '["视觉升级","欢迎窗","公告"]', '', 'published', 0, 0, '2026-11-22T21:01:00+08:00', '2026-11-22T21:01:00+08:00', '2026-11-22T21:01:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-welcome-rebuild-notice", {
  "zh": {
    "title": "欢迎弹窗顶部新增前端重构临时公告条（三语）",
    "summary": "在欢迎窗最上方加入点阵虚线暖金临时公告条提示前端重构与逐步修复中，配齐中英日三语并保留独立撤除标记。",
    "content_markdown": "本次按站长要求在欢迎弹窗内容区最上方新增一条临时公告条，提示访客本站前端正在重构中、部分页面可能出现排版错位或显示不清晰等 BUG 并在逐步修复中。公告条采用与欢迎窗一脉相承的点阵虚线暖金视觉语言，完整保留原有问候语、站长状态、快捷入口和最近五条更新，并配齐中/英/日三语切换；代码层面通过独立 TEMP_REBUILD_NOTICE 区块标注，后续重构收尾时可一键整块撤除。"
  },
  "en": {
    "title": "Added Temporary Frontend Redesign Notice Banner to Welcome Modal (zh/en/ja)",
    "summary": "Added a removable dotted amber notice banner at the top of the Welcome modal in Chinese, English, and Japanese without altering existing sections.",
    "content_markdown": "This release adds a temporary dotted-border announcement banner at the top of the Welcome modal informing visitors that the frontend is undergoing a redesign and layout/display glitches are being gradually fixed. The banner supports Chinese, English, and Japanese via the site i18n system, preserves the greeting, site status, quick links, and five recent updates intact, and is isolated under TEMP_REBUILD_NOTICE markers for clean one-step removal once the redesign wraps up."
  },
  "ja": {
    "title": "ウェルカムウィンドウ上部にフロントエンド再構築のお知らせ枠を追加（3言語対応）",
    "summary": "ウェルカム窓の最上部に点陣デザインの一時お知らせ枠（中・英・日）を追加し、後で一括撤去しやすい独立構成にしました。",
    "content_markdown": "今回の更新ではウェルカムウィンドウの最上部に一時的なお知らせバナーを追加し、フロントエンド再構築に伴う一部ページの表示崩れや不具合を順次修正中である旨を案内しています。点陣破線のデザイン言語に統一しつつ従来の挨拶・サイト状態・クイック入口・最新更新5件をそのまま維持し、中英日の3言語切替に対応しました。コードは TEMP_REBUILD_NOTICE ブロックとして分離しており、完了後すぐに撤去可能です。"
  }
}, "2026-11-22T21:01:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-home-icon-isolation', '2026-11-22-pond-home-icon-isolation', 'site-updates', '["视觉升级","首页"]', '', 'published', 0, 0, '2026-11-22T20:49:00+08:00', '2026-11-22T20:49:00+08:00', '2026-11-22T20:49:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-home-icon-isolation", {
  "zh": {
    "title": "首页桌面图标悬停与点击完全独立零连带位移",
    "summary": "移除首页非悬停图标受全局时钟驱动的浮动与闪烁，确保悬停或点击单个图标时仅目标图标响应、其余图标纹丝不动。",
    "content_markdown": "本次修复首页桌面图标悬停或点击时相邻图标跟着移位跳动的根因：由于 UI 覆盖层在空闲时暂停重绘，而图标绘制中的纵向浮动 floatY 与点阵闪烁曾依赖全局时间 t，导致鼠标悬停或点击某个图标触发重绘时，其余五个静止图标因时间跳变而同步位移闪烁。现已彻底移除非悬停图标与全局时间 t 的耦合，仅对当前悬停/点击的目标图标执行独立缩放、微抬与发光反馈，其余五个图标与左下角控件在任何状态下均保持零像素位移。"
  },
  "en": {
    "title": "Home Desktop Icon Hover & Click Isolation (Zero Sibling Movement)",
    "summary": "Removed global-time drift from non-hovered home desktop icons so hovering or clicking one icon never moves or flickers any other icon.",
    "content_markdown": "This release fixes the root cause behind sibling desktop icons shifting when hovering or clicking a single icon on Home: because the UI overlay pauses idle redraws while icon floatY and dot opacity previously depended on global time t, waking the overlay for one icon caused all five other icons to jump to new sine-wave offsets. Decoupling non-hovered icons from global time ensures only the targeted icon animates while every other icon stays completely still with zero pixel shift."
  },
  "ja": {
    "title": "ホームデスクトップアイコンのホバー・クリック独立化（他アイコンの位置ずれゼロ）",
    "summary": "非ホバー時のグローバル時刻連動の揺れを除去し、1つのアイコンにホバー・クリックしても他のアイコンが一切動かないよう修正しました。",
    "content_markdown": "今回の更新では、ホーム画面のデスクトップアイコンにホバー・クリックした際に他のアイコンまで一緒に動く原因を解消しました。UI オーバーレイは待機時に再描画を停止する一方、各アイコンの縦揺れと点滅がグローバル時刻 t に依存していたため、1つのアイコン操作で再描画が起きた瞬間に他の5つも位相が飛んで動いていました。非ホバー時の時刻依存を完全に外し、対象アイコンのみが独立して反応し他は0px不動となるようにしています。"
  }
}, "2026-11-22T20:49:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-kittens-widescreen-fix', '2026-11-22-pond-kittens-widescreen-fix', 'site-updates', '["视觉升级","游戏区","猫国建设者"]', '', 'published', 0, 0, '2026-11-22T12:44:00+08:00', '2026-11-22T12:44:00+08:00', '2026-11-22T12:44:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-kittens-widescreen-fix", {
  "zh": {
    "title": "猫国建设者宽屏居中布局、小按钮暗色化与标签栏防裁修复",
    "summary": "修复猫国建设者宽屏贴左留空问题，将建筑行右侧 sell/+/- 白块暗色化，并让顶部标签栏自动换行完整显示 Stats。",
    "content_markdown": "本次针对猫国建设者游戏内页的宽屏与暗色适配完成三项核心修复：一是将三栏容器 #gamePageContainer 与 #game 改为最大 1560px 视口居中自适应弹性布局，中栏放宽至 580–840px，彻底消除宽屏下内容挤在左半屏、右侧大片空黑的问题；二是覆写原版 CSS 变量 --page-background-color 并精准暗色化 .linkContent、sell/+/-、弹窗按钮与下拉框，消除建筑行右侧白色块；三是将顶部标签栏 .tabsContainer 由绝对定位改为流式自动换行，确保 Stats 等右侧标签完整可见。游戏逻辑、存档与收起式站点工具栏均保持原样。"
  },
  "en": {
    "title": "Kittens Game Widescreen Centering, Dark Sub-Buttons, and Wrapping Tab Bar",
    "summary": "Centered Kittens Game's 3-column layout for widescreen displays, dark-themed sell/+/- sub-buttons, and wrapped the top tab bar so Stats is never clipped.",
    "content_markdown": "This release fixes three Kittens Game presentation issues on widescreen displays: centering #gamePageContainer and #game as a responsive 1560px flex layout so the game no longer hugs the left half of wide monitors; overriding --page-background-color and dark-theming .linkContent, sell/+/-, dialog buttons, and selects to eliminate bright white blocks; and changing .tabsContainer to a wrapping flex row so Stats and all rightmost tabs display completely. All game logic, saves, and collapsible site toolbar remain intact."
  },
  "ja": {
    "title": "Kittens Game ワイド画面中央配置・小ボタン暗色化・タブ折り返し修正",
    "summary": "ワイド画面での左寄り余白を解消して中央3欄へ広げ、sell/+/-の白ボタンを暗色化し、上部タブ欄を折り返してStatsまで完全表示しました。",
    "content_markdown": "今回の更新では Kittens Game 内ページのワイド画面・暗色表示を3点修正しました。まず #gamePageContainer と #game を最大1560pxの中央揃えフレックス3欄レイアウトへ変更し、ワイド画面で右半分が大きく空く問題を解消しています。次に --page-background-color と .linkContent・sell/+/- ボタンを暗色化して白い塊をなくし、さらに上部タブ欄 .tabsContainer を折り返し表示へ改めて Stats などの右端タブが切れないようにしました。ゲームロジックやセーブ、折りたたみ式ツールバーは維持しています。"
  }
}, "2026-11-22T12:44:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-chat-footer-sync-dot', '2026-11-22-pond-chat-footer-sync-dot', 'site-updates', '["视觉升级","聊天室"]', '', 'published', 0, 0, '2026-11-22T12:21:00+08:00', '2026-11-22T12:21:00+08:00', '2026-11-22T12:21:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-chat-footer-sync-dot", {
  "zh": {
    "title": "聊天室底栏提示提亮留距与同步状态指示灯补齐",
    "summary": "提亮聊天室底部冷却提示文字并增加四周呼吸边距防止贴边，同时为右上角同步状态补充在线/离线/重连三态荧光指示灯。",
    "content_markdown": "本次针对匿名聊天室最后两处观感细节完成收尾：一是将底部冷却提示行与自动滚动标签的文字对比度提亮至清透青白色并放大上下左右内边距，彻底消除贴近窗口底沿与偏暗难读的观感；二是为右上角既有的同步刷新状态文案补充三态荧光状态指示灯（在线翠绿、重连暖黄、离线玫红），让实时连接与同步状态一眼可辨，同时完整保留现站原有轮询逻辑、状态文案与所有交互行为。"
  },
  "en": {
    "title": "Chatroom Footer Contrast, Padding, and Sync Status Indicator Dot",
    "summary": "Brightened the chatroom bottom cooldown hint with balanced padding and added a glowing online/reconnecting/offline status dot beside the sync label.",
    "content_markdown": "This release polishes two final chatroom UI details: brightening the bottom cooldown hint and auto-scroll text with comfortable padding so nothing hugs the window edge, and adding a glowing three-state connection indicator dot (emerald online, amber reconnecting, rose offline) beside the existing sync refresh status label while preserving all live polling behavior and copy."
  },
  "ja": {
    "title": "チャット下部ヒントの高コントラスト化・余白調整と同期インジケーター追加",
    "summary": "チャット下部のクールダウン案内文字を明るくし余白を確保するとともに、右上の同期表示へ接続状態ランプを追加しました。",
    "content_markdown": "今回の更新では匿名チャットの最後の細部を仕上げました。下部の送信間隔ヒントと自動スクロール表記の文字色を明るいシアン白へ引き上げて上下左右の余白を確保し、端への張り付きを解消しています。さらに右上の既存同期ステータス横にオンライン・再接続・オフラインを示す発光インジケータードットを追加し、既存の同期ロジックと文言をそのまま分かりやすくしました。"
  }
}, "2026-11-22T12:21:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-about-balance-chat-avatars', '2026-11-22-pond-about-balance-chat-avatars', 'site-updates', '["视觉升级","关于页","聊天室"]', '', 'published', 0, 0, '2026-11-22T12:06:00+08:00', '2026-11-22T12:06:00+08:00', '2026-11-22T12:06:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-about-balance-chat-avatars", {
  "zh": {
    "title": "关于页左右栏等高对齐与聊天室六枚点阵头像重绘提色",
    "summary": "将关于页头像放大至 210px 与右栏高度齐平彻底消除下方空块，并将聊天室 6 枚点阵头像重绘为月夜池塘专属柔彩微光造型。",
    "content_markdown": "本次完成两项实拍精修：一是将关于我窗口左列头像放大至 210×210 并微调右列行距，使左列头像与右列信息区上下自然齐平，彻底消除头像下方的空块；二是将聊天室已接入的 6 枚默认点阵头像（莲花、锦鲤、明月、荷叶、水纹、星芒）由原本偏淡的灰白细线圈重绘为月夜池塘专属柔彩点阵微光造型（粉莲、橙鲤、暖月、翠叶、冰纹、紫星），并同步暗色化未读消息跳转胶囊。"
  },
  "en": {
    "title": "Balanced About Column Height and Vibrant Glowing Dot-Matrix Chat Avatars",
    "summary": "Enlarged the About avatar to 210px to match the right column height cleanly, and redrew all six chatroom dot-matrix avatars in distinct glowing Midnight Pond colors.",
    "content_markdown": "This release finishes two visual refinements: enlarging the About window avatar to 210x210 so the left and right columns balance cleanly with zero empty space below the avatar; and redrawing all six chatroom default dot-matrix SVG avatars (lotus, koi, moon, leaf, ripple, star) from faint monochrome wireframes into distinct glowing Midnight Pond motifs with matching dark styling for the unread-messages button."
  },
  "ja": {
    "title": "概要ウィンドウ左右高さ揃えとチャット6種点陣アバターの彩色刷新",
    "summary": "概要アバターを210pxへ拡大して右欄と高さを揃え下の空きを解消し、チャット用6種の点陣アバターを月夜池の淡彩発光モチーフへ刷新しました。",
    "content_markdown": "今回の更新では2点の仕上げを行いました。概要ウィンドウ左側のアバターを210×210へ拡大して右側情報欄と上下の高さを揃え、アバター下の空きを完全に解消しています。また匿名チャット用の6種の点陣アバター（蓮・錦鯉・月・蓮葉・波紋・星）を薄い単色線から鮮やかな月夜池の淡彩発光モチーフへ描き直し、未読メッセージボタンも暗色点陣スタイルへ統一しました。"
  }
}, "2026-11-22T12:06:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-about-tight-chat-preload', '2026-11-22-pond-about-tight-chat-preload', 'site-updates', '["视觉升级","关于页","聊天室"]', '', 'published', 0, 0, '2026-11-22T11:51:00+08:00', '2026-11-22T11:51:00+08:00', '2026-11-22T11:51:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-about-tight-chat-preload", {
  "zh": {
    "title": "关于页进一步收紧贴合内容与聊天室点阵头像预加载",
    "summary": "收紧关于页内边距与行距彻底消除头像下方空块，并在进入聊天室时预加载 6 枚点阵默认头像消除冷加载空圈闪现。",
    "content_markdown": "本次完成两项实机复审细节收口：一是进一步收紧关于我窗口宽度与内部行距、自介边距及 RSS 条内边距，彻底消除头像下方的明显留白，使窗口紧密贴合内容；二是为聊天室 6 枚点阵默认头像（莲花、锦鲤、明月、荷叶、水纹、星芒）增加即时预加载与同步解码，消除消息刚载入时头像短暂空白圆圈的问题，确保进入聊天室即刻完整显示点阵头像。"
  },
  "en": {
    "title": "Tighter About Window Fit and Chatroom Dot-Matrix Avatar Preloading",
    "summary": "Tightened About window spacing to eliminate empty space below the avatar, and preloaded all six dot-matrix chat avatars for instant display.",
    "content_markdown": "This release finishes two live-review details: tightening the About window width, internal row gaps, bio margin, and RSS bar padding to eliminate the empty block beneath the avatar; and preloading all six dot-matrix chatroom avatars (lotus, koi, moon, leaf, ripple, star) with eager sync decoding so chat messages display their avatars immediately without any blank circle flash."
  },
  "ja": {
    "title": "概要ウィンドウの余白圧縮とチャット点陣アバターの事前読込",
    "summary": "概要ウィンドウの余白をさらに引き締めてアバター下の空きを解消し、チャット用6種の点陣アバターを事前読込して即表示するようにしました。",
    "content_markdown": "今回の更新では実機レビューで挙がった2点の仕上げを行いました。概要ウィンドウの幅・行間・自己紹介余白・RSSバー内余白をさらに引き締めてアバター下の空きを完全に解消し、内容量にぴったり収まるバランスへ整えています。あわせて匿名チャット用の6種類の点陣アバター（蓮・錦鯉・月・蓮葉・波紋・星）を事前読込と同期デコードで即時表示させ、メッセージ読込直後の空丸表示を完全に防いでいます。"
  }
}, "2026-11-22T11:51:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-titlebar-close-final', '2026-11-22-pond-titlebar-close-final', 'site-updates', '["视觉升级","全站图标"]', '', 'published', 0, 0, '2026-11-22T11:40:00+08:00', '2026-11-22T11:40:00+08:00', '2026-11-22T11:40:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-titlebar-close-final", {
  "zh": {
    "title": "主窗口标题栏点阵关闭叉号优先级最终补齐",
    "summary": "补齐六个主窗口 .window-titlebar .close-button 同级优先级，彻底解决关于、工具等窗口关闭圆圈内叉号被旧规则清空的问题。",
    "content_markdown": "本次针对关于我、工具区、知识库、视频区、游戏区与聊天室六个主窗口补齐 .window-titlebar .close-button 同级选择器优先级，彻底解决此前各主窗口旧规则覆盖背景图导致右上角圆形关闭按钮内点阵叉号不可见的问题。全站所有九处窗口与浮层现均统一展示清晰锐利的 30×30 点阵关闭叉号，且悬停与点击保持零偏移。"
  },
  "en": {
    "title": "Main Window Titlebar Dotted Close X Final Specificity Fix",
    "summary": "Matched .window-titlebar .close-button specificity across all six main windows so every circular close button renders its dotted X crisply.",
    "content_markdown": "This release matches .window-titlebar .close-button specificity across Knowledge, Videos, Tools, Games, Chatroom, and About windows so legacy per-window background shorthand rules no longer clear the dotted X SVG. All nine windows and modals across the site now display identical crisp 30x30 dotted close buttons with zero hover or active shift."
  },
  "ja": {
    "title": "主要ウィンドウタイトルバー点陣閉じるボタン最終修正",
    "summary": "主要6ウィンドウの .window-titlebar .close-button 詳細度を揃え、閉じる円ボタン内の点陣×が全画面で確実に表示されるよう仕上げました。",
    "content_markdown": "今回の更新では知識ベース・動画・ツール・ゲーム・チャット・概要の主要6ウィンドウに対して .window-titlebar .close-button の詳細度を揃え、旧背景ルールにより点陣×が消えていた現象を完全に解消しました。サイト内全9箇所のウィンドウとモーダルで統一された30×30点陣×ボタンが鮮明に表示されホバー時の位置ずれもゼロになっています。"
  }
}, "2026-11-22T11:40:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-close-id-specificity', '2026-11-22-pond-close-id-specificity', 'site-updates', '["视觉升级","全站图标"]', '', 'published', 0, 0, '2026-11-22T11:32:00+08:00', '2026-11-22T11:32:00+08:00', '2026-11-22T11:32:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-close-id-specificity", {
  "zh": {
    "title": "全站九个窗口点阵关闭图标优先级收口",
    "summary": "为全站所有窗口与弹窗的点阵关闭按钮补齐 ID 级选择器优先级，确保每个窗口右上角 30px 点阵叉号清晰可见且悬停零偏移。",
    "content_markdown": "本次修正全站各窗口右上角关闭按钮点阵叉号被早期窗口 ID 规则覆盖的问题：通过将全局关闭键规则升级为 :is() ID 级选择器，统一覆盖知识库、视频区、工具区、游戏区、匿名聊天室、关于我、欢迎窗、视频播放浮层与云存档账号浮层全部九处窗口与弹窗的 30×30 圆形点阵关闭按钮，确保每一处关闭叉号均清晰锐利可见，且悬停与点击只提亮不变形不偏移。"
  },
  "en": {
    "title": "Unified Dotted Close Button ID-Specificity Fix Across All Windows",
    "summary": "Applied ID-level specificity so the unified 30x30 dotted close X renders crisply with zero hover shift in all nine windows and modals.",
    "content_markdown": "This release fixes the specificity conflict where per-window ID rules cleared the dotted close-button background image. Applying :is() ID-level specificity across Knowledge, Videos, Tools, Games, Chatroom, About, Welcome, Video Modal, and Account Popover ensures every 30x30 close button displays its crisp dotted X with zero hover or active shift."
  },
  "ja": {
    "title": "全9ウィンドウ・モーダルの点陣閉じるアイコン詳細度修正",
    "summary": "全ウィンドウおよびモーダルにID詳細度で統一30px点陣×アイコンを適用し、確実に視認できホバー時に位置ずれしないよう修正しました。",
    "content_markdown": "今回の更新では各ウィンドウ個別のIDルールによって点陣×背景が上書きされていた詳細度競合を解消しました。:is() によるID詳細度ルールを知識ベース・動画・ツール・ゲーム・匿名チャット・概要・ウェルカム・動画再生モーダル・クラウドアカウント浮層の全9箇所に一括適用し、30×30の点陣×ボタンが鮮明に表示されホバーやクリック時も一切位置ずれしないよう仕上げています。"
  }
}, "2026-11-22T11:32:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-video-modal-details', '2026-11-22-pond-video-modal-details', 'site-updates', '["视觉升级","视频区","工具区"]', '', 'published', 0, 0, '2026-11-22T11:25:00+08:00', '2026-11-22T11:25:00+08:00', '2026-11-22T11:25:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-video-modal-details", {
  "zh": {
    "title": "视频播放浮层与工具游戏展开详情暗色点阵换装",
    "summary": "将视频播放浮层标题栏与打开原地址按钮统一换装为深夜池塘点阵风，并将工具卡和游戏卡展开详情里的白底信息框全部暗色化。",
    "content_markdown": "本次完成两处残余旧样式的暗色换装：一是将视频点开后的播放浮层整层按月夜池塘 CRT 点阵风重做，替换原有亮蓝标题栏与白蓝打开原地址按钮，统一 30px 点阵最大化与关闭键，同时完全保持视频播放区域与原有播放逻辑不变；二是将工具卡展开版本与使用说明后的类型/版本/更新时间白底信息框以及游戏卡展开详情标签全部改为深青点阵底与高对比亮字。"
  },
  "en": {
    "title": "Video Playback Modal and Expanded Tool/Game Details Dark CRT Theme",
    "summary": "Restyled the video playback modal titlebar and Open Original button in Midnight Pond CRT style and dark-themed expanded tool and game detail badges.",
    "content_markdown": "This release restyles the video playback modal (#video-modal) into the Midnight Pond dark CRT theme, replacing the legacy blue XP titlebar and light Open Original button with dark glass, dotted buttons, and unified 30px close/maximize controls while keeping the embedded video area and playback logic untouched. It also dark-themes expanded detail badges inside tool and game cards (.resource-fact and .game-secondary-meta)."
  },
  "ja": {
    "title": "動画再生モーダルとツール・ゲーム展開詳細の暗色点陣テーマ化",
    "summary": "動画再生モーダルのタイトルバーと元ページボタンを月夜池ダーク点陣風へ刷新し、ツール・ゲーム詳細展開枠の白背景も暗色化しました。",
    "content_markdown": "今回の更新では動画再生モーダル（#video-modal）の旧青いタイトルバーと白青ボタンを月夜池ダーク CRT 点陣スタイルへ刷新し、再生エリアや既存の再生ロジックには一切触れず視覚表現のみを統一しました。あわせてツールカードのバージョン・説明展開枠やゲームカード詳細展開タグの白背景も暗色点陣スタイルへ統一しています。"
  }
}, "2026-11-22T11:25:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-account-signedin-states', '2026-11-22-pond-account-signedin-states', 'site-updates', '["视觉升级","云存档","全站状态"]', '', 'published', 0, 0, '2026-11-22T11:23:00+08:00', '2026-11-22T11:23:00+08:00', '2026-11-22T11:23:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-account-signedin-states", {
  "zh": {
    "title": "云存档账号浮层已登录态重做与全站低频状态面暗色统一",
    "summary": "彻底去掉账号浮层已登录态白色底块，重排双列均衡按钮与紧凑留白，并同步暗色化全站空态、错误态、恢复提示与气泡说明。",
    "content_markdown": "本次重做了左下角云存档账号浮层的已登录态视觉与排版：移除原有纯白邮箱条与浅蓝白状态条，改为深青半透明点阵胶囊与清晰青白文字；将退出账号与重新检查两个按钮重排为等宽双列并拉开间距，整体浮层高度按内容收紧不留多余空白。同时全站自查并统一暗色化了加载态、空态、错误提示条、网络恢复提示条、聊天室密码房气泡说明与复制链接反馈等低频状态面。"
  },
  "en": {
    "title": "Signed-In Cloud Account Popover Redesign and Low-Frequency Status Surfaces",
    "summary": "Replaced the bright white signed-in account strips with dark CRT panels, balanced 2-column buttons, and unified all empty/error/recovery/popover status surfaces.",
    "content_markdown": "This release redesigns the signed-in Cloud Save Account popover into a compact dark CRT layout, eliminating the legacy white email bar and pale status block in favor of dark dotted containers with crisp cyan text and balanced two-column action buttons. We also audited and dark-themed all low-frequency status surfaces across the site, including loading, empty, error, recovery notices, chatroom help popovers, and copy-link feedback."
  },
  "ja": {
    "title": "クラウドアカウントログイン済みポップオーバー刷新と低頻度状態面の暗色統一",
    "summary": "ログイン済みアカウント浮層の白帯を撤廃し2列均等ボタンへ再配置するとともに、全サイトの空・エラー・復帰通知などの状態面を暗色統一しました。",
    "content_markdown": "今回の更新では左下IDのクラウドセーブアカウント浮層のログイン済み表示を刷新し、従来の白いメール帯と淡い状態枠を廃止して暗色点陣スタイルと2列均等ボタン配置へ整理しました。あわせて読み込み中・空表示・エラー通知・復旧バー・チャット説明ツールチップ・リンクコピー通知などサイト全体の低頻度状態面も月夜池ダークテーマへ統一しています。"
  }
}, "2026-11-22T11:23:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-center-close-games-polish', '2026-11-22-pond-center-close-games-polish', 'site-updates', '["视觉升级","关于页","游戏区"]', '', 'published', 0, 0, '2026-11-22T11:18:00+08:00', '2026-11-22T11:18:00+08:00', '2026-11-22T11:18:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-center-close-games-polish", {
  "zh": {
    "title": "内容适配窗口居中对齐、点阵关闭键与游戏暗色细节收口",
    "summary": "修复关于/工具/游戏收紧窗口居中定位与右上角点阵关闭图标优先级，清除小黑屋白条并还原2048数字方块亮色与Hextris底栏暗色。",
    "content_markdown": "本次完成实拍复核发现的五处细节收口：一是将改为按内容定尺寸的关于页、工具区与游戏区窗口恢复视口正中定位；二是提升全站右上角点阵虚线关闭键 SVG 的选择器优先级，确保所有窗口与弹窗内清晰可见；三是彻底隐藏小黑屋左侧白色渐变遮罩并将右上角保存提示改为暗色青框；四是仅对 2048 空格底色暗色化以完整保留数字方块亮色对比；五是将 Hextris 底部操作提示条统一改为月夜池塘暗色。"
  },
  "en": {
    "title": "Centered Content-Fit Windows, Dotted Close Icon Priority, and Game Dark-Mode Polish",
    "summary": "Centered About, Tools, and Games windows, raised dotted close-button SVG specificity, removed A Dark Room white gradient, restored 2048 tile colors, and darkened Hextris hint bar.",
    "content_markdown": "This release finishes five polish details caught during live screenshot inspection: centering the content-fit About, Tools, and Games windows on the viewport; raising specificity so the dotted × close-button SVG renders crisply in every titlebar; hiding A Dark Room's legacy white notification gradient and theming its save toast; keeping 2048 numbered tiles vivid while darkening empty cells; and darkening Hextris's bottom hint bar."
  },
  "ja": {
    "title": "内容サイズ窓の中央揃え・点陣閉じるボタンとゲーム暗色微調整",
    "summary": "概要・ツール・ゲーム窓を画面中央へ揃え、点陣閉じるアイコンを全窓で確実に表示し、小黒屋・2048・Hextrisの暗色細部を整えました。",
    "content_markdown": "今回の更新では実機確認で見つかった5点の細部を仕上げました。内容に合わせて縮小した概要・ツール・ゲーム窓を画面中央へ配置し、全ウィンドウの点陣閉じるアイコンが確実に描画されるよう優先度を調整しました。あわせて A Dark Room の白いグラデーション除去、2048 の数字タイル配色維持、Hextris 下部ヒントバーの暗色統一を完了しています。"
  }
}, "2026-11-22T11:18:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-sizing-icons-games', '2026-11-22-pond-sizing-icons-games', 'site-updates', '["视觉升级","全站图标","游戏区","关于页"]', '', 'published', 0, 0, '2026-11-22T11:12:00+08:00', '2026-11-22T11:12:00+08:00', '2026-11-22T11:12:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-sizing-icons-games", {
  "zh": {
    "title": "按内容定窗尺寸、全站旧图标点阵化与五款游戏暗色和三语修复",
    "summary": "收紧关于/工具/游戏窗尺寸贴合内容，替换全站残余旧图标与系统控件为点阵虚线风，并修复小黑屋/2048/Hextris暗色对比度及游戏页语言联动。",
    "content_markdown": "本次完成四项全站收尾：一是按内容量收紧关于页、工具区与游戏区窗口高度与宽度，彻底消除下半大片空白，同时保持知识库、文章、视频与聊天室大窗阅读空间；二是全站清扫残余旧图标，将视频加载与空态电视图标、工具/游戏折叠三角、聊天室帮助/发送/复选框、全站右上角关闭键、文章页内联图标、移动端 Dock 图标与欢迎窗分类轮廓全部统一为点阵虚线自有图标（保留平台官方徽标原样）；三是修复小黑屋左栏白色渐变遮罩、2048 与 Hextris 分数白字压浅底等暗色颜色问题；四是补齐游戏内页读取站点持久化语言及日文简介用词修正。"
  },
  "en": {
    "title": "Content-Fit Window Sizing, Site-Wide Dot-Matrix Icon Unification, and Game Dark Theme & Language Fixes",
    "summary": "Shrank About, Tools, and Games windows to fit content, replaced remaining legacy icons with dot-matrix SVGs, and fixed dark colors and language sync across all 5 games.",
    "content_markdown": "This release delivers four major polish passes: switching About, Tools, and Games windows to content-fit sizing to eliminate excess whitespace while keeping large scrollable windows for Knowledge, Article, Videos, and Chat; replacing remaining legacy icons across video loading/empty states, collapsible summaries, chatroom controls, global close buttons, article metadata, mobile Dock, and welcome categories with unified dot-matrix SVGs; fixing dark-theme contrast bugs in A Dark Room, 2048, and Hextris; and syncing game shell language fallback with site localStorage."
  },
  "ja": {
    "title": "内容量ベースの窓サイズ最適化・全サイト点陣アイコン統一・ゲーム暗色と言語修正",
    "summary": "概要・ツール・ゲーム窓を内容に合わせて引き締め、残存する旧アイコンを点陣SVGへ統一し、全5ゲームの暗色表示と多言語連動を修正しました。",
    "content_markdown": "今回の更新では4つの仕上げを行いました。概要・ツール・ゲームの各ウィンドウを内容量に応じたサイズへ収縮して余白を解消し、動画読込アイコン・折りたたみ矢印・チャット操作系・全ウィンドウ閉じるボタン・記事内アイコン・モバイルDock・ウェルカム分類アイコンを統一された点陣SVGへ刷新しました。さらに A Dark Room の白グラデーションや 2048・Hextris のスコア視認性不具合を修正し、ゲーム内ページのサイト言語連動と日本語表記も整えています。"
  }
}, "2026-11-22T11:12:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-welcome-dot-polish', '2026-11-22-pond-welcome-dot-polish', 'site-updates', '["视觉升级","欢迎窗"]', '', 'published', 0, 0, '2026-11-22T10:58:00+08:00', '2026-11-22T10:58:00+08:00', '2026-11-22T10:58:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-welcome-dot-polish", {
  "zh": {
    "title": "欢迎窗摘要完整显示与全窗点阵图标统一提亮",
    "summary": "放开最近更新摘要换行完整显示不截断，提亮分类点阵图标，并将站长状态与快捷入口图标统一替换为月夜池塘点阵风。",
    "content_markdown": "本次针对欢迎窗完成最终视觉统一：一是取消最近更新第二行摘要的单行截断，改为自然换行完整展示，不再出现半句省略号；二是放大并提亮六类更新分类点阵图标的线条粗细与青白发光对比度；三是将站长状态栏原有的蓝色方块笑脸和快捷入口四个彩色像素图标全部替换为全站统一的发光点阵 CRT 图标，问候语、站长状态与快捷入口文案及跳转功能均保持原样不动。"
  },
  "en": {
    "title": "Welcome Modal Full Wrapped Summaries and Unified Dot-Matrix Icons",
    "summary": "Allowed update summaries to wrap completely without truncation, brightened category dot-matrix icons, and unified status and quick-link icons to dot-matrix CRT style.",
    "content_markdown": "This release completes the Welcome modal visual unification: removing single-line ellipsis truncation on update summaries so every sentence displays in full, enlarging and brightening all six category dot-matrix icons for crisp contrast, and replacing the legacy blue smiley monitor and colorful quick-entry icons with matching Midnight Pond glowing dot-matrix SVG icons while keeping all greetings, status copy, and navigation links untouched."
  },
  "ja": {
    "title": "ウェルカムウィンドウの要約全文表示と点陣アイコン統一・高輝度化",
    "summary": "最近更新の要約を折り返し全文表示に変更し、カテゴリアイコンを高輝度化するとともに状態・クイック入口アイコンも点陣風へ統一しました。",
    "content_markdown": "今回の更新ではウェルカムウィンドウの視覚表現を統一しました。最近更新の2行目要約から1行省略を解除して全文を自然に折り返し表示し、6種類のカテゴリ点陣アイコンを拡大・高輝度化しています。さらにサイト状態の青いモニターやクイック入口4つのカラーアイコンもサイト共通の発光点陣 CRT アイコンへ置き換え、挨拶・状態文・各リンク機能はそのまま維持しています。"
  }
}, "2026-11-22T10:58:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-welcome-icons-summary-tz', '2026-11-22-pond-welcome-icons-summary-tz', 'site-updates', '["视觉升级","欢迎窗"]', '', 'published', 0, 0, '2026-11-22T10:48:00+08:00', '2026-11-22T10:48:00+08:00', '2026-11-22T10:48:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-welcome-icons-summary-tz", {
  "zh": {
    "title": "欢迎窗补齐分类点阵图标、第二行摘要并修正四条更新时区",
    "summary": "修复四条更新记录误写为 UTC 零时区导致的未来时间偏差，为最近更新按分类匹配首页同款点阵图标并补齐第二行一句话摘要。",
    "content_markdown": "本次针对欢迎窗实机复验提出的三项细节完成修正：一是排查并修正 r17 至 r20 四条更新记录误用 Z 零时区导致的 +8 小时未来时间偏差（同步补齐 D1 幂等更新时间语句，确保线上数据库立即恢复为真实东八区发布时间）；二是按更新所属分类与标签在最近更新列表中复用首页同款发光点阵图标（知识库、视频、工具、游戏、聊天室、系统）；三是把每条更新自带的一句话摘要补齐为第二行展示，呈现与 v2 效果图一致的双行条目节奏。"
  },
  "en": {
    "title": "Welcome Modal Category Dot-Matrix Icons, 2nd-Line Summaries, and Timezone Fix",
    "summary": "Fixed the +8h UTC offset typo on r17-r20 update timestamps, added homepage-style dot-matrix category icons, and displayed each update's one-line summary.",
    "content_markdown": "This release resolves three Welcome modal polish items: fixing the accidental UTC Z suffix on four update records (r17 through r20) with idempotent D1 timestamp repair statements so all published times reflect true UTC+8 timestamps; matching each recent update item to its corresponding homepage-style glowing dot-matrix category icon (knowledge, videos, tools, games, chatroom, system); and rendering each update's summary as a clean second line beneath the title to match the v2 layout."
  },
  "ja": {
    "title": "ウェルカムウィンドウのカテゴリ点陣アイコン・2行目要約追加と時刻修正",
    "summary": "更新4件のUTC指定ミスによる未来時刻を修正し、ホーム共通の点陣カテゴリアイコンと1行要約の2行目表示を追加しました。",
    "content_markdown": "今回の更新ではウェルカムウィンドウの3点を修正しました。まず r17〜r20 の更新4件で UTC 表記が混入していたタイムスタンプを正しい +08:00 へ修正し、D1 側の既存レコードも冪等更新で即時修復しました。次に最近更新の各項目へホーム画面と同じ発光点陣カテゴリアイコンを割り当て、さらに各更新の一言要約をタイトル下の2行目として表示するように整えています。"
  }
}, "2026-11-22T10:48:00+08:00"),
    env.DB.prepare("update articles set created_at = '2026-11-22T10:35:00+08:00', updated_at = '2026-11-22T10:35:00+08:00', published_at = '2026-11-22T10:35:00+08:00' where article_id = 'seed-update-2026-11-22-pond-welcome-v2-singlecol'"),
    env.DB.prepare("update articles set created_at = '2026-11-22T05:32:00+08:00', updated_at = '2026-11-22T05:32:00+08:00', published_at = '2026-11-22T05:32:00+08:00' where article_id = 'seed-update-2026-11-22-pond-kittens-id-match'"),
    env.DB.prepare("update articles set created_at = '2026-11-22T05:27:00+08:00', updated_at = '2026-11-22T05:27:00+08:00', published_at = '2026-11-22T05:27:00+08:00' where article_id = 'seed-update-2026-11-22-pond-kittens-svg-mask-fix'"),
    env.DB.prepare("update articles set created_at = '2026-11-22T05:22:00+08:00', updated_at = '2026-11-22T05:22:00+08:00', published_at = '2026-11-22T05:22:00+08:00' where article_id = 'seed-update-2026-11-22-pond-kittens-icons-clean'"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-welcome-v2-singlecol', '2026-11-22-pond-welcome-v2-singlecol', 'site-updates', '["视觉升级","欢迎窗","知识库"]', '', 'published', 0, 0, '2026-11-22T10:35:00+08:00', '2026-11-22T10:35:00+08:00', '2026-11-22T10:35:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-welcome-v2-singlecol", {
  "zh": {
    "title": "欢迎窗回归窄窗单列五条更新版式与知识库分页对齐",
    "summary": "按 v2 效果图将欢迎窗改为居中窄窗单列排布并直接展示 5 条最近更新，同时确认知识库双列卡片置顶标记与加载更多全宽对齐。",
    "content_markdown": "本次按站长确认的 v2 效果图对欢迎窗进行版式返工：将此前宽窗双栏结构改回居中窄窗单列排布，依次呈现问候语、站长状态栏、四项单行快捷入口胶囊以及直接展示 5 条最新更新的列表行，去除冗余的查看更多更新按钮，保留全部交互跳转与 Esc 关闭提示。同时对定版的知识库双列卡片视图补齐分页栏跨双列居中对齐，并复核置顶文章标记与加载更多分页功能均按现站原样正常工作。"
  },
  "en": {
    "title": "Welcome Modal Narrow Single-Column 5-Update Layout and Knowledge Pagination Alignment",
    "summary": "Reworked the Welcome modal into the v2 narrow single-column layout showing 5 recent updates directly, and aligned Knowledge Base Load More across both columns.",
    "content_markdown": "This release reworks the Welcome modal to match the approved v2 design: replacing the wide two-column layout with a centered narrow single-column glass card stacking the greeting, site owner status strip, four quick-entry pills, and five recent updates directly without a redundant View More button. We also aligned the Knowledge Base Load More footer across both columns of the finalized two-column card grid while verifying pinned badges and pagination continue working identically."
  },
  "ja": {
    "title": "ウェルカムウィンドウを細幅1列・更新5件直表示へ刷新し知識ベースページ送りを整列",
    "summary": "v2 デザイン案どおりにウェルカムウィンドウを中央の細幅1列構成・最新更新5件直表示へ戻し、知識ベースのさらに読み込むバーを2列横断で整列しました。",
    "content_markdown": "今回の更新では承認済みの v2 デザイン案に合わせ、ウェルカムウィンドウを幅広2カラムから中央配置の細幅1列グラスカードへ刷新しました。挨拶、サイト状態、4つのクイック入口ピル、そして最新更新5件をそのまま縦に並べ、余分なさらに見るボタンを省きつつ全機能を維持しています。あわせて確定した知識ベース2列カード表示のさらに読み込むバーを2列幅で中央揃えにし、固定表示バッジとページ送り動作も確認しました。"
  }
}, "2026-11-22T10:35:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-kittens-id-match', '2026-11-22-pond-kittens-id-match', 'site-updates', '["视觉升级","游戏区","猫国建设者"]', '', 'published', 0, 0, '2026-11-22T05:32:00+08:00', '2026-11-22T05:32:00+08:00', '2026-11-22T05:32:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-kittens-id-match", {
  "zh": {
    "title": "猫国建设者内页暗色主题规则生效修复",
    "summary": "修正游戏内页暗色主题注入器按 game.id 匹配猫国建设者，彻底隐藏营火行左右问号残影并提亮齿轮图标与资源栏。",
    "content_markdown": "本次修复游戏内页外壳脚本中猫国建设者专属暗色样式未命中的根因：目录配置字段为 id 而非 slug，导致此前专属暗色规则集未注入。修正为优先读取 targetGame.id 后，猫国建设者专属的月夜池塘暗色样式、左侧资源栏高对比文字、浅青色齿轮与折叠箭头遮罩图标、以及营火标签行左右两侧问号图标与外框的彻底隐藏全部立即生效。全站游戏逻辑、云端存档与 AI 接管功能均保持原样，并已准备完成线上实拍终验。"
  },
  "en": {
    "title": "Kittens Game Inner Dark Theme Rule Activation Fix",
    "summary": "Fixed the game shell dark-theme injector to match catalog game.id so Kittens Game dark styles, cyan gear icons, and question-mark cleanup take effect.",
    "content_markdown": "This release fixes the root cause preventing Kittens Game specific dark-theme rules from activating inside the game iframe: catalog entries expose id rather than slug. Reading targetGame.id first now activates the full Midnight Pond Kittens Game styling, crisp resource column contrast, cyan CSS-masked gear and chevron icons, and complete removal of the faint question-mark remnants flanking the Bonfire tab row. All game logic, cloud save APIs, and AI controls remain untouched."
  },
  "ja": {
    "title": "Kittens Game 内ページダークテーマ適用条件の修正",
    "summary": "ゲームシェルのダークテーマ判定を game.id 優先へ修正し、焚き火行左右の疑問符残影除去と歯車アイコン明色化を確実に適用しました。",
    "content_markdown": "今回の更新では、ゲームシェルの暗色テーマ注入処理で Kittens Game 専用スタイルが適用されていなかった原因（カタログの識別子フィールドが slug ではなく id であった点）を修正しました。targetGame.id を優先参照することで、月夜池ダークテーマの資源欄コントラスト、シアン色の歯車・矢印マスクアイコン、および焚き火タブ行左右の疑問符アイコンと枠の非表示が確実に有効化されます。ゲーム本体ロジックやクラウドセーブ、AI 制御には影響ありません。"
  }
}, "2026-11-22T05:32:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-kittens-svg-mask-fix', '2026-11-22-pond-kittens-svg-mask-fix', 'site-updates', '["视觉升级","游戏区","猫国建设者"]', '', 'published', 0, 0, '2026-11-22T05:27:00+08:00', '2026-11-22T05:27:00+08:00', '2026-11-22T05:27:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-kittens-svg-mask-fix", {
  "zh": {
    "title": "猫国建设者暗色主题遮罩图标着色修正",
    "summary": "修正猫国建设者资源栏齿轮与折叠箭头遮罩图标的暗色着色，并彻底清理营火行左右问号图标容器。",
    "content_markdown": "本次进一步修正猫国建设者游戏内页暗色主题中基于 CSS mask 遮罩渲染的小图标样式：将左侧资源栏设置齿轮与折叠箭头的遮罩底色由原版纯黑色调整为与月夜池塘主题一致的浅青色，使其在深色背景下清晰可辨；同时连同营火标签行左右两侧的暗色问号图标及其外层提示容器一并隐藏，彻底消除疑似截断的隐藏元素漏出残影。全站游戏本体逻辑、云端存档读写、登录态同步按钮与 AI 接管面板均保持原样未改动，并继续在线上生产环境复验。"
  },
  "en": {
    "title": "Kittens Game Dark Theme Masked Icon Color Fix",
    "summary": "Fixed CSS-masked gear and chevron icon colors in Kittens Game dark theme and removed question-mark tooltip icon wrappers cleanly.",
    "content_markdown": "This release refines CSS-masked icons inside the Kittens Game dark iframe theme by coloring the gear and collapse chevron masks in crisp Midnight Pond cyan instead of black, while hiding both the question-mark icons and their surrounding tooltip wrappers beside the Bonfire tab row. All game mechanics, cloud saves, signed-in Sync Now controls, and AI control panels remain completely untouched and verified live."
  },
  "ja": {
    "title": "Kittens Game ダークテーマのマスクアイコン着色修正",
    "summary": "Kittens Game 資源欄の歯車・矢印マスクアイコンを明色化し、焚き火行左右の疑問符アイコン枠も完全に整理しました。",
    "content_markdown": "今回の更新では Kittens Game のゲーム内ページに適用している純粋な CSS 月夜池ダークテーマのマスク描画アイコンを調整しました。左側資源欄の歯車アイコンおよび折りたたみ矢印のマスク背景色を従来の黒色から暗色背景でも見やすいシアン系へ変更し、あわせて焚き火タブ行の左右に薄く残っていた疑問符アイコンと外側のツールチップ枠を完全に非表示にしています。ゲーム本体のロジック、クラウドセーブ同期、ログイン時ボタン表示、AI 制御機能は一切変更していません。"
  }
}, "2026-11-22T05:27:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-kittens-icons-clean', '2026-11-22-pond-kittens-icons-clean', 'site-updates', '["视觉升级","游戏区","猫国建设者","云存档"]', '', 'published', 0, 0, '2026-11-22T05:22:00+08:00', '2026-11-22T05:22:00+08:00', '2026-11-22T05:22:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-kittens-icons-clean", {
  "zh": {
    "title": "猫国建设者暗色主题图标与云存档视觉收尾",
    "summary": "清理猫国建设者营火行左右两侧暗色问号残影并提亮齿轮图标，同时完成登录态云存档实拍验收。",
    "content_markdown": "本次更新针对猫国建设者游戏内页注入的纯 CSS 月夜池塘暗色主题做了细节收尾：一是隐藏营火标签行左右两侧因深底叠加而显现的暗色问号图标残影，避免视觉上出现疑似截断的隐藏元素漏出；二是将左侧资源栏顶部的设置齿轮以及折叠箭头图标做反色提亮处理，使其在暗色背景下保持清晰可辨。同时已在线上生产环境使用登录态账号展开顶部存档工具栏，确认云端存档卡片中的立即同步按钮、退出按钮、云端同步正常状态以及自动同步时间均正常显示。全站游戏本体逻辑、云存档接口、AI 接管逻辑与知识库数据均保持原样未作修改。"
  },
  "en": {
    "title": "Kittens Game Dark Theme Icon Cleanup and Signed-In Cloud Sync Check",
    "summary": "Cleared faint dark question-mark icon remnants beside the Bonfire tab row and brightened the resource gear icon while verifying signed-in cloud sync UI.",
    "content_markdown": "This release refines the pure-CSS Midnight Pond dark theme injected into the Kittens Game iframe by hiding the faint dark question-mark icon remnants flanking the Bonfire tab row and inverting the resource settings gear and collapse chevron icons for crisp contrast against the dark background. We also verified the signed-in expanded toolbar live on production, confirming that the Sync Now button, Log out button, healthy sync status, and automatic sync timestamp all render cleanly. All game mechanics, cloud save APIs, AI control logic, and knowledge base data remain untouched."
  },
  "ja": {
    "title": "Kittens Game ダークテーマのアイコン残影整理とクラウド同期確認",
    "summary": "焚き火タブ行左右の暗い疑問符アイコン残影を除去し歯車アイコンの視認性を向上させ、ログイン時クラウド同期表示も確認しました。",
    "content_markdown": "今回の更新では Kittens Game の iframe 内に適用している純粋な CSS 月夜池ダークテーマを細部まで調整し、焚き火タブ行の左右に薄く残っていた暗い疑問符アイコン残影を非表示にするとともに、左側資源欄の歯車アイコンや折りたたみ矢印を反転して暗色背景でもはっきり視認できるようにしました。さらに本番環境でログイン状態のツールバー展開表示を確認し、今すぐ同期ボタン、ログアウトボタン、自動同期ステータスが正常に動作することを検証しています。ゲーム本体ロジックやクラウドセーブ API、AI 制御、知識ベースデータには一切変更を加えていません。"
  }
}, "2026-11-22T05:22:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-kittens-res-contrast', '2026-11-22-pond-kittens-res-contrast', 'site-updates', '["site-update","games","ui"]', '', 'published', 0, 0, '2026-11-22T05:10:00+08:00', '2026-11-22T05:10:00+08:00', '2026-11-22T05:10:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-kittens-res-contrast", {
  "zh": {
    "summary": "为猫国建设者纯 CSS 暗色主题中的左栏资源表、资源名、数值、上限及顶部齿轮与问号图标全面提亮青白高对比度，确保暗底上清晰可读。",
    "title": "提亮猫国建设者暗色主题左栏资源数值与齿轮问号图标对比度",
    "content_markdown": "本次微调提升了猫国建设者暗色内页左侧资源栏的可读性：\n\n1. 为 #leftColumn、资源表 .res-table、资源名、当前数值与上限文字统一设置高对比青白色（#e8fbf7），并将顶部齿轮与问号帮助图标提亮至亮青色（#9af8ec）。\n2. 保持顶部存档与 AI 工具栏默认收起、一键展开功能完整，所有游戏逻辑与存档保持原样。"
  },
  "en": {
    "summary": "Brightened resource names, counts, caps, and the gear/help icons in the Kittens Game dark inner theme for crisp legibility on dark glass.",
    "title": "Boosted Contrast for Kittens Game Dark Resource Column & Header Icons",
    "content_markdown": "This quick polish improves legibility in the Kittens Game dark inner stylesheet:\n\n1. Enforced high-contrast cyan-white text (#e8fbf7) across #leftColumn and .res-table cells, and brightened the top gear and help icons to #9af8ec.\n2. Preserved the default-collapsed save/AI toolbar and one-click expand behavior."
  },
  "ja": {
    "summary": "猫国建設者の暗色テーマにおいて、左欄リソース名・数値・上限および上部歯車／ヘルプアイコンを明るい青白へ引き上げ、暗色背景での可読性を高めました。",
    "title": "猫国建設者暗色テーマ左欄リソース数値・歯車アイコンの視認性向上",
    "content_markdown": "猫国建設者の暗色内ページにおける左欄の視認性を改善しました：\n\n1. #leftColumn および .res-table のリソース名・数値・上限文字を高コントラストな青白（#e8fbf7）にし、歯車・ヘルプアイコンを #9af8ec へ引き上げました。\n2. 上部セーブ／AI ツール欄の初期折りたたみとワンクリック展開機能はそのまま維持しています。"
  }
}, "2026-11-22T05:10:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-game-inner-dark', '2026-11-22-pond-game-inner-dark', 'site-updates', '["site-update","games","ui"]', '', 'published', 0, 0, '2026-11-22T05:00:00+08:00', '2026-11-22T05:00:00+08:00', '2026-11-22T05:00:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-game-inner-dark", {
  "zh": {
    "summary": "为猫国建设者等五款游戏内页默认收起顶部存档与接管工具栏（保留一键展开入口），并在同源游戏框架加载时注入深夜池塘纯 CSS 暗色样式，零改动任何游戏逻辑与存档。",
    "title": "游戏内页本体纯 CSS 暗色适配并默认收起顶部工具栏释放画面空间",
    "content_markdown": "本次更新完成了五个游戏内页本体与空间的最终适配：\n\n1. 将游戏外框顶部工具栏改为默认收起状态，保留顶部一行展开入口按钮，将近 90% 的视口高度让给游戏本体，点击即可随时展开本地存档、云端存档、协议与 AI 游戏接管面板。\n2. 在同源游戏框架加载完成后注入纯 CSS 暗色样式，将猫国建设者等游戏本体白底无缝切换为深夜池塘暗青玻璃风格，不改动任何游戏脚本、存档键名或接管逻辑。"
  },
  "en": {
    "summary": "Collapsed the game shell top toolbar by default (with one-click expand) to maximize gameplay height and injected a pure-CSS Midnight Pond dark theme into same-origin game frames without touching game logic.",
    "title": "Pure-CSS Dark Theme for Game Inner Frames & Default-Collapsed Top Toolbar",
    "content_markdown": "This release completes the inner-frame visual integration across all five games:\n\n1. Defaulted the game tools/saves/AI-takeover panel to collapsed so games occupy ~90% of the viewport, while keeping a single-click expand button right at the top.\n2. Injected a pure-CSS dark Midnight Pond stylesheet into same-origin game iframes (including Kittens Game) on load, leaving all game logic, saves, and agent controls completely untouched."
  },
  "ja": {
    "summary": "5 つのゲーム内ページで上部セーブ／AI 操作欄を初期折りたたみにしてゲーム画面を大幅に広げ、同オリジン iframe 読み込み時に純 CSS の深夜の池暗色テーマを注入しました。",
    "title": "ゲーム本体 iframe の純 CSS 暗色適応と上部ツール欄の初期折りたたみ",
    "content_markdown": "5 つのゲーム内ページについて、画面比率とゲーム本体の配色統一を完了しました：\n\n1. 上部のローカル／クラウドセーブ・ライセンス・AI 操作パネルを初期状態で折りたたみ、ワンクリック展開ボタンのみを残すことで、ゲーム本体の表示領域を約 90% まで広げました。\n2. 猫国建設者を含む同オリジンゲーム本体へ読み込み時に純 CSS の暗色テーマを適用し、ゲームロジックやセーブ機能には一切手を加えていません。"
  }
}, "2026-11-22T05:00:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-icons-digits-fit', '2026-11-22-pond-icons-digits-fit', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:50:00+08:00', '2026-11-22T04:50:00+08:00', '2026-11-22T04:50:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-icons-digits-fit", {
  "zh": {
    "summary": "将工具卡三枚点阵 SVG 图标加粗放大并增强辉光、为分类计数切换无斜杠无衬线数字以清晰区分 0 与 8，并增加游戏内页顶栏右边距。",
    "title": "放大提亮工具区点阵图标、优化分类计数字形与游戏页顶栏边距",
    "content_markdown": "本次更新完成了最后一轮精细视觉打磨：\n\n1. 工具区三张卡片的调色盘、临时互传与鸟居点阵 SVG 图标描边加粗至 3.6 并放大至 104×78px，配合高亮度青白辉光，在深色玻璃窗上清晰醒目。\n2. 知识库与各窗口分类计数改为清晰的无衬线等宽数字（无斜杠零），避免 106 在小字号下被误看成 186；同时提亮聊天室 6 枚点阵圆头像辉光并放宽游戏内页顶栏右边距。"
  },
  "en": {
    "summary": "Thickened and enlarged the three dotted tool SVG icons with brighter glow, switched filter counts to clean open-zero sans-serif numerals, and added right padding to the game topbar.",
    "title": "Larger Brighter Tool Dotted Icons, Open-Zero Filter Digits & Game Topbar Padding",
    "content_markdown": "This final detail polish refines legibility across Tools, Knowledge, Chatroom, and Games:\n\n1. Thickened the palette, transfer, and torii SVG strokes to 3.6 and enlarged tool hero icons to 104x78px with stronger cyan glow.\n2. Switched category count numerals to open-zero sans-serif so 106 is never misread as 186, brightened chatroom dot-matrix avatars, and widened right padding on the game shell topbar."
  },
  "ja": {
    "summary": "ツールカードのパレット・転送・鳥居点陣アイコンを太線拡大して発光を強化し、分類件数に斜線なしの明瞭な数字を適用、ゲーム内ページ上端の右余白を広げました。",
    "title": "ツール点陣アイコン拡大明度向上・件数数字視認性改善・ゲーム上端余白調整",
    "content_markdown": "細部の視認性をさらに引き上げる最終調整を実施しました：\n\n1. ツール区 3 カードの点陣 SVG アイコンの線幅を 3.6 に太め、表示サイズを 104×78px へ拡大して青白グローを強化しました。\n2. 分類件数の数字を斜線ゼロのないサンセリフ体へ変更して 106 が 186 に見間違えないようにし、チャット点陣アバターの輝度向上およびゲーム内ページ上部バーの右余白調整を行いました。"
  }
}, "2026-11-22T04:50:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos-explicit-h', '2026-11-22-pond-videos-explicit-h', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:36:00+08:00', '2026-11-22T04:36:00+08:00', '2026-11-22T04:36:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos-explicit-h", {
  "zh": {
    "summary": "为 3 列视频卡片指定 174px 显式 16:9 封面高度与 320px 最小卡片高度，彻底解决 Chromium 网格自动行高下 aspect-ratio 折叠为 0 引发的封面重叠问题。",
    "title": "明确视频区 3 列封面 174px 显式高度以根治行间叠压",
    "content_markdown": "本次更新彻底解决了视频区 3 列网格中行间重叠的浏览器排版特性：\n\n1. 在 3 列布局（单列约 308px）下，为视频缩略图指定与 16:9 精确对应的 174px 显式高度及 flex-basis，同时为卡片设定 320px 最小高度，确保每行卡片完整撑开，封面文字零裁切且标题、简介与底部播放按钮清晰呈现。\n2. 保持全站其余窗口居中尺寸、暗色点阵加载态、登录浮层正居中及全部游戏与工具内页视觉一致性。"
  },
  "en": {
    "summary": "Set explicit 174px 16:9 thumbnail height and 320px minimum card height in the 3-column Videos grid so Chromium never collapses auto-sized rows.",
    "title": "Explicit 174px 16:9 Thumbnail Height to Eliminate 3-Column Video Row Overlap",
    "content_markdown": "This fix resolves a Chromium flex-inside-grid intrinsic sizing issue on Videos:\n\n1. Assigned an explicit 174px height and flex-basis (exact 16:9 for 308px columns) to video thumbnails and a 320px minimum card height so every row expands cleanly with uncropped thumbnails, bright titles, and aligned Play buttons.\n2. Preserved all other Midnight Pond window geometries, dark loading states, and inner page themes."
  },
  "ja": {
    "summary": "3 列動画グリッドのサムネイルに 16:9 対応の 174px 明示高さとカード最小高さ 320px を指定し、Chromium の自動行高計算による縦重なりを完全に解消しました。",
    "title": "動画区 3 列サムネイルの 174px 明示高さ指定で縦重なりを解消",
    "content_markdown": "動画区 3 列レイアウトで発生していた Chromium の行高折りたたみ問題を修正しました：\n\n1. 列幅 308px に対する厳密な 16:9 となる 174px をサムネイルの高さおよび flex-basis に明示指定し、カード最小高さを 320px とすることで、表紙文字の切り抜きゼロかつタイトル・概要・下部再生ボタンが重ならず整然と表示されます。\n2. 他の全ウィンドウ中央配置や暗色ロード表示・ログイン窓・ゲーム内ページの統一デザインもそのまま維持しています。"
  }
}, "2026-11-22T04:36:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos-row-height', '2026-11-22-pond-videos-row-height', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:32:00+08:00', '2026-11-22T04:32:00+08:00', '2026-11-22T04:32:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos-row-height", {
  "zh": {
    "summary": "将 3 列视频网格中视频卡片高度由 100% 改为 auto，彻底消除行间重叠，完整呈现 16:9 无裁切封面、标题、简介与齐平播放按钮。",
    "title": "修复视频区 3 列卡片高度塌陷重叠问题",
    "content_markdown": "本次微调修复了视频区 3 列网格在自动行高下子项设置 100% 高度导致的纵向行重叠问题：\n\n1. 将视频卡片高度恢复为自动自适应，同时保留行内等高对齐与底部播放按钮自动贴底，确保每张视频卡片的 16:9 完整封面、高亮标题、简介、作者日期及底部播放按钮清晰分离、绝不重叠。\n2. 同步保留桌面与移动端全窗口统一居中尺寸、暗色点阵加载态、登录浮层正居中及全部游戏与工具内页的深夜池塘视觉风格。"
  },
  "en": {
    "summary": "Changed video card height from 100% to auto inside the auto-sized 3-column grid so 16:9 thumbnails, titles, descriptions, and aligned Play buttons never overlap vertically.",
    "title": "Fixed 3-Column Video Card Row Collapse in CSS Grid",
    "content_markdown": "This one-line layout fix resolves the CSS Grid row collapse on Videos:\n\n1. Switched video cards to natural auto height while retaining stretch alignment, ensuring every card's uncropped 16:9 thumbnail, title, summary, and bottom Play button render cleanly without vertical overlap.\n2. Preserved all unified Midnight Pond window dimensions, dark CRT loading states, and inner tool/game page styling."
  },
  "ja": {
    "summary": "CSS Grid の自動行高における動画カードの height を 100% から auto へ修正し、16:9 表紙・タイトル・概要・再生ボタンの縦重なりを完全に解消しました。",
    "title": "動画区 3 列カードの縦重なりを修正",
    "content_markdown": "動画区 3 列グリッドの行高計算と表示崩れを修正しました：\n\n1. 動画カードの高さを自動調整へ戻し、行内の高さ揃えと下部再生ボタンの配置を維持することで、16:9 の無裁切サムネイル・高コントラストなタイトル・概要・作者日時・下部再生ボタンが重ならず整然と表示されるようにしました。\n2. 全ウィンドウの中央配置統一・暗色 CRT ロード表示・ログイン窓の中央表示およびツール・ゲーム内ページの深夜の池スタイルもあわせて維持しています。"
  }
}, "2026-11-22T04:32:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos-16x9', '2026-11-22-pond-videos-16x9', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:23:00+08:00', '2026-11-22T04:23:00+08:00', '2026-11-22T04:23:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos-16x9", {
  "zh": {
    "summary": "将视频区恢复为 3 列网格并保持标准 16:9 封面比例，消除 2 列高封面挤出文字区的问题，实现封面无裁切且标题、简介与播放按钮完整对齐。",
    "title": "恢复视频区 3 列标准 16:9 封面排布并确保标题与播放按钮完整呈现",
    "content_markdown": "本次更新针对视频区实测结果完成最终排布校正：\n\n1. 将视频列表恢复为 3 列网格（每张封面自然呈 16:9 比例，约 308×173px），16:9 的 Bilibili 与 YouTube 封面满框显示不裁字也不留黑边。\n2. 放开 .video-card 与 .video-body 的 overflow: visible 与自适应高度，确保标题、简介、作者时间与底部「播放」按钮全部清晰完整且每行齐平。"
  },
  "en": {
    "summary": "Switched Videos back to a 3-column grid with true 16:9 thumbnails and unclipped card bodies so covers, titles, descriptions, and Play buttons all render cleanly.",
    "title": "Restored 3-Column True 16:9 Video Grid with Unclipped Titles & Aligned Play Buttons",
    "content_markdown": "This quick layout correction resolves the Videos card overflow seen in live verification:\n\n1. Restored the 3-column grid so 16:9 thumbnails render at natural proportions without cropping cover text.\n2. Set .video-card and .video-body to natural unclipped height with aligned bottom Play buttons."
  },
  "ja": {
    "summary": "動画区を 3 列グリッドの標準 16:9 サムネイルへ戻し、カードの切り抜きを解除して表紙・タイトル・概要・再生ボタンをすべて見切れなく整列させました。",
    "title": "動画区 3 列 16:9 レイアウト復元・タイトルと再生ボタン完全表示",
    "content_markdown": "動画区の実機確認に基づき、レイアウトを最終調整しました：\n\n1. 3 列グリッド＋標準 16:9 比率に戻すことで、Bilibili・YouTube サムネイルが文字切れや余白なしで自然に収まるようにしました。\n2. .video-card と .video-body の高さ制約を解除し、タイトル・概要・下部再生ボタンを全カード揃えて表示します。"
  }
}, "2026-11-22T04:23:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-final-finish', '2026-11-22-pond-final-finish', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:15:00+08:00', '2026-11-22T04:15:00+08:00', '2026-11-22T04:15:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-final-finish", {
  "zh": {
    "summary": "恢复视频 16:9 完整封面比例消除裁切、消除聊天室右上房间标签叠字、提亮猫国封面并升级 Hextris 霓虹六边形封面、优化知识库 3 排显示与手机端 Dock 底部留白。",
    "title": "深夜池塘最终细节收尾：视频 16:9 完整封面、聊天室防叠字、游戏封面与手机端留白",
    "content_markdown": "本次收尾完成了最后一轮线上实拍图逐项细化：\n\n1. 视频区：将缩略图容器恢复为完整 16:9 比例并采用 object-fit: contain，封面文字与人像零裁切。\n2. 聊天室：修复右上「普通房间」胶囊与「每 5 秒自动刷新」文案叠字，并加宽顶沿渐隐遮罩消除残影轮廓。\n3. 游戏区：提亮猫国建设者等暗色封面使猫咪轮廓清晰可见，升级 Hextris 封面为六色霓虹六边形点阵，收紧语言胶囊间距防止断行。\n4. 知识库与手机端：微调桌面卡片内边距并加底部渐隐使 3 排文章完整落框；手机端列表底部增加 96px 内边距，避让悬浮 Dock。"
  },
  "en": {
    "summary": "Restored 16:9 uncropped video thumbnails, fixed the chatroom room-label overlap, brightened Kittens Game cover and upgraded Hextris art, and refined Knowledge & mobile Dock bottom spacing.",
    "title": "Midnight Pond Final Visual Finish: 16:9 Uncropped Video Covers, Chatroom Spacing, Bright Game Art & Mobile Dock Clearance",
    "content_markdown": "This final visual polish pass resolves the last fine details from live review:\n\n1. Videos: restored natural 16:9 thumbnail aspect ratio with object-fit: contain so cover text and portraits are never cropped.\n2. Chatroom: eliminated overlap between #chat-room-label and #chat-sync-status and refined the top scroll fade.\n3. Games: brightened dark art covers (Kittens Game), upgraded the Hextris neon hexagon SVG cover, and tightened language tag spacing.\n4. Knowledge & Mobile: tuned 3-row card spacing with a soft bottom fade and added 96px bottom padding on mobile Knowledge for Dock clearance."
  },
  "ja": {
    "summary": "動画サムネイルを 16:9 比率へ戻して見切れを解消し、チャット右上の文字重なり修正、猫国表紙の明度向上と Hextris 表紙刷新、知識庫とモバイル Dock 下部余白を整えました。",
    "title": "深夜の池最終ディテール仕上げ：動画 16:9 表紙・チャット重なり解消・ゲーム表紙・モバイル余白",
    "content_markdown": "本番スクリーンショットの最終確認に基づき、残りの細部を仕上げました：\n\n1. 動画区：サムネイルを 16:9 比率＋object-fit: contain へ調整し、表紙の文字や人物の見切れを解消しました。\n2. チャット：右上の部屋ラベルと更新表示の重なりを修正し、上端フェードを整えました。\n3. ゲーム区：猫国建設者の表紙を明るく調整し、Hextris を多色ネオン六角形 SVG へ刷新、言語タグの間隔を整えました。\n4. 知識庫・モバイル：3行がすっきり収まる余白と下端フェードを加え、モバイル下部 Dock 用の 96px 余白を確保しました。"
  }
}, "2026-11-22T04:15:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-cascade-root', '2026-11-22-pond-cascade-root', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:01:00+08:00', '2026-11-22T04:01:00+08:00', '2026-11-22T04:01:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-cascade-root", {
  "zh": {
    "summary": "在桥接层监听 document.head 并将 pond-windows.css 固定维持为最后一个样式表，从根源解决 main.js 懒加载 routes/*.css 与 transfer.css 覆盖新视觉层的问题，并直接删除视频封面中央播放覆盖层规则。",
    "title": "根治路由样式后插层叠顺序问题并彻底移除视频封面中央播放覆盖层",
    "content_markdown": "本次从架构根源解决了生产环境中懒加载路由样式反向覆盖新视觉层的问题：\n\n1. js/main.js 会在切换路由时向 document.head 尾部动态追加 /css/routes/knowledge.css、/css/routes/videos.css、/css/routes/games.css、/css/routes/chatroom.css 与 /css/transfer.css，导致其层叠顺序排在 pond-windows.css 之后。现于 pond-site-bridge.mjs 增加 MutationObserver，确保 pond-windows.css 始终稳居 <head> 最末位。\n2. 直接从 pond-windows.css 源头删除旧版 .video-thumb::after 封面中央播放框，不再靠二次覆盖压制，确保视频封面文字零遮挡且标题与简介高对比完整呈现。"
  },
  "en": {
    "summary": "Pinned pond-windows.css as the final stylesheet in document.head whenever main.js lazily injects route CSS or transfer.css, and deleted the source center video-thumb play overlay.",
    "title": "Root Fix for Lazy Route CSS Cascade Order & Removed Center Video Play Overlay",
    "content_markdown": "This release eliminates the root CSS cascade race between Midnight Pond and lazily injected route stylesheets:\n\n1. Added a document.head MutationObserver in pond-site-bridge.mjs that keeps pond-windows.css as the last stylesheet whenever main.js appends /css/routes/*.css or /css/transfer.css, guaranteeing deterministic visual precedence in production.\n2. Deleted the legacy .video-thumb::after center play overlay directly at its source so video thumbnails stay unobstructed."
  },
  "ja": {
    "summary": "main.js がルート専用 CSS や transfer.css を後から <head> 末尾へ追加しても pond-windows.css が常に最後尾に維持されるよう修正し、動画サムネイル中央の再生枠定義を元から削除しました。",
    "title": "遅延読み込みルート CSS のカスケード順を根本修正・動画中央再生枠を削除",
    "content_markdown": "本番環境で遅延読み込みされるルート CSS が新テーマを上書きする根本原因を解消しました：\n\n1. js/main.js が遷移時に /css/routes/*.css や /css/transfer.css を document.head 末尾へ挿入する際、pond-site-bridge.mjs の MutationObserver が pond-windows.css を常に最後尾へ維持することで、カスケード優先順を完全に保証します。\n2. 動画サムネイル中央に重なっていた .video-thumb::after を元定義から削除し、タイトル・概要の視認性と表紙文字の見やすさを確保しました。"
  }
}, "2026-11-22T04:01:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-eager-covers', '2026-11-22-pond-eager-covers', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:59:00+08:00', '2026-11-22T03:59:00+08:00', '2026-11-22T03:59:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-eager-covers", {
  "zh": {
    "summary": "在游戏区封面换装、工具区图标与关于页激活时强制切换图片为 eager 即时加载，彻底解决切换路由后封面与头像偶发黑框未解码的问题。",
    "title": "修复游戏区封面与关于页头像在窗口切换时懒加载停滞的问题",
    "content_markdown": "本次修复了线上实测中发现的图片懒加载停滞问题：\n\n1. 在游戏区应用 GPT 封面与 SVG 封面时，先移除 loading='lazy' 并设为 eager 同步解码，确保猫国建设者、小黑屋、人生重开模拟器等 5 张封面即时显示不留黑框。\n2. 工具区图标与关于页头像及社交图标同步改为立即加载，切换窗口后立即可见。"
  },
  "en": {
    "summary": "Forced eager loading on game covers, tool icons, and the About avatar when activating those windows so covers and avatars never stall as blank frames.",
    "title": "Fixed Lazy-Image Stall on Game Covers & About Avatar After Route Switch",
    "content_markdown": "This fix resolves a Chromium lazy-loading stall discovered during live verification:\n\n1. Removed loading='lazy' and enforced loading='eager' before applying game covers so Kittens Game, A Dark Room, Life Restart, 2048, and Hextris render immediately.\n2. Applied the same eager-load guard to tool icons and the About avatar/social icons on window activation."
  },
  "ja": {
    "summary": "ゲーム表紙・ツールアイコン・概要アバターのウィンドウ表示時に即時読み込み（eager）を強制し、黒い空枠のまま止まる現象を解消しました。",
    "title": "ゲーム表紙・概要アバターのルート切替時遅延読み込み停滞を修正",
    "content_markdown": "本番検証で見つかった画像遅延読み込みの停滞を修正しました：\n\n1. ゲーム表紙（猫国建設者・小黑屋・人生重開シミュレーター等）に loading='eager' を強制し、黒い空枠にならず即座に表示されるようにしました。\n2. ツールアイコンおよび概要ページのアバター画像も表示時に即時読み込みへ統一しました。"
  }
}, "2026-11-22T03:59:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-icons-close-sync', '2026-11-22-pond-icons-close-sync', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:54:00+08:00', '2026-11-22T03:54:00+08:00', '2026-11-22T03:54:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-icons-close-sync", {
  "zh": {
    "summary": "将登录浮层右上角关闭按钮统一为圆形虚线 × 控件、重绘知识库与文章标题栏翻书图标消除方块观感，并为聊天室滚动区增加顶沿渐隐过渡。",
    "title": "统一登录窗关闭按钮、优化知识库翻书图标与聊天室顶沿柔化",
    "content_markdown": "本次更新完成了复审提出的最后三处界面细节统一：\n\n1. 将登录浮层 .account-close-button 由旧红底实心方块改为与其他窗口一致的圆形虚线 × 按钮。\n2. 重绘知识库与文章页标题栏 .title-icon-knowledge 为清晰的翻开书本与点阵页纹 SVG，彻底消除小字号下的方块错觉。\n3. 为聊天室消息滚动区顶部增加 22px 柔和渐隐遮罩，滚动时顶沿消息自然过渡不生硬裁切。"
  },
  "en": {
    "summary": "Matched the login modal close button to the circular dashed x style, redrew the Knowledge/Article open-book title icon for crispness, and added a soft top-edge scroll fade to the Chatroom log.",
    "title": "Unified Login Close Button, Crisp Open-Book Title Icon & Chatroom Top Fade",
    "content_markdown": "This quick polish closes the final three visual details from review:\n\n1. Restyled .account-close-button in the login popover into the circular dashed x button used by all other windows.\n2. Redrew .title-icon-knowledge as a crisp open-book SVG with dotted page lines so it never looks like two empty squares.\n3. Added a soft 22px top-edge fade mask to .chatroom-log so scrolled-past messages dissolve cleanly."
  },
  "ja": {
    "summary": "ログイン窓右上の閉じるボタンを他窓と同じ点線丸 × へ統一し、知識庫と記事タイトルの本アイコンを鮮明な見開き SVG へ刷新、チャット上端に自然なフェードマスクを追加しました。",
    "title": "ログイン閉じるボタン統一・知識庫アイコン刷新・チャット上端フェード追加",
    "content_markdown": "最終レビューに基づく 3 点の細部調整を反映しました：\n\n1. ログイン窓の .account-close-button を赤い四角ボタンから他ウィンドウと共通の点線丸 × ボタンへ統一しました。\n2. 知識庫・記事タイトルの .title-icon-knowledge を鮮明な見開き本 SVG へ差し替えました。\n3. チャットログ上端に 22px のフェードマスクを加え、スクロール時の見切れを和らげました。"
  }
}, "2026-11-22T03:54:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-home-shell-clear', '2026-11-22-pond-home-shell-clear', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:42:00+08:00', '2026-11-22T03:42:00+08:00', '2026-11-22T03:42:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-home-shell-clear", {
  "zh": {
    "summary": "将首页 .site-shell 及其伪元素背景设为完全透明，确保首页 WebGL2 深夜池塘画布与登录浮层同时完整呈现，并同步将「显示密码」按钮统一为暗色点阵胶囊。",
    "title": "修复首页容器背景透明透出池塘画布并统一显示密码按钮",
    "content_markdown": "本次微调完成了首页池塘与登录浮层的最终融合：\n\n1. 将 html[data-pond-mode='home'] 下的 .site-shell、伪元素及 .page-home 背景全部设为透明，使 WebGL2 池塘桌面完整透出，同时登录窗稳居最顶层正中央。\n2. 将登录框内的「显示密码」按钮同步改为深色 CRT 点阵虚线胶囊样式，消除最后的浅色按钮残留。"
  },
  "en": {
    "summary": "Made .site-shell and its pseudo-elements transparent on Home so the WebGL2 pond canvas renders beneath the centered login modal, and styled the Show Password button in dark CRT glass.",
    "title": "Transparent Home Shell Pass-Through for Pond Canvas & Dark Password Toggle",
    "content_markdown": "This quick polish completes the Home pond and login overlay composition:\n\n1. Cleared .site-shell, its pseudo-elements, and .page-home backgrounds on Home so the live WebGL2 pond canvas shows cleanly behind the centered login popover.\n2. Styled the Show Password button inside the login popover as a matching dark CRT dotted pill."
  },
  "ja": {
    "summary": "ホーム画面の .site-shell と疑似要素の背景を完全透過にして WebGL2 の池キャンバスがログイン窓の背後にそのまま表示されるよう修正し、パスワード表示ボタンも暗色点陣スタイルへ統一しました。",
    "title": "ホーム画面の透過調整（池キャンバス表示維持）とパスワード表示ボタン暗色化",
    "content_markdown": "ホーム画面とログイン窓の重なり表示を最終仕上げしました：\n\n1. ホーム画面における .site-shell および疑似要素・.page-home の背景を透明化し、WebGL2 池キャンバスを隠さず中央のログイン窓を最前面に表示できるようにしました。\n2. ログイン窓内の「パスワードを表示」ボタンも暗色 CRT 点陣カプセルへ統一しました。"
  }
}, "2026-11-22T03:42:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-home-login-z', '2026-11-22-pond-home-login-z', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:38:00+08:00', '2026-11-22T03:38:00+08:00', '2026-11-22T03:38:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-home-login-z", {
  "zh": {
    "summary": "调整首页 .site-shell 与池塘背景画布的层级顺序，确保点击左下角 ID 后登录窗直接浮在首页最顶层，同时将登录框内标签页、密码框与底部提示盒统一为暗色 CRT 风格。",
    "title": "修复首页登录浮层被画布压住的问题并统一登录框暗色点阵控件",
    "content_markdown": "本次紧急修复彻底解决了首页点击左下角 ID 按钮后登录浮层不可见的问题：\n\n1. 将首页 #pond-visual-backdrop 层级置于 .site-shell（pointer-events: none）之下，使点击仍可直达池塘画布，而打开的 #account-popover 直接浮现在首页池塘最顶层正中央。\n2. 将登录框内的登录/注册切换条、密码输入框、显示密码按钮、关闭按钮及底部说明条全部统一为深夜池塘暗色玻璃与点阵虚线样式，彻底消除浅色残留。"
  },
  "en": {
    "summary": "Placed .site-shell above the Home pond canvas while preserving pointer passthrough so the login modal renders cleanly on top of Home, and themed the login tabs, password input, and footer note.",
    "title": "Fixed Home Login Popover Z-Index Stacking & Darkened Inner Login Controls",
    "content_markdown": "This targeted fix resolves the Home-route login popover stacking order:\n\n1. Lowered #pond-visual-backdrop below .site-shell (pointer-events: none) on Home so canvas clicks still pass through while #account-popover renders cleanly on top of the Home pond.\n2. Styled the login/register mode tabs, password field, close button, and footer note box in matching Midnight Pond CRT dark glass."
  },
  "ja": {
    "summary": "ホーム画面で池キャンバスがログイン窓を覆っていた重なり順を修正し、左下 ID クリック時に画面最前面中央へ確実に表示されるようにしました。タブ・パスワード欄・注記も暗色化しています。",
    "title": "ホーム画面ログイン窓の重なり順修正と内部コントロール暗色統一",
    "content_markdown": "ホーム画面で左下 ID ボタンからログイン窓を開いた際の重なり順を修正しました：\n\n1. ホーム画面の #pond-visual-backdrop を .site-shell（pointer-events: none）の下層へ配置し、池キャンバスの操作性を保ちつつ #account-popover が画面中央最前面に正しく描画されるようにしました。\n2. ログイン窓内部のタブ切替・パスワード入力欄・閉じるボタン・下部注記ボックスも深夜の池 CRT 暗色ガラスへ統一しました。"
  }
}, "2026-11-22T03:38:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-qa-sweep', '2026-11-22-pond-qa-sweep', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:31:00+08:00', '2026-11-22T03:31:00+08:00', '2026-11-22T03:31:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-qa-sweep", {
  "zh": {
    "summary": "按全站桌面端逐窗验收清单完成精修：视频高对比标题简介与去遮挡播放徽标、工具/游戏去空白、知识库同行等高齐平、聊天室单行顶栏、关于点阵标题图标、左下语言提亮与临时互传暗色换装。",
    "title": "深夜池塘全站桌面端细节精修：视频高对比文字、工具/游戏卡片紧致、聊天室与临时互传换装",
    "content_markdown": "本次更新针对线上桌面端全窗口逐项验收清单完成集中精修：\n\n1. 视频区：全面提亮卡片标题与简介对比度，移除遮挡封面的中央播放覆盖层，保持每行底部播放按钮齐平，并统一暗色点阵加载态。\n2. 工具与游戏区：取消卡片内容区被窗高拉开的空白空洞，恢复自然紧致排布与底部留白，优化游戏区语言胶囊间距避免拥挤。\n3. 知识库与文章页：同行文章卡片统一等高并对齐右侧点阵「阅读」按钮；放宽文章阅读进度字号与右侧边距，保证左侧目录底部提示完整不裁切并清除残留 emoji 图标。\n4. 聊天室、关于页与首页：聊天室顶栏改为单行不换行、修复首条消息顶沿裁切；关于页标题替换为点阵人像图标；首页左下角 ID 与中/EN/日切换文字显著提亮。\n5. 临时互传子面板（#transfer-app）：全量适配深夜池塘 CRT 深色玻璃风格与暗青加载条。"
  },
  "en": {
    "summary": "Resolved every desktop QA checklist item across Videos, Tools, Games, Knowledge, Article Reader, Chatroom, About, Home corner contrast, and the Quick Transfer sub-panel.",
    "title": "Midnight Pond Full Desktop QA Sweep: Bright Video Copy, Compact Tool/Game Cards, Chatroom & Quick Transfer Skin",
    "content_markdown": "This release closes the full desktop live-QA sweep across every window:\n\n1. Videos: enforced high-contrast cyan-white titles and descriptions, removed center thumbnail play overlays, aligned row Play buttons, and unified dark CRT loading states.\n2. Tools & Games: eliminated vertical stretching gaps inside cards, restored comfortable bottom padding, and prevented crowded language tags.\n3. Knowledge & Article Reader: equalized row card heights so Read buttons align across columns, enlarged reading progress labels, prevented TOC tip bottom clipping, and stripped legacy emoji prefixes.\n4. Chatroom, About & Home: kept the Chatroom header on one row and unclipped the first message, replaced the About title badge with a dotted CRT person icon, and boosted bottom-left ID/language contrast.\n5. Quick Transfer (#transfer-app): applied full Midnight Pond CRT dark glass styling."
  },
  "ja": {
    "summary": "デスクトップ全窓の実機チェック項目を一括修正：動画カード文字の高コントラスト化とサムネイル中央アイコン除去、ツール／ゲーム余白整理、知識庫行揃え、チャット単行ヘッダ、一時転送の暗色対応を完了しました。",
    "title": "深夜の池デスクトップ全窓品質総仕上げ：動画文字視認性・ツール／ゲーム配置・チャット・一時転送対応",
    "content_markdown": "本番デスクトップ全窓の総点検に基づき、以下の項目を一括で仕上げました：\n\n1. 動画区：カードタイトルと概要のコントラストを大幅に引き上げ、サムネイル中央の再生オーバーレイを非表示にして下部再生ボタンを揃えました。\n2. ツール・ゲーム区：カード内部の不自然な縦余白を解消し、タグの詰まりと下部余白を整えました。\n3. 知識庫・記事閲覧：同行カードの高さを統一して閲覧ボタン位置を揃え、進捗表示と目次下部の見切れおよび残存絵文字を整理しました。\n4. チャット・概要・ホーム：チャット上部を1行に収め先頭メッセージの見切れを解消、概要タイトルを点陣アイコン化し、左下 ID／言語表示のコントラストを高めました。\n5. 一時転送サブパネル（#transfer-app）も深夜の池 CRT 暗色ガラスへ統一しました。"
  }
}, "2026-11-22T03:31:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-final-fit', '2026-11-22-pond-final-fit', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:28:00+08:00', '2026-11-22T03:28:00+08:00', '2026-11-22T03:28:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-final-fit", {
  "zh": {
    "summary": "解除顶栏层叠上下文使登录浮层正居中于视口、恢复视频卡片标题与简介完整高度，并将知识库加载骨架条切换为柔和深青点阵色。",
    "title": "深夜池塘最终实测收尾：登录窗正居中、视频卡片完整展示与暗色骨架屏",
    "content_markdown": "基于线上真机实测结果完成最后三处细节收尾：\n\n1. 清除顶栏容器的滤镜与变换层叠上下文，确保点击左下角 ID 后登录浮层精确居中显示在屏幕正中央。\n2. 放开视频卡片自然高度并保留每行底部播放按钮齐平，确保标题与简介完整清晰不被压缩。\n3. 覆盖知识库骨架屏的多层浅色背景渐变，改为低对比度深青荧光骨架条。"
  },
  "en": {
    "summary": "Removed header containing-block traps so the login modal centers in the viewport, restored full video card title/description height, and switched Knowledge loading skeletons to soft dark cyan bars.",
    "title": "Midnight Pond Final Live-QA Polish: Viewport-Centered Login, Full Video Cards & Dark Skeletons",
    "content_markdown": "This final polish pass closes the last three live-QA visual details:\n\n1. Cleared ancestor backdrop/transform containing blocks on the hidden topbar so clicking bottom-left ID centers the login popover squarely in the viewport.\n2. Restored natural video card height while keeping row Play buttons aligned at the bottom.\n3. Replaced the multi-layer light Knowledge skeleton gradients with subtle dark-cyan CRT skeleton bars."
  },
  "ja": {
    "summary": "隠しヘッダーの包含ブロックを解除してログイン窓を画面中央へ配置し、動画カードのタイトルと概要の高さを復元、知識庫ロード時の白スケルトンを暗色シアンへ統一しました。",
    "title": "深夜の池最終実機調整：ログイン窓中央配置・動画カード全文表示・暗色スケルトン",
    "content_markdown": "本番環境の実機スクリーンショット検証に基づき、最後の 3 点を仕上げました：\n\n1. 非表示ヘッダー側のフィルタ・変換指定を解除し、左下 ID クリック時にログイン窓が画面中央へ正しく表示されるようにしました。\n2. 動画カードの自然な高さを確保し、タイトルと概要が潰れずに表示され、再生ボタンが各行下部で揃うようにしました。\n3. 知識庫読み込み中の白いスケルトン帯を、深緑背景になじむ低コントラストな暗色シアン帯へ置き換えました。"
  }
}, "2026-11-22T03:28:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-geometry-sync', '2026-11-22-pond-geometry-sync', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:22:00+08:00', '2026-11-22T03:22:00+08:00', '2026-11-22T03:22:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-geometry-sync", {
  "zh": {
    "summary": "将全部桌面窗口像素级对齐至文章阅读窗居中位置（避开顶部时钟）、扩大左下角 ID 按钮热区并彻底替换所有加载态深蓝字与旧图标。",
    "title": "深夜池塘全窗像素级对齐、左下角 ID 点击热区扩大与加载态图标统一",
    "content_markdown": "本次更新完成了线上实测后的最后一轮微调：\n\n1. 将知识库、文章阅读、视频、工具、游戏、聊天室、关于与欢迎窗统一至完全一致的居中宽高与顶距，切窗零跳位且不遮挡顶部时钟。\n2. 扩大左下角 ID（登录）与语言按钮在 CRT 曲面下的点击热区，点击更稳。\n3. 提高全站加载态文字与图标覆盖优先级，视频区等加载提示全部切换为高对比度青白字与点阵发光图标。"
  },
  "en": {
    "summary": "Aligned every desktop window to the exact Article Reader centered frame below the top clock, widened the bottom-left ID hitbox for CRT curvature, and enforced high-contrast loading text and dotted icons.",
    "title": "Midnight Pond Pixel-Identical Window Geometry, Wider ID Hitbox & Loading State Icon Sync",
    "content_markdown": "This follow-up polish pass resolves the final live-QA items:\n\n1. Aligned Knowledge, Article Reader, Videos, Tools, Games, Chatroom, About, and Welcome to the exact same centered box below the top clock.\n2. Widened the bottom-left ID and language hitboxes to account for CRT barrel curvature.\n3. Enforced high-contrast cyan-white text and dotted phosphor emblems across all loading/empty/error states."
  },
  "ja": {
    "summary": "全デスクトップ窓を記事閲覧窓と完全同一の中央サイズへ統一し、CRT曲率に合わせて左下IDボタンのクリック判定を拡大、ロード文言とアイコンを点陣スタイルへ統一しました。",
    "title": "深夜の池ウィンドウ寸法完全統一・左下ID判定拡大・ロード表示アイコン統一",
    "content_markdown": "本番環境での実機検証に基づき、以下の最終微調整を行いました：\n\n1. 知識庫・記事閲覧・動画・ツール・ゲーム・チャット・概要・ようこそ窓のすべてを記事閲覧窓と完全に同一の中央サイズおよび配置へ統一し、切り替え時の位置ズレや上部時計との重なりを解消しました。\n2. CRT 曲率による端のズレを考慮し、左下 ID（ログイン）ボタンと言語切り替えボタンのクリック判定領域を広げ、確実に開けるよう改善しました。\n3. 動画区を含む全ウィンドウの読み込み中・空状態・エラー表示の文字色とアイコンを、高コントラストな青白文字および点陣発光アイコンへ統一しました。"
  }
}, "2026-11-22T03:22:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-visual-polish', '2026-11-22-pond-visual-polish', 'site-updates', '["site-update","ui","games"]', '', 'published', 0, 0, '2026-11-22T03:10:00+08:00', '2026-11-22T03:10:00+08:00', '2026-11-22T03:10:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-visual-polish", {
  "zh": {
    "summary": "修复左下角 ID 登录窗触发、重构两段式可打断季节粒子汇聚过渡、首屏直出零闪烁、统一全站居中窗口几何与加载态，并同步适配五个小游戏内页。",
    "title": "深夜池塘视觉与交互综合修复：登录触发、季节粒子汇聚过渡、全窗统一与游戏内页换装",
    "content_markdown": "本次更新完成了全站深夜池塘 CRT 视觉与交互的集中修复：\n\n1. 修复桌面左下角 ID（登录）按钮点击无反应与浮层被隐藏的问题，点击可正常打开居中登录窗并输入登录。\n2. 重构四季/时段切换过渡：先起明亮星尘汇聚动效，到位后水面与植物平滑切入，且支持中途随时打断无缝接续。\n3. 在首屏同步写入主题与关键保护样式，冷加载不再闪现旧桌面，并移除桌面端旧壁纸预加载。\n4. 统一全部桌面窗口到文章阅读窗的居中尺寸与位置，修复文章左侧目录重叠、知识库与各窗口点阵幽灵按钮、视频卡片对齐、全站暗色加载骨架与点阵状态图标，以及移动端知识库横向溢出。\n5. 五个小游戏内页（猫国建设者、小黑屋、2048、Hextris、人生重开模拟器）同步换装深夜池塘 CRT 风格，存档与 AI 接管逻辑保持原样。"
  },
  "en": {
    "summary": "Fixed the bottom-left ID login popover trigger, rebuilt interruptible two-stage season particle transitions, eliminated cold-load legacy flash, unified centered window geometry and dark loading states, and themed all five game inner pages.",
    "title": "Midnight Pond Visual & Interaction Polish: Login Popover, Staged Season Vortex, Unified Windows & Game Inner Pages",
    "content_markdown": "This release delivers a comprehensive Midnight Pond CRT polish pass:\n\n1. Fixed the bottom-left ID button trigger and popover visibility so the login modal opens reliably and accepts input.\n2. Rebuilt season transitions into a two-stage interruptible particle vortex: stardust gathers first while holding the current scene, then smoothly reveals the target season without snapping or queueing on rapid clicks.\n3. Added synchronous first-paint mode detection and removed legacy desktop wallpaper preloading to prevent any legacy desktop flash on cold load.\n4. Unified all desktop windows to the Article Reader centered geometry, fixed TOC item overlap, restyled primary CTA buttons as compact dotted CRT ghost pills, aligned video card layouts, unified dark CRT loading/skeleton states, and fixed mobile Knowledge overflow.\n5. Applied the Midnight Pond CRT theme to all five game inner pages while keeping game logic, saves, and AI takeover untouched."
  },
  "ja": {
    "summary": "左下のIDログイン窓修正、割り込み可能な二段階季節粒子演出、初回描画の旧画面チラつき解消、全ウィンドウ中央サイズ統一と暗色ロード状態、5つのゲーム内ページ刷新を実施しました。",
    "title": "深夜の池ビジュアル＆操作総合修正：ログイン窓・季節粒子演出・全窓統一・ゲーム内ページ刷新",
    "content_markdown": "今回のアップデートでは深夜の池 CRT スタイルの総合修正を行いました：\n\n1. 左下のIDボタンからログイン窓が確実に開き入力できるよう修正しました。\n2. 季節切替を「粒子収束→背景遷移」の二段階かつ途中割り込み可能な演出へ再構築しました。\n3. 初期描画ガードを追加し、初回読み込み時の旧デスクトップ一瞬表示を解消しました。\n4. 全ウィンドウを記事閲覧窓の中央サイズへ統一し、目次重なり・ボタン・動画カード整列・暗色ローディング表示・モバイル知識庫の横溢れを修正しました。\n5. 5つのゲーム内ページも深夜の池 CRT テーマへ統一しました。"
  }
}, "2026-11-22T03:10:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-chat-mobile-polish', '2026-11-22-pond-chat-mobile-polish', 'site-updates', '["网站更新","修复记录","聊天室","移动端","界面"]', '', 'published', 0, 0, '2026-11-21T18:51:00.000Z', '2026-11-21T18:51:00.000Z', '2026-11-21T18:51:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-chat-mobile-polish", {
  "zh": {
    "title": "聊天室紧凑气泡、移动端防溢出与同日 D1 迁移收尾",
    "summary": "补齐 02:31 线上收尾记录并同步完成精修：聊天室消息改为紧凑点阵气泡并放大提亮 6 枚点阵圆形 SVG 头像；移动端知识库全链路钳制宽度消除横向溢出并统一深色标签与阅读按钮；同步登记同日 D1 种子迁移前序版本。",
    "content_markdown": "# 聊天室紧凑气泡、移动端防溢出与同日 D1 迁移收尾\n\n本次更新补齐 02:31 线上收尾热修记录，并完成聊天室与移动端实机复审发现的细节修复。\n\n- 聊天室移除外层整行虚线框，改为紧贴文字的紧凑 CRT 玻璃气泡，隐藏重复旧头像，将 6 枚点阵圆形 SVG 默认头像放大至 42px 并提亮。\n- 移动端知识库对 `html / body / .site-shell / .page / .xp-window / .article-card` 全面钳制最大宽度并开启自然断行，消除右侧截断，同时将卡片标签与「阅读」按钮换装深色 CRT 风格。\n- 登记同日 D1 迁移前序版本，保障 `/api/articles` 稳定 `HTTP 200`。"
  },
  "en": {
    "title": "Compact CRT Chat Bubbles, Mobile Overflow Fix, and Same-Day D1 Migration Record",
    "summary": "Completes the release record and final polish: compact fit-content CRT chat bubbles with larger brighter dot-matrix SVG avatars, full mobile width clamping with dark tag/button styling to eliminate horizontal overflow, and same-day D1 migration compatibility.",
    "content_markdown": "# Compact CRT Chat Bubbles, Mobile Overflow Fix, and Same-Day D1 Migration Record\n\nThis release records the 02:31 live hotfix and resolves the remaining chatroom and mobile visual findings.\n\n- Switched chatroom rows to compact fit-content CRT glass bubbles and enlarged/brightened the 6 circular dot-matrix SVG avatars to 42px.\n- Clamped mobile shell, page, window, and card widths with word-wrapping and dark CRT tags/buttons to eliminate horizontal clipping.\n- Registered same-day D1 seed predecessors to keep `/api/articles` returning `HTTP 200`."
  },
  "ja": {
    "title": "チャット吹き出し最適化・モバイル横はみ出し解消・D1移行記録",
    "summary": "02:31修正の更新記録と最終調整を反映しました。チャットのコンパクト吹き出し化と42pxドットアバター発光、モバイル知識庫の横はみ出し解消と濃色タグ/ボタン化、同日D1移行互換を完了しています。",
    "content_markdown": "# チャット吹き出し最適化・モバイル横はみ出し解消・D1移行記録\n\n02:31の本番修正記録とチャット・モバイルの最終調整を反映しました。\n\n- チャット行をテキスト幅に沿うコンパクトなCRTガラス吹き出しへ変更し、6種の円形ドットSVGアバターを42pxで明るく表示しました。\n- モバイル知識庫の全階層幅を制御して横はみ出しを解消し、タグと「読む」ボタンも濃色CRTへ統一しました。"
  }
}, "2026-11-21T18:51:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-live-fix', '2026-11-22-pond-live-fix', 'site-updates', '["网站更新","修复记录","移动端","界面"]', '', 'published', 0, 0, '2026-11-21T18:22:00.000Z', '2026-11-21T18:22:00.000Z', '2026-11-21T18:22:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-live-fix", {
  "zh": {
    "title": "修复生产环境池塘视觉桥接加载与手机端/欢迎窗/关于页样式",
    "summary": "修复线上 dist 生产构建中 season-schedule.mjs 引用未单独导出的 /js/core/wallpaper-time.mjs 导致桥接脚本未执行的问题，并同步修复手机端知识库白底与横向溢出、欢迎窗文字对比度与 Esc 提示、关于页暗色社交图标。",
    "content_markdown": "# 修复生产环境池塘视觉桥接加载与手机端/欢迎窗/关于页样式\n\n本次热修解决线上实测发现的视觉层未生效及 4 处细节问题，全部功能与数据保持原样。\n\n- 将时段切换纯函数内联进 `js/pond-crt/season-schedule.mjs`，彻底消除生产环境对 `/js/core/wallpaper-time.mjs` 的跨目录导入失败。\n- 补全手机端内层搜索栏、分类行、列表、空状态与按钮的深色 CRT 玻璃换装并修复横向溢出。\n- 提升欢迎窗左栏文字与更新列表对比度，补充底部三语 `Esc 关闭此窗口` 提示。\n- 反色提亮关于页深色 X / GitHub 图标与状态提示框。"
  },
  "en": {
    "title": "Fix Production Pond Bridge Module Import and Mobile / Welcome / About Visual Polish",
    "summary": "Inlined the time-based wallpaper schedule helpers into season-schedule.mjs so production dist/ loads the Pond CRT bridge cleanly, and fixed mobile inner dark-glass surfaces & overflow, Welcome text contrast & Esc hint, and About social icon contrast.",
    "content_markdown": "# Fix Production Pond Bridge Module Import and Mobile / Welcome / About Visual Polish\n\nThis hotfix resolves the production ES module import issue and four visual polish items while keeping all live functionality unchanged.\n\n- Inlined the time-of-day boundary helpers directly into `js/pond-crt/season-schedule.mjs` so production builds never request unbundled `/js/core/wallpaper-time.mjs`.\n- Completed mobile dark CRT glass styling across inner search bars, filter chips, lists, empty states, and buttons with zero horizontal overflow.\n- Improved Welcome modal text contrast and added the bottom `Esc` hint; brightened dark social icons on About."
  },
  "ja": {
    "title": "本番環境の池塘ブリッジ読み込み修正とモバイル・歓迎窓・概要の表示改善",
    "summary": "本番distで未出力の/js/core/wallpaper-time.mjs参照によるブリッジ停止を解消し、モバイル内層のダークガラス化と横はみ出し修正、歓迎窓の文字コントラストとEsc案内、概要ページのSNSアイコン視認性を改善しました。",
    "content_markdown": "# 本番環境の池塘ブリッジ読み込み修正とモバイル・歓迎窓・概要の表示改善\n\n本番環境でのモジュール読み込み不良と4点の表示不具合を修正しました。既存機能・データは変更していません。\n\n- 時刻切り替えロジックを `js/pond-crt/season-schedule.mjs` 内に統合し、本番環境での確実な起動を保証しました。\n- モバイル版の内層UIダークガラス化・横はみ出し解消・歓迎窓コントラスト改善・概要SNSアイコン視認性向上を反映しました。"
  }
}, "2026-11-21T18:22:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-mobile-polish', '2026-11-22-pond-mobile-polish', 'site-updates', '["网站更新","移动端","界面"]', '', 'published', 0, 0, '2026-11-21T18:05:00.000Z', '2026-11-21T18:05:00.000Z', '2026-11-21T18:05:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-mobile-polish", {
  "zh": {
    "title": "手机端深夜池塘视觉统一与全站 CRT 细节收尾",
    "summary": "逐步视觉替换第 8 批（收官批）上线：手机端统一换装深夜池塘深色玻璃配色，保留 44px 触控区、六入口 Dock 与原有排版；同步完成文章阅读进度条加粗、黄虚线摘要框与工具卡图标放大提亮收尾。",
    "content_markdown": "# 手机端深夜池塘视觉统一与全站 CRT 细节收尾\n\n本次为全站视觉逐步替换的第 8 批（收官批）上线，实现桌面全栏目、三个工具子页面与手机端的深夜终端池塘视觉全站统一，全部业务功能、数据与接口保持原样。\n\n- 手机端窗口、卡片、顶部栏与底部六入口 Dock 统一套用深夜池塘深色磨砂玻璃与青色点阵边框，不改变 44px 触控尺寸与既有手势。\n- 收尾优化：文章阅读页进度条加粗为彩虹发光渐变条并放大百分比字号，摘要框增加黄虚线边与三语「摘要：」前缀，工具卡三枚点阵 SVG 图标放大并提亮。"
  },
  "en": {
    "title": "Mobile Shell Visual Unification and Site-Wide CRT Final Polish",
    "summary": "Batch 8 (final batch) of the visual refresh is live: the mobile shell adopts the Midnight Pond dark glass palette while preserving 44px touch targets and the 6-route Dock, alongside final desktop polish for the Article progress bar, yellow-dotted summary box, and larger brighter Tool SVG icons.",
    "content_markdown": "# Mobile Shell Visual Unification and Site-Wide CRT Final Polish\n\nBatch 8 completes the Midnight Pond CRT visual refresh across desktop routes, all three tool sub-pages, and mobile without modifying any live logic or data.\n\n- Applies dark frosted pond glass and dotted mint accents to mobile windows, cards, and the 6-route Dock while preserving all 44px touch targets and gestures.\n- Final desktop polish: thicker rainbow reading progress bar with larger `%` readout, yellow-dotted localized summary box, and larger brighter Tool card SVG icons."
  },
  "ja": {
    "title": "モバイル版ビジュアル統一と全サイトCRT最終仕上げ",
    "summary": "段階的ビジュアル刷新の第8弾（最終回）を公開しました。モバイル版を深夜池塘ダークガラス配色へ統一し、44pxタッチ領域と6入口Dockを維持。記事進捗バー・黄点線要約枠・ツールアイコン拡大発光も仕上げました。",
    "content_markdown": "# モバイル版ビジュアル統一と全サイトCRT最終仕上げ\n\n段階的ビジュアル刷新の最終回として、モバイル版の配色統一と全サイトの細部仕上げを完了しました。機能・データ・APIは一切変更していません。\n\n- モバイル版のウィンドウ・カード・6入口Dockに深夜池塘ダークガラス配色を適用し、44px操作領域を維持しました。\n- 記事の読書進捗バーの強調、黄点線要約枠、ツールSVGアイコンの拡大発光を反映しています。"
  }
}, "2026-11-21T18:05:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-about-login-welcome', '2026-11-22-pond-about-login-welcome', 'site-updates', '["网站更新","欢迎窗","账号","界面"]', '', 'published', 0, 0, '2026-11-21T18:02:00.000Z', '2026-11-21T18:02:00.000Z', '2026-11-21T18:02:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-about-login-welcome", {
  "zh": {
    "title": "关于、登录浮层与欢迎窗换装深夜终端 CRT 视觉",
    "summary": "逐步视觉替换第 7 批上线：桌面端关于页（#about）、账号登录/注册浮层（#account-popover）与欢迎/最近更新窗（#welcome-modal）全部换装半透明 CRT 玻璃视觉；头像、RSS 订阅、社交链接、会话登录与默认不自动弹窗规则保持原样。",
    "content_markdown": "# 关于、登录浮层与欢迎窗换装深夜终端 CRT 视觉\n\n本次为全站视觉逐步替换的第 7 批上线，桌面端 9 个核心窗口与弹层至此全部完成深夜终端 CRT 玻璃视觉统一，零功能与数据改动。\n\n- 关于页保留现站鲁肃头像、个人介绍、独立每日 AI 新闻 RSS 订阅行与社交链接。\n- 账号登录/注册浮层居中呈现为 CRT 发光玻璃卡片，保留现站 HttpOnly Cookie 会话与表单校验。\n- 欢迎窗保持默认不自动弹出规则，主动打开或 `?welcome=1` 时以 CRT 玻璃窗展示最近更新。\n- 下一批将完成手机端视觉统一与全站细节收尾。"
  },
  "en": {
    "title": "About, Account Login, and Welcome Modal Refreshed with Midnight Pond CRT Visuals",
    "summary": "Batch 7 of the visual refresh is live: About (#about), the Account login/register popover (#account-popover), and the Welcome modal (#welcome-modal) adopt the translucent CRT glass skin while keeping all existing profile links, RSS feed, auth sessions, and non-auto-popup rules intact.",
    "content_markdown": "# About, Account Login, and Welcome Modal Refreshed with Midnight Pond CRT Visuals\n\nBatch 7 completes the Midnight Pond CRT visual refresh across all 9 desktop windows and dialogs without modifying any live logic or data.\n\n- About retains the existing avatar, profile info, standalone Daily AI News RSS row, and social links.\n- Account login/register renders as a centered CRT glass card over live HttpOnly cookie sessions.\n- Welcome keeps its opt-in display rule and renders recent updates in CRT glass.\n- Mobile shell visual unification and final polish follow next."
  },
  "ja": {
    "title": "概要・ログイン・歓迎ウィンドウを深夜端末CRTビジュアルへ刷新",
    "summary": "段階的ビジュアル刷新の第7弾を公開しました。デスクトップの概要（#about）・ログイン/登録ポップオーバー・歓迎ウィンドウ（#welcome-modal）を半透明CRTガラスへ統一し、RSS・認証・自動非表示ルールはそのまま維持しています。",
    "content_markdown": "# 概要・ログイン・歓迎ウィンドウを深夜端末CRTビジュアルへ刷新\n\n段階的ビジュアル刷新の第7弾として、概要・ログイン・歓迎ウィンドウの表示レイヤーを更新し、デスクトップ全9ウィンドウのCRTガラス統一が完了しました。\n\n- 概要ページは既存アバター・毎日AIニュースRSS・SNSリンクを維持しています。\n- ログインと歓迎ウィンドウも既存機能のまま半透明CRTガラスへ刷新しました。\n- 続いてモバイル版のビジュアル統一と最終仕上げへ進みます。"
  }
}, "2026-11-21T18:02:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-chatroom', '2026-11-22-pond-chatroom', 'site-updates', '["网站更新","聊天室","界面"]', '', 'published', 0, 0, '2026-11-21T17:59:00.000Z', '2026-11-21T17:59:00.000Z', '2026-11-21T17:59:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-chatroom", {
  "zh": {
    "title": "聊天室换装深夜终端 CRT 玻璃窗与点阵默认头像",
    "summary": "逐步视觉替换第 6 批上线：桌面端匿名聊天室（#chatroom）换装半透明 CRT 玻璃聊天窗并接入 6 枚点阵圆形 SVG 默认头像；匿名昵称、普通房/密码房、5 秒同步、300 字计数与发送节流均保持原样。",
    "content_markdown": "# 聊天室换装深夜终端 CRT 玻璃窗与点阵默认头像\n\n本次为全站视觉逐步替换的第 6 批上线，仅替换桌面端聊天室（`#chatroom`）的视觉呈现层，不改动任何消息接口、密码房端到端加密、轮询或节流逻辑。\n\n- 悬浮于四季池塘 CRT 背景之上，消息气泡采用点阵虚线圆角边框，并按昵称确定性映射 6 枚点阵圆形 SVG 头像。\n- 保留现站匿名昵称切换、密码房说明浮层、300 字计数、自动滚动与重试功能。\n- 关于、登录、欢迎窗及手机端继续按顺序逐批推进。"
  },
  "en": {
    "title": "Chatroom Refreshed with Midnight Pond CRT Glass UI and Dot-Matrix Avatars",
    "summary": "Batch 6 of the visual refresh is live: the desktop anonymous Chatroom (#chatroom) adopts translucent CRT glass bubbles and 6 circular dot-matrix SVG avatars while keeping anonymous identity, password rooms, 5s polling, 300-char limit, and cooldown untouched.",
    "content_markdown": "# Chatroom Refreshed with Midnight Pond CRT Glass UI and Dot-Matrix Avatars\n\nBatch 6 updates only the presentation layer for the desktop Chatroom (`#chatroom`), preserving all `/api/chat/messages` calls, password-room encryption, polling, and rate-limit behavior.\n\n- Renders dotted CRT glass message bubbles with 6 deterministic circular dot-matrix SVG avatars over the live Pond canvas.\n- About, Login, Welcome, and mobile roll out next."
  },
  "ja": {
    "title": "チャットルームを深夜端末CRTガラス窓とドットアバターへ刷新",
    "summary": "段階的ビジュアル刷新の第6弾を公開しました。デスクトップの匿名チャット（#chatroom）を半透明CRTガラス窓と6種の円形ドットSVGアバターへ換装し、合言葉ルーム・5秒同期・300文字制限は従来のまま維持しています。",
    "content_markdown": "# チャットルームを深夜端末CRTガラス窓とドットアバターへ刷新\n\n段階的ビジュアル刷新の第6弾として、デスクトップのチャットルーム（`#chatroom`）の表示レイヤーのみを更新しました。メッセージ送受信・パスワード部屋暗号化・クールダウンは一切変更していません。\n\n- 6種の円形ドットSVGアバターと点線枠バブル、丸型入力バーを適用しました。\n- 概要・ログイン・歓迎窓・モバイル版へ順次進みます。"
  }
}, "2026-11-21T17:59:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-games', '2026-11-22-pond-games', 'site-updates', '["网站更新","游戏区","界面"]', '', 'published', 0, 0, '2026-11-21T17:56:00.000Z', '2026-11-21T17:56:00.000Z', '2026-11-21T17:56:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-games", {
  "zh": {
    "title": "游戏区换装深夜终端 CRT 游戏货架与点阵封面",
    "summary": "逐步视觉替换第 5 批上线：桌面端游戏区（#games）换装半透明 CRT 玻璃货架，接入 3 张点阵插图封面（猫国建设者、小黑屋、人生重开模拟器）及 2048、Hextris 点阵封面；游戏启动、三语参数与云存档同步保持原样。",
    "content_markdown": "# 游戏区换装深夜终端 CRT 游戏货架与点阵封面\n\n本次为全站视觉逐步替换的第 5 批上线，仅替换桌面端游戏区（`#games`）的视觉呈现层，不改动任何游戏目录数据、启动参数或云存档同步逻辑。\n\n- 上三下二货架排布直接作用在现站 `games/catalog.json` 渲染结果之上。\n- 猫国建设者、小黑屋、人生重开模拟器接入点阵风插图封面，2048 与 Hextris 采用点阵几何 SVG 封面。\n- 聊天室、关于、登录、欢迎窗及手机端继续按顺序逐批推进。"
  },
  "en": {
    "title": "Games Shelf Refreshed with Midnight Pond CRT Layout and Dot-Matrix Covers",
    "summary": "Batch 5 of the visual refresh is live: the desktop Games shelf (#games) adopts the translucent CRT glass 3+2 shelf layout with 3 dot-matrix illustrated covers and 2 geometric SVG covers while keeping catalog loading, launch links, and cloud saves untouched.",
    "content_markdown": "# Games Shelf Refreshed with Midnight Pond CRT Layout and Dot-Matrix Covers\n\nBatch 5 updates only the presentation layer for the desktop Games shelf (`#games`), preserving all `games/catalog.json` data, language launch links, and cloud-save behavior.\n\n- Applies the 3-over-2 CRT glass card shelf over the existing `#game-list` DOM.\n- Uses dot-matrix covers for Kittens Game, A Dark Room, and Life Restart, plus crisp geometric SVG covers for 2048 and Hextris.\n- Chatroom, About, Login, Welcome, and mobile roll out next."
  },
  "ja": {
    "title": "ゲーム棚を深夜端末CRTレイアウトとドット風カバーへ刷新",
    "summary": "段階的ビジュアル刷新の第5弾を公開しました。デスクトップのゲーム欄（#games）を半透明CRTガラス棚と3種のドット風イラストカバー＋2種の幾何SVGカバーへ換装し、起動・クラウドセーブ機能は従来のまま維持しています。",
    "content_markdown": "# ゲーム棚を深夜端末CRTレイアウトとドット風カバーへ刷新\n\n段階的ビジュアル刷新の第5弾として、デスクトップのゲーム欄（`#games`）の表示レイヤーのみを更新しました。`games/catalog.json`・起動パラメータ・クラウドセーブ同期は一切変更していません。\n\n- 上段3件＋下段2件のCRTガラス棚レイアウトを既存DOMへ適用しました。\n- 子猫ゲーム・暗い部屋・人生やり直しシミュレーターにドット風カバー、2048・Hextrisに幾何SVGカバーを適用しています。\n- チャット・概要・ログイン・歓迎窓・モバイル版へ順次進みます。"
  }
}, "2026-11-21T17:56:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-tools', '2026-11-22-pond-tools', 'site-updates', '["网站更新","工具区","在线画板","界面"]', '', 'published', 0, 0, '2026-11-21T17:52:00.000Z', '2026-11-21T17:52:00.000Z', '2026-11-21T17:52:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-tools", {
  "zh": {
    "title": "工具区与三个工具子页面换装深夜终端 CRT 视觉",
    "summary": "逐步视觉替换第 4 批上线：桌面端工具区（#resources）换装提亮版 CRT 玻璃卡片并接入 6 枚点阵虚线 SVG 图标，同时为临时互传弹窗、在线画板与日语的言外之意统一套用深夜池塘 CRT 视觉主题；全部功能与交互逻辑保持原样。",
    "content_markdown": "# 工具区与三个工具子页面换装深夜终端 CRT 视觉\n\n本次为全站视觉逐步替换的第 4 批上线，仅替换工具区与三个工具子页面的视觉呈现层，不改动任何工具逻辑、协作协议或子项目数据。\n\n- 整体提亮了 CRT 玻璃窗的通透度与边框辉光，工具区三列卡片接入点阵虚线风调色盘、电脑⇄手机、鸟居及下载行 SVG 图标。\n- 临时互传弹窗、在线画板（`/tools/whiteboard/`）与日语的言外之意（`/tools/japanese-subtext/`）统一挂接深夜池塘 CRT 视觉层，画布与答题逻辑零改动。\n- 游戏、聊天室、关于、登录、欢迎窗及手机端继续按顺序逐批推进。"
  },
  "en": {
    "title": "Tools Window and Three Tool Sub-Pages Refreshed with Midnight Pond CRT Visuals",
    "summary": "Batch 4 of the visual refresh is live: the desktop Tools window (#resources) adopts the brightened CRT glass skin with 6 dotted SVG icons, and Quick Transfer, Online Whiteboard, and Behind the Japanese share the Midnight Pond CRT visual theme without changing any tool logic.",
    "content_markdown": "# Tools Window and Three Tool Sub-Pages Refreshed with Midnight Pond CRT Visuals\n\nBatch 4 updates only the visual presentation layer for Tools (`#resources`) and all three public tool sub-pages while keeping every tool feature and protocol intact.\n\n- Lifted CRT glass translucency and luminous border glow across windows, integrating the 6 dotted SVG icons for tools and download cards.\n- Applied the Midnight Pond CRT visual theme to the Quick Transfer modal, Online Whiteboard (`/tools/whiteboard/`), and Behind the Japanese (`/tools/japanese-subtext/`).\n- Games, Chatroom, About, Login, Welcome, and mobile continue rolling out next."
  },
  "ja": {
    "title": "ツール欄と3つのツール子ページを深夜端末CRTビジュアルへ刷新",
    "summary": "段階的ビジュアル刷新の第4弾を公開しました。デスクトップのツール欄（#resources）を明るく透過感のあるCRTガラス窓と6種の点線SVGアイコンへ換装し、一時転送・ホワイトボード・日本語の裏側にも共通CRTテーマを適用しました。",
    "content_markdown": "# ツール欄と3つのツール子ページを深夜端末CRTビジュアルへ刷新\n\n段階的ビジュアル刷新の第4弾として、ツール欄（`#resources`）と3つのツール子ページの表示レイヤーのみを更新しました。既存機能・通信・データは一切変更していません。\n\n- CRTガラス窓の透過感と枠線発光を底上げし、パレット・転送・鳥居など6種の点線SVGアイコンを適用しました。\n- 一時転送モーダル・オンラインホワイトボード・日本語の裏側にも深夜池塘CRTテーマを統一適用しています。\n- ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版へ順次進みます。"
  }
}, "2026-11-21T17:52:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos', '2026-11-22-pond-videos', 'site-updates', '["网站更新","视频区","界面"]', '', 'published', 0, 0, '2026-11-21T17:46:00.000Z', '2026-11-21T17:46:00.000Z', '2026-11-21T17:46:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos", {
  "zh": {
    "title": "视频区换装深夜终端 CRT 玻璃卡片窗",
    "summary": "逐步视觉替换第 3 批上线：桌面端视频区（#videos）与播放弹窗换装半透明 CRT 玻璃窗，保留现站 /api/videos 接口、分类筛选、平台徽标与外链播放逻辑；工具、游戏、聊天室、关于、登录、欢迎窗及手机端保持原样。",
    "content_markdown": "# 视频区换装深夜终端 CRT 玻璃卡片窗\n\n本次为全站视觉逐步替换的第 3 批上线，仅替换桌面端视频区（`#videos`）与视频弹窗的视觉呈现层，不改动任何视频数据接口、分类逻辑或外链播放行为。\n\n- 悬浮于四季池塘 CRT 背景之上，采用三列 16:9 卡片网格、点阵虚线播放徽标与分类胶囊筛选。\n- 保留现站 `/api/videos` 实时拉取、平台标识（Bilibili / YouTube）与外链播放能力。\n- 工具、游戏、聊天室、关于、登录、欢迎窗及手机端均保持原样，继续按顺序逐批替换。"
  },
  "en": {
    "title": "Videos Section Refreshed with Midnight Pond CRT Cards",
    "summary": "Batch 3 of the visual refresh is live: the desktop Videos window (#videos) and player modal adopt translucent CRT glass styling with 3-column 16:9 cards and dotted play badges while keeping live /api/videos data and playback links untouched.",
    "content_markdown": "# Videos Section Refreshed with Midnight Pond CRT Cards\n\nBatch 3 updates only the presentation layer for the desktop Videos section (`#videos`) and player modal, keeping all `/api/videos` requests, category filters, platform badges, and external links intact.\n\n- Renders a 3-column 16:9 CRT glass card grid over the live Pond background with dotted play overlays and glowing category pills.\n- Tools, Games, Chatroom, About, Login, Welcome, and mobile remain untouched and continue rolling out next."
  },
  "ja": {
    "title": "動画セクションを深夜端末・CRTガラスカードへ刷新",
    "summary": "段階的ビジュアル刷新の第3弾を公開しました。デスクトップの動画欄（#videos）と再生モーダルを半透明CRTガラス窓へ換装し、既存の/api/videos連携・カテゴリ絞り込み・外部リンク再生はそのまま維持しています。",
    "content_markdown": "# 動画セクションを深夜端末・CRTガラスカードへ刷新\n\n段階的ビジュアル刷新の第3弾として、デスクトップの動画セクション（`#videos`）と再生モーダルの表示レイヤーのみを更新しました。`/api/videos` 取得・分類フィルタ・外部再生リンクは一切変更していません。\n\n- 四季池塘CRT背景の上に3列16:9カードグリッドと点線再生アイコン、カテゴリピルを配置しました。\n- ツール・ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T17:46:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-article-reader', '2026-11-22-pond-article-reader', 'site-updates', '["网站更新","知识库","文章详情","阅读体验","界面"]', '', 'published', 0, 0, '2026-11-21T17:38:00.000Z', '2026-11-21T17:38:00.000Z', '2026-11-21T17:38:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-article-reader", {
  "zh": {
    "title": "文章阅读页换装深夜终端 CRT 玻璃阅读窗",
    "summary": "逐步视觉替换第 2 批上线：桌面端文章阅读页（#article-detail）换装半透明 CRT 玻璃阅读窗，保留现站目录 TOC、顶部阅读进度条、摘要框、复制链接与正文排版逻辑；其余未替换栏目与手机端保持原样。",
    "content_markdown": "# 文章阅读页换装深夜终端 CRT 玻璃阅读窗\n\n本次为全站视觉逐步替换的第 2 批上线，仅替换桌面端文章阅读页（`#article-detail`）的视觉呈现层，不改动现站文章拉取接口、目录生成、进度计算或任何交互逻辑。\n\n- 阅读窗直接悬浮于四季池塘 CRT 背景之上，顶部阅读进度条升级为青→紫→粉荧光点阵渐变条。\n- 左侧目录区采用点阵竖线与荧光高亮当前章节，右侧正文区配点阵虚线摘要框与深色高对比 Markdown 排版。\n- 视频、工具、游戏、聊天室、关于、登录、欢迎窗及手机端 iOS Shell 均保持原样，继续按顺序逐批替换。"
  },
  "en": {
    "title": "Article Reader Refreshed with Midnight Pond CRT Glass Styling",
    "summary": "Batch 2 of the visual refresh is live: the desktop Article Reader (#article-detail) adopts the translucent CRT glass layout over the live Pond background while keeping TOC, reading progress, summary toggle, link copying, and markdown rendering untouched.",
    "content_markdown": "# Article Reader Refreshed with Midnight Pond CRT Glass Styling\n\nBatch 2 of the gradual visual replacement updates only the presentation layer of the desktop Article Reader (`#article-detail`), leaving all article APIs, TOC generation, scroll progress math, and interactions untouched.\n\n- The reader floats cleanly over the four-season Pond CRT background with a cyan-to-pink glowing reading progress bar.\n- The left TOC sidebar uses dotted guides and phosphor active states, paired with a dotted summary callout and high-contrast dark CRT markdown typography.\n- Videos, Tools, Games, Chatroom, About, Login, Welcome, and mobile remain unchanged and will roll out next."
  },
  "ja": {
    "title": "記事リーダーを深夜端末・CRTガラス表示へ刷新",
    "summary": "段階的ビジュアル刷新の第2弾を公開しました。デスクトップの記事閲覧ページ（#article-detail）を池塘背景上の半透明CRTガラス窓へ換装し、目次・読書進捗・要約・リンクコピー等の機能はすべて従来のまま維持しています。",
    "content_markdown": "# 記事リーダーを深夜端末・CRTガラス表示へ刷新\n\n段階的ビジュアル刷新の第2弾として、デスクトップの記事閲覧ページ（`#article-detail`）の表示レイヤーのみを更新しました。記事取得API・目次生成・進捗計算・各種操作は一切変更していません。\n\n- 四季池塘CRT背景の上に半透明ガラス窓を重ね、上部の読書進捗バーを青〜ピンクの発光グラデーションへ統一しました。\n- 左側の目次サイドバーと右側の点線要約枠・高コントラストMarkdown本文をCRT端末風に整えています。\n- 動画・ツール・ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T17:38:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-21-pond-home-knowledge', '2026-11-21-pond-home-knowledge', 'site-updates', '["网站更新","首页","知识库","界面"]', '', 'published', 0, 0, '2026-11-21T15:30:00.000Z', '2026-11-21T15:30:00.000Z', '2026-11-21T15:30:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-21-pond-home-knowledge", {
  "zh": {
    "title": "桌面首页与知识库列表换装深夜终端池塘视觉",
    "summary": "逐步视觉替换第 1 批上线：桌面端首页替换为四季池塘 CRT 点阵桌面（接入按时段自动切换与手动滑块），桌面端知识库列表换装半透明 CRT 玻璃窗口；全部数据、接口、分类、排序、搜索、分页及未替换栏目与移动端均保持原样。",
    "content_markdown": "# 桌面首页与知识库列表换装深夜终端池塘视觉\n\n本次为全站视觉逐步替换的第 1 批上线，仅替换桌面端首页与知识库列表的视觉呈现层，不改动任何线上数据、后端接口或既有交互逻辑。\n\n- 桌面端首页替换为 WebGL2 四季池塘 CRT 桌面，接入现站时段壁纸规则（早/昼/暮/夜自动对应春/夏/秋/冬），右上角保留手动滑块切换。\n- 桌面端知识库列表在现站真实 DOM 与 `/api/articles` 接口之上换装半透明发光 CRT 玻璃窗口，沿用现站分类顺序、计数、置顶、搜索与分页逻辑。\n- 文章阅读页、视频、工具、游戏、聊天室、关于、账号浮层、欢迎窗及移动端 iOS Shell 均保持现状，后续按窗口逐一替换。"
  },
  "en": {
    "title": "Desktop Home and Knowledge List Refresh with Midnight Pond CRT Visuals",
    "summary": "Batch 1 of the visual refresh is live: desktop Home adopts the four-season WebGL2 Pond CRT desktop (synced with the time-of-day schedule and manual slider), and the desktop Knowledge list uses the translucent CRT glass skin. All data, APIs, sorting, search, pagination, other sections, and mobile remain unchanged.",
    "content_markdown": "# Desktop Home and Knowledge List Refresh with Midnight Pond CRT Visuals\n\nThis is Batch 1 of the gradual visual replacement, updating only the presentation layer for desktop Home and the Knowledge list while keeping all live data, backend APIs, and existing logic untouched.\n\n- Desktop Home now renders the four-season WebGL2 Pond CRT scene connected to the site's time-of-day wallpaper schedule (morning/day/dusk/night -> spring/summer/autumn/winter) with a manual top-right slider.\n- Desktop Knowledge list applies the translucent CRT glass window skin directly over the existing DOM and live `/api/articles` flow, preserving category order, counts, pinning, search, and pagination.\n- Article Reader, Videos, Tools, Games, Chatroom, About, Account popover, Welcome modal, and the mobile shell remain unchanged and will be updated incrementally."
  },
  "ja": {
    "title": "デスクトップのホームと知識庫一覧を深夜端末・池塘CRTビジュアルへ刷新",
    "summary": "段階的ビジュアル刷新の第1弾を公開しました。デスクトップのホームを時間帯連動の四季池塘CRTへ、知識庫一覧を半透明CRTガラス窓へ切り替えました。データ・API・並び順・検索・ページングおよび他ページとモバイルは従来のままです。",
    "content_markdown": "# デスクトップのホームと知識庫一覧を深夜端末・池塘CRTビジュアルへ刷新\n\n全サイト段階的ビジュアル刷新の第1弾として、デスクトップのホーム画面と知識庫一覧の表示レイヤーのみを更新しました。既存データ・API・機能ロジックは一切変更していません。\n\n- デスクトップのホームに WebGL2 四季池塘 CRT を導入し、既存の時刻壁紙ルール（朝・昼・夕・夜→春・夏・秋・冬）と右上の手動スライダーを接続しました。\n- デスクトップの知識庫一覧は既存 DOM と `/api/articles` のまま半透明 CRT ガラス窓へスキン適用し、カテゴリ順・件数・固定表示・検索・ページングを維持しています。\n- 記事本文、動画、ツール、ゲーム、チャット、概要、アカウント、歓迎ウィンドウ、モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T15:30:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-10-29-tool-maintenance', '2026-10-29-tool-maintenance', 'site-updates', '["网站更新","工具"]', '', 'published',0,0,'2026-10-29T15:00:00.000Z', '2026-10-29T15:00:00.000Z', '2026-10-29T15:00:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-10-29-tool-maintenance", {
  "zh": {
    "title": "工具维护与完整画板导出准备",
    "summary": "本地候选在现有画板和互传基础上完善完整图片导出与管理适配，保留现有大厅、帮助、上传和草稿保护；尚未部署。",
    "content_markdown": "# 工具维护与完整画板导出准备\n\n本地候选在现有画板和互传基础上完善完整图片导出与管理适配，保留现有大厅、帮助、上传和草稿保护；尚未部署。\n\n画板导出覆盖当前场景全部未删除元素和已加载的图片，包括屏幕视口外的内容。素材尚未加载时明确失败，不把只有文字或元数据的结果当作完整图片。\n\n继续保留主线已经验证的紧凑大厅、键盘与触屏帮助、三语界面以及密码房生命周期。互传继续保留切换标签页时的上传、离房草稿清理、失败重试和安全删除语义。本条是本地候选维护记录，线上功能与版本以正式部署为准；没有在测试中发布文章、发送真实消息或覆盖个人游戏存档。"
  },
  "en": {
    "title": "Tool Maintenance and Full Whiteboard Export Preparation",
    "summary": "The local candidate adds full whiteboard image export and administration integration while retaining the existing lobby, help, uploads and draft protection. It has not been deployed.",
    "content_markdown": "# Tool Maintenance and Full Whiteboard Export Preparation\n\nThe local candidate adds full whiteboard image export and administration integration while retaining the existing lobby, help, uploads and draft protection. It has not been deployed.\n\nWhiteboard export includes all undeleted scene elements and loaded image assets, including content beyond the viewport. Missing image assets produce an explicit failure. The existing lobby, keyboard and touch help, room lifecycle, background uploads and draft cleanup remain intact. This is a local candidate maintenance record, not a production release announcement."
  },
  "ja": {
    "title": "ツール保守とホワイトボード全体画像の準備",
    "summary": "ローカル候補版で全体画像の書き出しと管理連携を整備しました。既存のロビー、ヘルプ、アップロード、下書き保護を維持しています。まだ公開していません。",
    "content_markdown": "# ツール保守とホワイトボード全体画像の準備\n\nローカル候補版で全体画像の書き出しと管理連携を整備しました。既存のロビー、ヘルプ、アップロード、下書き保護を維持しています。まだ公開していません。\n\n書き出しには、画面の表示範囲外も含め、削除されていない全要素と読み込み済み画像が含まれます。画像素材が不足している場合は明確に失敗を返します。既存のロビー、キーボードやタッチでのヘルプ、部屋の有効期限、バックグラウンドでのアップロードと下書き消去を維持します。これはローカル候補の保守記録であり、本番公開の告知ではありません。実際のサイトの状態は正式なデプロイに従います。"
  }
}, "2026-10-29T15:00:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-09-28-mobile-layout', '2026-09-28-mobile-layout', 'site-updates', '["网站更新","移动端","聊天室","界面"]', '', 'published', 0, 0, '2026-09-28T02:00:00.000Z', '2026-09-28T02:00:00.000Z', '2026-09-28T02:00:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-09-28-mobile-layout", {
  "zh": {
    "title": "手机界面重新排版",
    "summary": "首页入口、栏目卡片和底部导航统一调整；聊天室重新划分身份、房间、消息与输入区，改善短屏和横屏下的阅读与操作。",
    "content_markdown": "# 手机界面重新排版\n\n首页入口、栏目卡片和底部导航统一调整；聊天室重新划分身份、房间、消息与输入区，改善短屏和横屏下的阅读与操作。\n\n- 首页竖屏采用三列入口，横屏采用一排入口，保留像素图标和时段壁纸。\n- 栏目窗口和卡片使用更简洁的边框、统一的字号和自然换行。\n- 视频卡保留完整的 16:9 大封面，下方排列标题和简介，作者日期与播放按钮并排。\n- 聊天室采用固定语义分区，消息列表独立滚动；短屏计数与发送按钮并排，横屏使用左侧房间栏。\n- 底部 Dock 提高文字对比，继续支持横滑与收起。\n- 保留中文、英文和日文界面。"
  },
  "en": {
    "title": "A Reworked Mobile Layout",
    "summary": "Home shortcuts, content cards, and navigation now share a clearer layout. Chat separates identity, room controls, messages, and composition for easier use on short and landscape screens.",
    "content_markdown": "# A Reworked Mobile Layout\n\nHome shortcuts, content cards, and navigation now share a clearer layout. Chat separates identity, room controls, messages, and composition for easier use on short and landscape screens.\n\n- Home uses three columns in portrait and one row in landscape, with pixel icons and time-based wallpapers.\n- Windows and cards use simpler borders, consistent type sizes, and natural wrapping.\n- Video cards retain a full-width 16:9 cover, followed by the title and description, with author and date beside the play button.\n- Chat has explicit layout areas and a separately scrolling conversation. Compact screens place the counter beside Send; landscape uses a room sidebar.\n- Dock labels have higher contrast, with scrolling and collapse controls retained.\n- Chinese, English, and Japanese remain available."
  },
  "ja": {
    "title": "モバイル画面のレイアウトを刷新",
    "summary": "ホームの入口、各ページのカード、下部ナビゲーションを整理。チャットの名前・部屋・メッセージ・入力欄を分け、小さな画面や横向きでも使いやすくしました。",
    "content_markdown": "# モバイル画面のレイアウトを刷新\n\nホームの入口、各ページのカード、下部ナビゲーションを整理。チャットの名前・部屋・メッセージ・入力欄を分け、小さな画面や横向きでも使いやすくしました。\n\n- ホームは縦向きで3列、横向きで1行に配置。ピクセルアイコンと時間帯の壁紙を維持しました。\n- ウィンドウとカードの枠線、文字サイズ、折り返しを統一しました。\n- 動画カードは横幅いっぱいの16:9カバーを表示し、下にタイトルと説明、作者・日時と再生ボタンを配置します。\n- チャットを明確な領域に分け、メッセージだけをスクロールできます。小画面では文字数と送信ボタンを横に配置し、横向きでは部屋操作を左側に表示します。\n- Dockの文字のコントラストを改善し、横スクロールと折りたたみを維持しました。\n- 中国語・英語・日本語に対応しています。"
  }
}, "2026-09-28T02:00:00.000Z"),
    env.DB.prepare(`
    insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values (
      'seed-update-2026-09-08-site-review-optimization',
      '2026-09-08-site-review-optimization',
      'site-updates',
      '["网站更新","界面","移动端","工具","可靠性"]',
      '',
      'published',
      0,
      0,
      '2026-09-07T23:00:00.000Z',
      '2026-09-07T23:00:00.000Z',
      '2026-09-07T23:00:00.000Z'
    ) on conflict(article_id) do nothing
    `),
    ...articleTranslationsStatements(env, "seed-update-2026-09-08-site-review-optimization", {
      zh: {
        title: "全站体验与可靠性优化",
        summary: "欢迎窗改为主动查看，工具与画板入口更清晰，手机手势和动效更稳定；知识库支持完整分页搜索，临时互传修复跨房草稿与后台上传，发布增加精确版本校验。",
        content_markdown: "# 全站体验与可靠性优化\n\n这次根据全站审查，集中改善适配、界面、交互和代码可靠性。继续保留桌面的 XP／像素风格与手机端独立布局。\n\n## 阅读与导航\n\n- 欢迎窗改为主动打开，可通过首页的欢迎与更新入口查看；文章直链不会被自动弹窗打断。\n- 知识库增加分页与服务端搜索，分类数量覆盖全部已发布文章；相同标签只显示一次。\n- 文章链接支持 Ctrl／Command 点击和浏览器的新标签页操作。\n\n## 工具与移动端\n\n- 工具卡片先说明用途，版本和技术说明按需展开；视频缩略图去掉内框，标题、简介、时间与播放按钮重新对齐。\n- 在线画板 1.0.10 整理身份、公共房、密码房和最近使用；帮助支持鼠标、键盘与触控，展开时不遮挡输入。\n- 临时互传 1.0.14 离房清空未发送草稿，切后台不主动取消上传，暂停与继续能正确衔接；启动失败可直接重试。\n- 手机返回首页手势仅从 Home 指示条触发，输入、键盘或弹层开启时不会误退出；快速切换时取消过期动效。\n\n## 可靠性与维护\n\n- 注册、登录不再被非关键访问统计写入失败阻断。\n- 后端拆出会话、清理和内容迁移服务；清理分批继续，失败允许重试。\n- 第一方代码统一静态检查，发布核对实际提交与资源哈希，避免把旧站点当作本次上线。\n"
      },
      en: {
        title: "A Clearer, More Reliable Personal Site",
        summary: "Welcome is now optional, tool and whiteboard entries are clearer, and mobile gestures are more predictable. Knowledge gains complete pagination and search; Transfer fixes room drafts and background uploads, with exact release checks.",
        content_markdown: "# A Clearer, More Reliable Personal Site\n\nThis release follows a site-wide review of responsive layout, visual design, interaction, and reliability. The desktop keeps its XP and pixel style, with a separate layout for phones.\n\n## Reading and navigation\n\n- Welcome opens on request from the Home welcome and updates entry. Direct article links are no longer interrupted by an automatic dialog.\n- Knowledge now has pagination and server-side search across published articles, complete category counts, and deduplicated tags.\n- Article links preserve Control/Command-click and the browser's native new-tab behavior.\n\n## Tools and mobile\n\n- Tool cards explain their purpose first, with version and technical details available on demand. Video thumbnails lose the inner frame, and card titles, summaries, dates, and playback actions align more consistently.\n- Whiteboard 1.0.10 organizes identity, public rooms, password rooms, and recent boards. Help works with mouse, keyboard, and touch without covering inputs.\n- Transfer 1.0.14 clears unsent drafts when leaving a room, keeps uploads running when the page becomes hidden, and handles pause and resume consistently. A failed startup can be retried.\n- The mobile Home gesture starts only on its indicator and stays disabled during typing or dialogs. Fast navigation cancels outdated motion.\n\n## Reliability and maintenance\n\n- Nonessential analytics failures no longer block registration or login.\n- Session, cleanup, and content migration services are separated. Cleanup proceeds in bounded batches and remains retryable after failure.\n- First-party code receives consistent static checks. Release validation compares the deployed commit and asset hashes so an old deployment cannot pass as the new release.\n"
      },
      ja: {
        title: "サイト全体の使いやすさと信頼性を改善",
        summary: "歓迎画面を任意表示にし、ツールと画板の入口を整理しました。モバイル操作を安定させ、Knowledgeの全件ページングと検索、転送の下書き・バックグラウンド送信、公開バージョン確認を改善しています。",
        content_markdown: "# サイト全体の使いやすさと信頼性を改善\n\nレスポンシブ表示、見た目、操作、コードの信頼性を全体的に見直しました。デスクトップの XP・ピクセル調と、スマホ専用のレイアウトは維持しています。\n\n## 読む・移動する\n\n- 歓迎画面はホームの「ようこそ・最近の更新」から任意で開けます。記事への直リンクを自動ダイアログで遮りません。\n- Knowledge にページングと公開記事全体を対象としたサーバー検索を追加しました。カテゴリ件数を全件で集計し、同じタグの重複表示をなくしました。\n- 記事リンクで Control／Command クリックなどの標準的な新規タブ操作が使えます。\n\n## ツールとモバイル\n\n- ツールカードは用途を先に説明し、バージョンと技術説明を折りたたみました。動画の内枠をなくし、見出し・概要・日時・再生操作の配置を整えました。\n- 画板 1.0.10 は名前、公開ルーム、合言葉ルーム、最近のボードを整理しました。ヘルプはマウス・キーボード・タッチで利用でき、入力を覆いません。\n- 一時転送 1.0.14 は退室時に未送信の下書きを消去し、ページが隠れてもアップロードを自動中断しません。一時停止と再開、起動失敗後の再試行も改善しました。\n- ホームへ戻るジェスチャーは専用インジケーターからのみ開始します。入力中やダイアログ表示中は無効になり、素早い移動で古いアニメーションが残りません。\n\n## 信頼性と保守\n\n- 補助的なアクセス集計の失敗が登録・ログインを妨げないようにしました。\n- セッション、削除処理、コンテンツ移行を独立したサービスへ分離しました。削除は制限付きのバッチで継続し、失敗時も再試行できます。\n- 自作コードの静的検査を統一し、公開されたコミットと資産ハッシュを照合して古い公開版の誤認を防ぎます。\n"
      },
    }, "2026-09-07T23:00:00.000Z", "2026-09-07T23:00:00.000Z", { insertOnly: true }),
    env.DB.prepare(`
    insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values (
      'seed-update-2026-09-22-cloud-save-10min',
      '2026-09-22-cloud-save-10min',
      'site-updates',
      '["网站更新","游戏区","云存档","可靠性"]',
      '',
      'published',
      0,
      0,
      '2026-09-21T16:24:26.443Z',
      '2026-09-21T16:24:26.443Z',
      '2026-09-21T16:24:26.443Z'
    ) on conflict(article_id) do nothing
    `),
    ...articleTranslationsStatements(env, "seed-update-2026-09-22-cloud-save-10min", {
      zh: {
        title: "游戏云存档调整为每10分钟同步",
        summary: "登录后的游戏自动云同步由30秒调整为10分钟，减少长时间挂机产生的 Cloudflare 请求和 D1 写入；手动“立即同步”和切出页面时的补同步保持不变。",
        content_markdown: "# 游戏云存档调整为每10分钟同步\n\n游戏本地存档仍由浏览器和游戏本体持续保存，只有上传到账号云端的自动同步频率发生变化。\n\n## 本次调整\n\n- 登录后的自动云同步由每30秒一次改为每10分钟一次。\n- 点击“立即同步”仍会立刻尝试上传，不需要等待下一轮计时。\n- 页面切到后台时仍会刷新游戏本地存档并尝试补同步。\n- 云端版本冲突检测、JSON导入导出和本地存档均保持不变。\n\n这项调整主要减少长时间挂机产生的 Pages Functions 请求与 D1 写入，同时继续保留手动同步和离开页面时的保护。"
      },
      en: {
        title: "Game Cloud Saves Now Sync Every 10 Minutes",
        summary: "Signed-in games now auto-sync to the cloud every 10 minutes instead of every 30 seconds, reducing Cloudflare requests and D1 writes during long sessions. Manual Sync Now and the page-hide sync remain immediate.",
        content_markdown: "# Game Cloud Saves Now Sync Every 10 Minutes\n\nGames continue to save locally through the browser and their own save logic. Only the automatic upload cadence for account cloud saves has changed.\n\n## What changed\n\n- Signed-in automatic cloud sync now runs every 10 minutes instead of every 30 seconds.\n- Selecting Sync Now still attempts an upload immediately without waiting for the timer.\n- Moving the page to the background still flushes the local game save and attempts an extra sync.\n- Cloud-version conflict handling, JSON import/export, and local saves are unchanged.\n\nThis reduces Pages Functions requests and D1 writes during long-running sessions while retaining manual and page-exit protection."
      },
      ja: {
        title: "ゲームのクラウド保存を10分間隔に変更",
        summary: "ログイン中のゲームの自動クラウド同期を30秒から10分間隔へ変更し、長時間プレイ時のCloudflareリクエストとD1書き込みを削減しました。手動同期とページを離れる際の補助同期は従来どおり即時です。",
        content_markdown: "# ゲームのクラウド保存を10分間隔に変更\n\nゲーム本体とブラウザーによるローカル保存はこれまでどおり継続します。変更したのは、アカウントのクラウド保存へ自動アップロードする間隔だけです。\n\n## 変更内容\n\n- ログイン中の自動クラウド同期を30秒ごとから10分ごとへ変更しました。\n- 「今すぐ同期」はタイマーを待たず、引き続き即座にアップロードを試みます。\n- ページがバックグラウンドへ移る際も、ローカル保存を更新して補助同期を試みます。\n- クラウド版の競合処理、JSONの入出力、ローカル保存は変更していません。\n\n長時間プレイ時のPages FunctionsリクエストとD1書き込みを減らしながら、手動同期とページ離脱時の保護を維持します。"
      }
    }, "2026-09-21T16:24:26.443Z", "2026-09-21T16:24:26.443Z", { insertOnly: true })
  ];
}
