// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-25-cold-open-pipeline-r94",
      "slug": "2026-11-25-cold-open-pipeline-r94",
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
        "zh": "全站冷开管线级根治：开机静默预热＋开窗 Ready-Gate＋全站零多余加载框（r94）",
        "en": "Systemic Cold-Open Pipeline Fix: Boot Pre-Warming, Ready-Gate & Zero Transient Loading Boxes (r94)",
        "ja": "全サイト冷起動パイプライン根治：起動時プリウォーム＋Ready-Gate＋不要ローディング枠撤廃（r94）"
      },
      "summary": {
        "zh": "按全量冷开审计结果从管线层根治冷开与热开不一致：开机 60ms 内并行预加载全部 7 个动态路由/数据 ES 模块并主动解码关于/聊天室头像、社交图标与工具 SVG；开窗前引入 Ready-Gate 等待内容与图片落定再发出第 0 帧飞窗（热开 0ms 零延迟）；统一消除全站冷开期一切多余加载框与骨架屏（含关于窗「正在检查社交链接…」行），冷开全程零位移、第 0 帧即终态。",
        "en": "Fixed cold-open vs warm-open inconsistencies at the pipeline level: silently pre-warms all 7 dynamic route/data ES modules and eagerly decodes About/Chatroom avatars, social icons, and Tools SVGs during the 1.4s boot warm-up; gates cold window morphs until content and images settle (0ms overhead on warm open); and eliminates all transient loading boxes/skeletons (including About's 'Checking social links...' row) so Frame 0 is the final settled state.",
        "ja": "冷起動監査の結果に基づきパイプライン層で根治：起動 60ms 以内に全 7 動的ルート／データ ES モジュールとアバター・SNS・ツール SVG を並列プリウォーム＆先行デコードし、開窓前に Ready-Gate でコンテンツと画像確定を待ってから第 0 フレームを表示（温起動は 0ms）。About の「ソーシャルリンクを確認中…」行を含む不要なローディング枠とスケルトンを全サイトで一掃し、初回からズレゼロの終端表示を実現しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-unclipped-halo-layer-r93",
      "slug": "2026-11-25-unclipped-halo-layer-r93",
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
        "zh": "液态玻璃外发光结构性根治：恢复完整光晕＋顶层无裁切光晕层（r93）",
        "en": "Structural Unclipped Glass Halo Layer: Full-Strength Outer Glow Restored (r93)",
        "ja": "液態ガラス外光の構造的根治：フル強度光彩復元＋最上位非クリップ層（r93）"
      },
      "summary": {
        "zh": "撤回 r92 对全站共享外发光的收紧处理，完整恢复收紧前的原始光晕范围与强度（悬停 14px / 0.32、按住 20px / 0.56、释放波沿边 22px / 0.76）；改由挂载在 document.body 的顶层无裁切代理层 #crt-glass-halo-layer 按按钮实时位置与圆角对齐绘制外光晕，彻底摆脱卡片与滚动容器 overflow:hidden 的直线硬裁切，欢迎窗 MengTo 试点保持不变。",
        "en": "Reverted r92's tightened outer glow radii and restored full original design values (14px hover, 20px hold, 22px rim-catch) rendered via a top-level unclipped #crt-glass-halo-layer mounted on document.body aligned pixel-for-pixel to active button bounds, eliminating card and scroll-container straight-line clipping with zero idle overhead while leaving the Welcome MengTo pilot untouched.",
        "ja": "r92 の外光縮小を撤回し、本来の光彩強度（ホバー 14px／押下 20px／縁反射 22px）を完全復元。document.body 直下の最上位非クリップ層 #crt-glass-halo-layer でアクティブボタン位置に完全同期描画する構造改修により、カードやスクロール領域の overflow:hidden による直線切れを根治しました（ようこそ画面パイロットは変更なし）。"
      }
    },
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
    }
  ]
});
