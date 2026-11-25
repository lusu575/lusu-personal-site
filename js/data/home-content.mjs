// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-25-mengto-edge-cold-r92",
      "slug": "2026-11-25-mengto-edge-cold-r92",
      "category": "site-updates",
      "tags": [
        "ui",
        "glass",
        "pond"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-25",
      "updated_at": "2026-11-25",
      "published_at": "2026-11-25",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "欢迎窗 MengTo 液态玻璃重做＋全站光效边缘切层消除＋冷开跳位根治（r92）",
        "en": "MengTo Liquid-Glass Welcome Pilot Rework, Site-Wide Edge Cut Fix & Cold-Open Consistency (r92)",
        "ja": "ようこそ画面 MengTo 液態ガラス刷新・全サイト縁切れ解消・冷起動跳ね根治（r92）"
      },
      "summary": {
        "zh": "严格按 MengTo 原规格重做欢迎窗 4 颗快捷按钮试点（透明中心玻璃面、外唇掠射边缘反射、按住平滑高斯凹陷、750ms 半透明波峰与尾迹释放波，彻底移除造成直线切框的 SVG 滤镜与横切渐变）；收紧全站共享玻璃外阴影消除父容器裁剪直线切边；冷开期彻底隐藏 .route-module-status.is-loading 并锁定游戏/工具/关于窗口桌面 min-height，消除全新配置禁用缓存下的冷开跳位。",
        "en": "Rebuilt the 4 Welcome quick-link pilot buttons strictly to MengTo's liquid-glass spec (clear flat center, grazing perimeter rim reflection, smooth Gaussian hold dimple, 750ms translucent crest + wake release wave; removed clipped SVG displacement & horizontal seam), tightened shared outer glass glow radii site-wide to eliminate straight-line parent clipping, and locked cold-open window heights while hiding .route-module-status.is-loading in Pond mode.",
        "ja": "ようこそ画面 4 ボタンを MengTo 原仕様準拠（透明な中心面・外縁かすめ反射・押下ガウス凹み・750ms 波峰＋尾引きリリース波）へ刷新し直線切れの原因だった SVG フィルタと横段差を撤去。全サイト共通のガラス外光半径を最適化して親要素クリッピングによる直線切れを解消し、冷起動時のモジュール読込枠非表示とゲーム／ツール／About 最小高さ固定で初回跳ねを根治しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-refresh-boot-warm-r91",
      "slug": "2026-11-25-refresh-boot-warm-r91",
      "category": "site-updates",
      "tags": [
        "pond",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-25",
      "updated_at": "2026-11-25",
      "published_at": "2026-11-25",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "启动动画补齐刷新触发：首次打开、F5 刷新与硬刷新均完整显影（r91）",
        "en": "Play Persepolis CRT Warm-Up on Every Full Page Load & Refresh (r91)",
        "ja": "リロード時も起動顕像を再生：初回・F5・ハードリロードすべて対応（r91）"
      },
      "summary": {
        "zh": "移除同会话 sessionStorage 仅播一次拦截，改为每次完整页面加载（首次打开、F5 刷新、硬刷新）均播放 r87 Persepolis 式由暗到亮显影；仅浏览器前进/后退缓存恢复与 prefers-reduced-motion 直达终态，其余参数与 2.5s 墙钟兜底、点击/任意键跳过保持不变。",
        "en": "Removed the once-per-session sessionStorage gate so every full page load (initial open, F5 refresh, hard refresh) plays the r87 Persepolis dark-to-bright CRT warm-up while back/forward cache restores and prefers-reduced-motion remain instant.",
        "ja": "sessionStorage による 1 セッション 1 回制限を解除し、初回表示・F5 リロード・ハードリロードのすべてで r87 の暗転から点灯するウォームアップ演出を再生するようにしました（戻る／進むキャッシュ復元と prefers-reduced-motion のみ即時終端表示）。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-cold-open-consistency-r90",
      "slug": "2026-11-25-cold-open-consistency-r90",
      "category": "site-updates",
      "tags": [
        "ui",
        "pond",
        "performance"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-25",
      "updated_at": "2026-11-25",
      "published_at": "2026-11-25",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "开窗管线系统性收口：消除刷新后冷开与热开不一致（r90）",
        "en": "Systemic Window-Open Pipeline Fix: Cold-Open vs Warm-Open Consistency (r90)",
        "ja": "ウィンドウ起動パイプライン統一：初回冷起動とキャッシュ再起動の差異解消（r90）"
      },
      "summary": {
        "zh": "在开窗管线层统一根治刷新后首开与有缓存再开的不一致：开窗测量前强制同步排版并取消目标窗与父容器的旧版竞争动画，空闲帧预解码关于/聊天室头像并锁定比例，消除关于窗首开先偏下再弹回；将「正在打开应用模块...」占位改造为无边框透明风格并延迟 260ms 渐显，彻底消除聊天室等窗口冷开闪现突兀板块。",
        "en": "Fixed cold-open vs warm-open inconsistencies at the window-morph pipeline level: synchronous layout settle and parent/window WAAPI cancellation before measurement, idle eager avatar pre-decoding with locked 1:1 aspect-ratio (eliminating About downward shift/snap), synchronous Welcome greeting before mount, and a borderless 260ms-delayed .route-module-status placeholder (eliminating Chatroom's jarring loading box flash).",
        "ja": "リロード直後の初回起動と再起動の挙動差をパイプライン層で根治。計測前の同期レイアウト確定と親／ウィンドウ競合 WAAPI 抑止、About／チャットのアバター事前デコードと比率固定により初回ズレ跳ね戻りを解消し、モジュール読込中の枠表示を透明＋260ms 遅延フェード化してチャット室等の違和感ある枠点滅をなくしました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-glass-click-parity-r89",
      "slug": "2026-11-25-glass-click-parity-r89",
      "category": "site-updates",
      "tags": [
        "ui",
        "glass",
        "pond"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-25",
      "updated_at": "2026-11-25",
      "published_at": "2026-11-25",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "液态玻璃质感升级试点（欢迎窗真光学折射）＋全站动态主按钮点击特效补齐（r89）",
        "en": "MengTo Optical Liquid-Glass Pilot (Welcome Modal) & Site-Wide Dynamic Button Parity (r89)",
        "ja": "液態ガラス光学パイロット（ようこそ画面）＆動的メインボタン演出統一（r89）"
      },
      "summary": {
        "zh": "先在欢迎窗 4 个快捷按钮试点升级至对标 MengTo 预览的真液态玻璃光学质感（按压期启用 SVG feDisplacementMap 边缘折射位移＋RGB 轻色散、双反相凸面流动高光、按压 3D 弹性形变与高弹释放波，静置零开销）；同时补齐知识库「阅读」、游戏「开始」、工具「打开」等全站动态主按钮至 r76 同强度完整点击特效。",
        "en": "Upgraded the 4 Welcome modal quick-link buttons as a pilot to true MengTo optical liquid-glass (on-demand SVG feDisplacementMap rim refraction + RGB split, dual counter-moving specular lobes, elastic 3D press deformation, bouncy release wave, zero idle GPU cost), and brought all dynamic primary buttons (Knowledge Read, Game Start, Tool Open) to full r76 press/wave parity.",
        "ja": "ようこそ画面の 4 つのクイックボタンをパイロットとして MengTo 準拠の光学液態ガラス（押下時のみ有効な SVG feDisplacementMap 縁屈折・RGB 分散・双方向ハイライト流動・3D 弾性変形・高弾性リリース波、静止時負荷ゼロ）へ刷新し、知識庫「読む」・ゲーム「開始」・ツール「開く」等の動的ボタンも r76 同等の完全演出へ統一しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-glass-auto-binding-r88",
      "slug": "2026-11-25-glass-auto-binding-r88",
      "category": "site-updates",
      "tags": [
        "ui",
        "glass",
        "pond"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-25",
      "updated_at": "2026-11-25",
      "published_at": "2026-11-25",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "液态玻璃全站动态自动绑定根治：补齐知识库列表、游戏开始与全窗动态按钮（r88）",
        "en": "Site-Wide Automatic CRT Glass Binding: Knowledge List, Game Start & All Dynamic Controls (r88)",
        "ja": "CRT 液態ガラスの動的自動バインド根治：知識庫一覧・ゲーム開始・全動的ボタン網羅（r88）"
      },
      "summary": {
        "zh": "根治旧版静态白名单导致的液态玻璃漏绑问题：补齐知识库文章卡片与「阅读」按钮、游戏区「开始」与「来源」按钮、工具区「打开」按钮、欢迎窗「查看更多更新」与最近更新条目、视频/工具筛选按钮、聊天室帮助键、关于页社交图标与账号「显示密码」键，并升级为统一语义规则＋捕获期事件委托＋全局 MutationObserver 双重自动绑定机制。",
        "en": "Replaced the brittle static selector whitelist with unified semantic glass rules, capturing lazy event delegation, and a rAF-debounced MutationObserver so dynamically rendered controls (Knowledge article cards & Read CTA, Game Start & Source buttons, Tool Open buttons, Welcome More/Updates, Video/Tool filters, Chat help, About social links, Account password toggles) always bind automatically with zero leaks.",
        "ja": "従来の静的ホワイトリストによる漏れを根治し、統一セマンティック規則＋キャプチャ委譲＋MutationObserver の二重自動バインドへ刷新。知識庫記事カードと「読む」、ゲーム「開始」、ツール「開く」、ようこそ画面の更新項目・動画フィルタ・チャットヘルプ・SNS・パスワード表示ボタンまで完全網羅しました。"
      }
    }
  ]
});
