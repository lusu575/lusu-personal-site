// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-24-window-morph-step2-gate",
      "slug": "2026-11-24-window-morph-step2-gate",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "animation",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T10:28:00+08:00",
      "updated_at": "2026-11-24T10:28:00+08:00",
      "published_at": "2026-11-24T10:28:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "窗口打开动画重构：纯色矩形几何扩张最小验证门槛上线",
        "en": "Window Animation Rebuild: Step 2 Pure-Rectangle Geometry Gate",
        "ja": "ウィンドウ開閉アニメーション再構築：ステップ2 純色矩形検証ゲート公開"
      },
      "summary": {
        "zh": "按 Matched Geometry Shell Transition 技术方案启动窗口动画重构：完成 r61 冲突基线诊断，上线独立过渡层的纯深色圆角矩形 1000ms 线性几何验证门槛，待验收后进入后续阶段。",
        "en": "Started the Matched Geometry Shell Transition rebuild: completed r61 WAAPI/CSS conflict diagnosis and deployed the Step 2 independent pure dark rounded-rectangle 1000ms linear expansion gate.",
        "ja": "Matched Geometry Shell Transition 方針に基づき r61 の競合診断を完了し、独立オーバーレイ層でアイコン矩形からウィンドウ矩形へ 1000ms 線形拡張するステップ2 検証ゲートを公開しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-chat-shift-enter-newline",
      "slug": "2026-11-23-pond-chat-shift-enter-newline",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "chatroom",
        "ux"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T20:48:00+08:00",
      "updated_at": "2026-11-23T20:48:00+08:00",
      "published_at": "2026-11-23T20:48:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "聊天室 Shift+Enter 换行兜底修复与输入法防误发保持",
        "en": "Chatroom Shift+Enter Newline Fallback Fix",
        "ja": "チャット入力欄の Shift+Enter 改行フォールバック修正"
      },
      "summary": {
        "zh": "修复部分浏览器及快捷键环境下聊天室按 Shift+Enter 未插入换行的问题：全程不阻断默认换行，并在宿主未自动插入时补齐单次换行，同时保持普通 Enter 发送与中文输入法防误发。",
        "en": "Ensured Shift+Enter reliably inserts a single newline across browsers and automated key dispatch without calling preventDefault, while preserving plain Enter send and IME composition safety.",
        "ja": "一部環境でチャット入力欄の Shift+Enter 改行が反映されない問題を修正しました。既定の改行動作を阻害せず未挿入時のみ1回改行を補完し、通常 Enter 送信と IME 誤送信防止を維持します。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-chat-enter-send-ime",
      "slug": "2026-11-23-pond-chat-enter-send-ime",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "chatroom",
        "ux"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T20:36:00+08:00",
      "updated_at": "2026-11-23T20:36:00+08:00",
      "published_at": "2026-11-23T20:36:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "聊天室支持回车直接发送、Shift+Enter 换行与中文输入法防误发",
        "en": "Chatroom Enter-to-Send, Shift+Enter Newline & IME Composition Guard",
        "ja": "チャット入力欄の Enter 送信・Shift+Enter 改行と IME 変換誤送信防止"
      },
      "summary": {
        "zh": "聊天室输入框现在按 Enter 即可直接发送消息，按 Shift+Enter 换行；内置四重中文输入法组合态保护，拼音选词按回车确认绝不误发，限速与字数规则不变。",
        "en": "Pressing Enter in the chatroom input now sends the message while Shift+Enter inserts a newline, with full IME composition protection so confirming CJK candidates never submits prematurely.",
        "ja": "チャット入力欄で Enter キーによる直接送信と Shift+Enter での改行に対応しました。日本語・中国語 IME 変換確定時の Enter で誤送信しない多重ガードを備えています。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-window-spring-open-close",
      "slug": "2026-11-23-pond-window-spring-open-close",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "animation",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T20:24:00+08:00",
      "updated_at": "2026-11-23T20:24:00+08:00",
      "published_at": "2026-11-23T20:24:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "全站板块窗口 120 FPS 阻尼弹簧开合动画上线",
        "en": "120 FPS Damped Spring Window Open & Close Animation",
        "ja": "全セクションウィンドウ 120 FPS 減衰バネ開閉アニメーション実装"
      },
      "summary": {
        "zh": "点击首页图标、顶部欢迎入口或移动端底部 Dock 图标时，板块窗口从图标原位以二阶阻尼弹簧生长展开，关闭时镜像收回图标；纯合成层驱动稳住 120 FPS 且全程可打断。",
        "en": "Section windows now spring open smoothly from their desktop or mobile Dock icon origin and retract symmetrically on close using pure compositor transform/opacity at 120 FPS.",
        "ja": "ホームの各アイコンやモバイル Dock からウィンドウがバネ物理で滑らかに展開し、閉じる際は元のアイコンへ反転収納される 120 FPS 開閉アニメーションを実装しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-chat-input-scrollbar",
      "slug": "2026-11-23-pond-chat-input-scrollbar",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "chatroom",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T20:20:00+08:00",
      "updated_at": "2026-11-23T20:20:00+08:00",
      "published_at": "2026-11-23T20:20:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "聊天室输入框荧光细滚动条统一与发送按钮防重叠修复",
        "en": "Chatroom Input Phosphor Scrollbar & Send Button Overlap Fix",
        "ja": "チャット入力欄の蛍光細スクロールバー統一と送信ボタン重なり修正"
      },
      "summary": {
        "zh": "将聊天室输入框滚动条统一为深青荧光细条样式，隔离输入域与右侧字数统计及圆形发送按钮的弹性布局，彻底消除旧版白色滚动条遮挡按钮的问题。",
        "en": "Unified the chatroom textarea scrollbar with the dark phosphor thin scrollbar style and isolated the input field from the counter and circular send button to prevent overlap.",
        "ja": "チャット入力欄のスクロールバーをサイト統一の深青蛍光細スタイルへ刷新し、文字数表示と丸型送信ボタンとの重なりを解消しました。"
      }
    }
  ]
});
