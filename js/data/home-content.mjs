// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-24-window-morph-steps3-8",
      "slug": "2026-11-24-window-morph-steps3-8",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "animation",
        "ui",
        "performance"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T10:52:00+08:00",
      "updated_at": "2026-11-24T10:52:00+08:00",
      "published_at": "2026-11-24T10:52:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "全站板块窗口 Matched Geometry Shell 开合动画正式上线",
        "en": "Matched Geometry Shell Window Open & Close Animation (Steps 3–8)",
        "ja": "全ウィンドウ Matched Geometry Shell 開閉アニメーション正式公開"
      },
      "summary": {
        "zh": "完成窗口开合动画第三至第八步重构：独立外壳层按解析二阶阻尼弹簧（开 480ms / 关 400ms）在六枚图标与真实窗口间连续形变，外壳与内容分层交接无闪烁，支持随时打断与 120 FPS 合成。",
        "en": "Completed the full Matched Geometry Shell window transition: independent L2 morph shell driven by analytic damped springs (open 480ms / close 400ms), 1:1 L3 content handoff, live icon re-measurement on close, and 120 FPS compositor discipline.",
        "ja": "ウィンドウ開閉アニメーションの第3〜第8ステップを完了しました。解析2次減衰バネ（開 480ms／閉 400ms）による独立シェル層と 1:1 実コンテンツ層の滑らかな引き継ぎ、割り込み対応、120 FPS 最適化を実現しています。"
      }
    },
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
    }
  ]
});
