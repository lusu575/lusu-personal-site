// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-23-pond-crt-boot-preloader",
      "slug": "2026-11-23-pond-crt-boot-preloader",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T15:00:00+08:00",
      "updated_at": "2026-11-23T15:00:00+08:00",
      "published_at": "2026-11-23T15:00:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "纯代码 CRT 进站启动动画与全站 32 项素材预加载上线",
        "en": "Pure-Code CRT Pond Boot Sequence & 32-Asset Site-Wide Preloader",
        "ja": "純コード CRT 起動アニメーションと全サイト 32 素材プリロード実装"
      },
      "summary": {
        "zh": "交互与动画专项第一项上线：纯代码复用池塘自身 WebGL2 CRT 管线绘制无边框荧光亮线展开与分层显影，从冷加载第 0 帧接管画面，启动期间并行预加载并解码全站 32 项素材，结尾无缝交接首页本体。",
        "en": "Animation Phase Item 1: pure-code borderless CRT power-on beam reusing the live WebGL2 Pond pipeline, taking over from Frame 0 on cold load while preloading and decoding all 32 site assets with seamless final-frame handoff.",
        "ja": "アニメーション強化第1弾：動画を使わず池本体の WebGL2 CRT パイプラインで起動演出を生成し、初回ロード0フレーム目から黒画面を防止。全32素材を並列プリロード＆デコードし、最終フレームがそのままホームへシームレス接続します。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-game-covers-webp-zero-flash",
      "slug": "2026-11-23-pond-game-covers-webp-zero-flash",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T14:37:00+08:00",
      "updated_at": "2026-11-23T14:37:00+08:00",
      "published_at": "2026-11-23T14:37:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "游戏封面 WebP 瘦身 93 倍、下架旧彩色图标与全站首帧防闪跳",
        "en": "93x Smaller WebP/SVG Game Covers, Legacy Icon Removal & Zero-Flash First Paint",
        "ja": "ゲーム表紙 WebP 93倍軽量化・旧カラーアイコン撤去と初回描画ちらつき解消"
      },
      "summary": {
        "zh": "将游戏区封面从 5.53 MB PNG 压缩为 59.3 KB WebP 与独立 SVG，目录配置直指新版封面并彻底删除 5 张旧彩色 PNG，同时加入首帧同步模式初始化脚本消除页面闪跳。",
        "en": "Compressed game covers from 5.53 MB PNGs into 59.3 KB WebP and standalone SVGs, updated games/catalog.json directly, removed 5 legacy colorful PNG icons, and added synchronous head mode initialization to prevent first-frame layout flashes.",
        "ja": "ゲーム表紙を 5.53 MB PNG から 59.3 KB WebP と独立 SVG へ圧縮し、catalog.json を新版へ直結・旧カラー PNG 5枚を完全削除。head 同期初期化で初回フレームのレイアウトちらつきも解消しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-toc-webp-cursor-close-hover",
      "slug": "2026-11-23-pond-toc-webp-cursor-close-hover",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T14:27:00+08:00",
      "updated_at": "2026-11-23T14:27:00+08:00",
      "published_at": "2026-11-23T14:27:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "文章目录跳转修复、四季装饰 WebP 提速 34 倍、回归原生光标与关闭键悬停零漂移",
        "en": "Article TOC Jump Fix, 34.7x Smaller WebP Seasonal Flora, Native Cursor & Zero-Drift Close Hover",
        "ja": "記事目次ジャンプ修正・季節装飾 WebP 34倍軽量化・標準カーソル復元・閉じるボタンホバー固定"
      },
      "summary": {
        "zh": "修复文章左侧目录点击不跳转；将 12 张四季装饰图从 21.81 MB PNG 压缩为 642.7 KB WebP 并按当前季节优先加载；移除旧自定义光标回归系统原生指针；修复窗口关闭键悬停时叉号偏移问题。",
        "en": "Fixed Article TOC click scrolling inside .article-detail-card, compressed 21.81 MB seasonal PNGs into 642.7 KB WebP with active-season priority loading, removed legacy custom cursors in favor of native OS cursors, and locked close-button hover optical centering.",
        "ja": "記事左目次のクリック遷移を修正し、季節装飾12点を 21.81 MB PNG から 642.7 KB WebP へ圧縮・現季節優先読込に変更。旧カスタムカーソルを撤去しシステム標準へ統一、閉じるボタンのホバー時ズレも解消しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-final-polish-r52-r54",
      "slug": "2026-11-23-pond-final-polish-r52-r54",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T10:45:00+08:00",
      "updated_at": "2026-11-23T10:45:00+08:00",
      "published_at": "2026-11-23T10:45:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "全站细节收尾汇总（货架许可证/聊天室前缀/画板 1.0.13/日语页居中/互传防断词）",
        "en": "Final Polish Rollup (r52–r54): Games License, Chat Prefix, Whiteboard 1.0.13, Trainer Centering & Transfer Line Breaks",
        "ja": "最終細部調整まとめ（r52–r54）：ゲーム表記・チャット同期・画板 1.0.13・日本語中央配置・一時転送改行制御"
      },
      "summary": {
        "zh": "汇总上线 r52–r54 收尾优化：彻底消除游戏货架窄卡「源」字裁切与聊天室同步前缀叠字，画板升版 1.0.13 消除卡片空白与加深画布提示底，日语页垂直居中，提亮知识库底部计数行，并修复临时互传简介「登录后」「24 小时」断行孤字。",
        "en": "Consolidated r52–r54 polish: eliminated narrow Games card license clipping and Chat sync prefix overlap, bumped Whiteboard to 1.0.13 with balanced cards and dark canvas hint backdrop, centered Japanese Subtext vertically, brightened Knowledge footer count, and bound Transfer description line breaks.",
        "ja": "r52–r54 の仕上げ調整を統合：ゲーム一覧のライセンス見切れとチャット同期表記の重なりを解消、ホワイトボードを 1.0.13 へ更新し余白とヒント背景を反映、日本語ページを縦中央配置、知識庫下部の件数表示を明るくし、一時転送紹介文の途中改行を防止しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-source-level-final-polish",
      "slug": "2026-11-23-pond-source-level-final-polish",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T09:32:00+08:00",
      "updated_at": "2026-11-23T09:32:00+08:00",
      "published_at": "2026-11-23T09:32:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "全站源头级视觉与交互收口（游戏壳层/互传/登录/聊天室/文章/画板/日语页）",
        "en": "Site-Wide Source-Level Polish (Games, Transfer, Login, Chat, Reader, Whiteboard & Trainer)",
        "ja": "全サイト根本修正（ゲーム・一時転送・ログイン・チャット・記事・ホワイトボード・日本語）"
      },
      "summary": {
        "zh": "同步 5 款游戏壳层缓存版本并消除猫国进门 Oops 闪现；修复人生重开两侧黑带、货架许可证裁切、聊天室同步前缀、登录窗全宽与去重、文章元信息去秒提亮、互传展开避让与徽章对比、画板卡片留白与日语页底空。",
        "en": "Synced game-shell cache across all 5 games, eliminated Kittens Game boot Oops flash, replaced Life Restart black side bands, fixed Games license clipping, Chat sync prefix, Login full-width button, Reader meta without seconds, Transfer panel overlap, Whiteboard card balance & Japanese Trainer spacing.",
        "ja": "全5ゲームのキャッシュ更新と Kittens Game 起動時 Oops 表示解消、Life Restart 左右黒帯改善、ライセンス見切れ・チャット同期表記・ログイン全幅・記事メタ秒数削除・一時転送重なり・ホワイトボード余白・日本語ページ下余白を一括修正しました。"
      }
    }
  ]
});
