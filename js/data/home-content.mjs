// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-22-pond-visual-polish",
      "slug": "2026-11-22-pond-visual-polish",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui",
        "games"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T03:10:00+08:00",
      "updated_at": "2026-11-22T03:10:00+08:00",
      "published_at": "2026-11-22T03:10:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "深夜池塘视觉与交互综合修复：登录触发、季节粒子汇聚过渡、全窗统一与游戏内页换装",
        "en": "Midnight Pond Visual & Interaction Polish: Login Popover, Staged Season Vortex, Unified Windows & Game Inner Pages",
        "ja": "深夜の池ビジュアル＆操作総合修正：ログイン窓・季節粒子演出・全窓統一・ゲーム内ページ刷新"
      },
      "summary": {
        "zh": "修复左下角 ID 登录窗触发、重构两段式可打断季节粒子汇聚过渡、首屏直出零闪烁、统一全站居中窗口几何与加载态，并同步适配五个小游戏内页。",
        "en": "Fixed the bottom-left ID login popover trigger, rebuilt interruptible two-stage season particle transitions, eliminated cold-load legacy flash, unified centered window geometry and dark loading states, and themed all five game inner pages.",
        "ja": "左下のIDログイン窓修正、割り込み可能な二段階季節粒子演出、初回描画の旧画面チラつき解消、全ウィンドウ中央サイズ統一と暗色ロード状態、5つのゲーム内ページ刷新を実施しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-chat-mobile-polish",
      "slug": "2026-11-22-pond-chat-mobile-polish",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "修复记录",
        "聊天室",
        "移动端",
        "界面"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-21T18:51:00.000Z",
      "updated_at": "2026-11-21T18:51:00.000Z",
      "published_at": "2026-11-21T18:51:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "聊天室紧凑气泡、移动端防溢出与同日 D1 迁移收尾",
        "en": "Compact CRT Chat Bubbles, Mobile Overflow Fix, and Same-Day D1 Migration Record",
        "ja": "チャット吹き出し最適化・モバイル横はみ出し解消・D1移行記録"
      },
      "summary": {
        "zh": "补齐 02:31 线上收尾记录并同步完成精修：聊天室消息改为紧凑点阵气泡并放大提亮 6 枚点阵圆形 SVG 头像；移动端知识库全链路钳制宽度消除横向溢出并统一深色标签与阅读按钮；同步登记同日 D1 种子迁移前序版本。",
        "en": "Completes the release record and final polish: compact fit-content CRT chat bubbles with larger brighter dot-matrix SVG avatars, full mobile width clamping with dark tag/button styling to eliminate horizontal overflow, and same-day D1 migration compatibility.",
        "ja": "02:31修正の更新記録と最終調整を反映しました。チャットのコンパクト吹き出し化と42pxドットアバター発光、モバイル知識庫の横はみ出し解消と濃色タグ/ボタン化、同日D1移行互換を完了しています。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-live-fix",
      "slug": "2026-11-22-pond-live-fix",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "修复记录",
        "移动端",
        "界面"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-21T18:22:00.000Z",
      "updated_at": "2026-11-21T18:22:00.000Z",
      "published_at": "2026-11-21T18:22:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "修复生产环境池塘视觉桥接加载与手机端/欢迎窗/关于页样式",
        "en": "Fix Production Pond Bridge Module Import and Mobile / Welcome / About Visual Polish",
        "ja": "本番環境の池塘ブリッジ読み込み修正とモバイル・歓迎窓・概要の表示改善"
      },
      "summary": {
        "zh": "修复线上 dist 生产构建中 season-schedule.mjs 引用未单独导出的 /js/core/wallpaper-time.mjs 导致桥接脚本未执行的问题，并同步修复手机端知识库白底与横向溢出、欢迎窗文字对比度与 Esc 提示、关于页暗色社交图标。",
        "en": "Inlined the time-based wallpaper schedule helpers into season-schedule.mjs so production dist/ loads the Pond CRT bridge cleanly, and fixed mobile inner dark-glass surfaces & overflow, Welcome text contrast & Esc hint, and About social icon contrast.",
        "ja": "本番distで未出力の/js/core/wallpaper-time.mjs参照によるブリッジ停止を解消し、モバイル内層のダークガラス化と横はみ出し修正、歓迎窓の文字コントラストとEsc案内、概要ページのSNSアイコン視認性を改善しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-mobile-polish",
      "slug": "2026-11-22-pond-mobile-polish",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "移动端",
        "界面"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-21T18:05:00.000Z",
      "updated_at": "2026-11-21T18:05:00.000Z",
      "published_at": "2026-11-21T18:05:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "手机端深夜池塘视觉统一与全站 CRT 细节收尾",
        "en": "Mobile Shell Visual Unification and Site-Wide CRT Final Polish",
        "ja": "モバイル版ビジュアル統一と全サイトCRT最終仕上げ"
      },
      "summary": {
        "zh": "逐步视觉替换第 8 批（收官批）上线：手机端统一换装深夜池塘深色玻璃配色，保留 44px 触控区、六入口 Dock 与原有排版；同步完成文章阅读进度条加粗、黄虚线摘要框与工具卡图标放大提亮收尾。",
        "en": "Batch 8 (final batch) of the visual refresh is live: the mobile shell adopts the Midnight Pond dark glass palette while preserving 44px touch targets and the 6-route Dock, alongside final desktop polish for the Article progress bar, yellow-dotted summary box, and larger brighter Tool SVG icons.",
        "ja": "段階的ビジュアル刷新の第8弾（最終回）を公開しました。モバイル版を深夜池塘ダークガラス配色へ統一し、44pxタッチ領域と6入口Dockを維持。記事進捗バー・黄点線要約枠・ツールアイコン拡大発光も仕上げました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-about-login-welcome",
      "slug": "2026-11-22-pond-about-login-welcome",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "欢迎窗",
        "账号",
        "界面"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-21T18:02:00.000Z",
      "updated_at": "2026-11-21T18:02:00.000Z",
      "published_at": "2026-11-21T18:02:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "关于、登录浮层与欢迎窗换装深夜终端 CRT 视觉",
        "en": "About, Account Login, and Welcome Modal Refreshed with Midnight Pond CRT Visuals",
        "ja": "概要・ログイン・歓迎ウィンドウを深夜端末CRTビジュアルへ刷新"
      },
      "summary": {
        "zh": "逐步视觉替换第 7 批上线：桌面端关于页（#about）、账号登录/注册浮层（#account-popover）与欢迎/最近更新窗（#welcome-modal）全部换装半透明 CRT 玻璃视觉；头像、RSS 订阅、社交链接、会话登录与默认不自动弹窗规则保持原样。",
        "en": "Batch 7 of the visual refresh is live: About (#about), the Account login/register popover (#account-popover), and the Welcome modal (#welcome-modal) adopt the translucent CRT glass skin while keeping all existing profile links, RSS feed, auth sessions, and non-auto-popup rules intact.",
        "ja": "段階的ビジュアル刷新の第7弾を公開しました。デスクトップの概要（#about）・ログイン/登録ポップオーバー・歓迎ウィンドウ（#welcome-modal）を半透明CRTガラスへ統一し、RSS・認証・自動非表示ルールはそのまま維持しています。"
      }
    }
  ]
});
