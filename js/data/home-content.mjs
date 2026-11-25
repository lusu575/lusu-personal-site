// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-25-continuous-glass-curve-r96",
      "slug": "2026-11-25-continuous-glass-curve-r96",
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
        "zh": "消除按钮点击频闪与亮度跳变：单波单次触发＋全程连续液态亮度曲线（r96）",
        "en": "Eliminate Button Click Strobe & Brightness Jumps: One-Shot Wave + Continuous Liquid Luminance (r96)",
        "ja": "ボタンクリック点滅と輝度段差を根治：単発波ロック＋連続液態輝度カーブ（r96）"
      },
      "summary": {
        "zh": "定位并根治 r95 铺开后点击按钮「闪 3–4 下」的代码根因（750ms 释放波期间 160ms rimCatch 归零后被下一帧重复触发），新增单波一次性锁 rimCatchFired 压回严格 1 次；同时彻底消除分档开关式亮度跳变，将外光晕半径/透明度改为由弹簧与 320ms 升余弦连续驱动，释放波改由 smoothstep 零起点柔和展开，全程丝滑无闪。",
        "en": "Fixed the 3-4x click strobe bug caused by rimCatch resetting to 0 mid-wave during the 750ms MengTo release wave (added one-shot rimCatchFired guard), and replaced all discrete halo/border/wave brightness jumps with continuous spring + 320ms raised-cosine luminance curves and smoothstep wave onset.",
        "ja": "750ms 放出波中に 160ms の rimCatch がリセットされて 3–4 回連続再発火していた不具合を単発ロック rimCatchFired で根治。さらに外光・枠・放出波の段階的輝度ジャンプをすべて廃止し、スプリング＋320ms コサイン曲線と smoothstep 起動による連続的な液態輝度遷移へ統一しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-mengto-site-rollout-r95",
      "slug": "2026-11-25-mengto-site-rollout-r95",
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
        "zh": "MengTo 液态玻璃全站及子页统一铺开＋开机显影前桌面贴图全量就绪（r95）",
        "en": "Site-Wide & Subpage MengTo Liquid-Glass Rollout + Pre-Warmup Desktop Texture Readiness (r95)",
        "ja": "MengTo 液態ガラス全サイト＆サブページ展開＋起動顕像前のデスクトップ貼図事前確定（r95）"
      },
      "summary": {
        "zh": "按站长拍板将欢迎窗签收版 MengTo 液态玻璃特效（透明平坦中心面、外唇掠射高光、按住高斯凹陷、750ms 释放波＋r93 顶层无裁切完整光晕）铺开至全站所有按钮，并通过共享 standalone 层统一接入在线画板、日语的言外之意与全部 5 个游戏子页（零漏绑）；同时将开机显影 uWarm 起跳绑定至当季桌面贴图解码与 GPU 烘焙完成，消除显影中途贴图迟到弹出。",
        "en": "Rolled out the approved Welcome MengTo liquid-glass button spec (clear flat center, grazing rim reflection, smooth Gaussian hold dimple, 750ms crest+wake release wave, plus r93's unclipped top-level halo layer) to every button across the main site and all standalone subpages (Whiteboard, Japanese Subtext, all 5 game shells), and gated boot uWarm emergence on active-season desktop flora decode & GPU bake so zero textures pop in mid-warmup.",
        "ja": "承認済みのようこそ画面 MengTo 液態ガラス仕様（透明中心面・外唇かすめ反射・ガウス凹み・750ms 放出波＋r93 最上位非クリップ光彩）を全サイトおよび独立サブページ（画板・日本語の言外之意・全 5 ゲーム）へ統一展開し、起動顕像 uWarm を当季デスクトップ貼図のデコード＆GPU ベイク完了後に開始するよう改善しました。"
      }
    },
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
    }
  ]
});
