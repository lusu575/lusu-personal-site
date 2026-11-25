// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-11-25-persepolis-warm-boot-r87",
      "slug": "2026-11-25-persepolis-warm-boot-r87",
      "category": "site-updates",
      "tags": [
        "pond",
        "ui",
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
        "zh": "启动动画重做：Persepolis 式同场景由暗到亮显影（r87）",
        "en": "Persepolis-Style Single-Scene Dark-to-Bright CRT Warm-Up (r87)",
        "ja": "起動演出刷新：Persepolis 式・同一シーン暗転から点灯ウォームアップ（r87）"
      },
      "summary": {
        "zh": "整段下线 r84 亮线、光波与扫描线动画，改由单个全局 uWarm（0→1）驱动现有 CRT 后处理 Pass 的亮度、对比度、饱和度、RGB 收敛、Bloom 阈值与暗角，场景本身即为加载器；配真实关键进度、0.9–1.6s 节拍与 2.5s 墙钟硬兜底，点击或任意键即刻直达终态。",
        "en": "Replaced r84's bright line, radial wave, and scan beam with a single global uWarm (0->1) driving the existing CRT post-process pass (brightness, contrast, saturation overshoot, RGB convergence, bloom threshold, vignette). Driven by real critical load progress with a 0.9-1.6s envelope, 2.5s wall-clock failsafe, and instant click/key skip.",
        "ja": "r84 の輝線・波紋・走査光を完全撤去し、単一のグローバル uniform uWarm（0→1）で既存 CRT ポスト処理の輝度・コントラスト・彩度・RGB 収束・Bloom 閾値・ビネットを滑らかに駆動。実読み込み進捗＋0.9–1.6 秒制御＋2.5 秒強制フォールバックとクリック／任意キー即時スキップを備えます。"
      }
    }
  ]
});
