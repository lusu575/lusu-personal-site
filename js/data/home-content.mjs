// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-11-23-pond-crt-glass-pilot",
      "slug": "2026-11-23-pond-crt-glass-pilot",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T18:15:00+08:00",
      "updated_at": "2026-11-23T18:15:00+08:00",
      "published_at": "2026-11-23T18:15:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "CRT 折射玻璃统一参数表与欢迎窗主按钮按压波纹试点上线",
        "en": "CRT Refractive Glass Unified Config & Welcome Modal Button Press Pilot",
        "ja": "CRT 屈折ガラス統一パラメータ表＆ようこそボタン波紋パイロット実装"
      },
      "summary": {
        "zh": "按 CRT 折射玻璃适配方案落地步骤 2–3：建立全站唯一权威玻璃与阻尼弹簧参数表，并在欢迎窗快捷按钮试点接触点高斯凹陷、320ms 非线性释放波与边缘吃光反馈，静默零重绘。",
        "en": "Implemented Steps 2–3 of the CRT Refractive Glass specification: single authoritative optical/spring token table and Welcome modal quick-link button pilot with off-center Gaussian indent, 320ms non-linear release wave, 70ms rim catch, and idle-stop.",
        "ja": "CRT 屈折ガラス仕様のステップ 2–3 を反映：光学・バネ物理の単一パラメータ定義を作成し、ようこそ画面ボタンで接触点ガウス凹み・320ms 非線形リリース波・縁発光をパイロット実装しました。"
      }
    }
  ]
});
