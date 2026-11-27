// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-27-mobile-44px-welcome-focus-r102",
      "slug": "2026-11-27-mobile-44px-welcome-focus-r102",
      "category": "site-updates",
      "tags": [
        "ui",
        "mobile",
        "a11y"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-27",
      "updated_at": "2026-11-27",
      "published_at": "2026-11-27",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "移动端 44px 触控与聊天/工具排版修复＋桌面欢迎窗键盘焦点恢复（r102）",
        "en": "Mobile 44px Touch Targets, Chat/Tools Containment & Desktop Welcome Keyboard Focus Fixes (r102)",
        "ja": "モバイル 44px タッチ基準・チャット／ツール枠はみ出し修正＆デスクトップ案内窓フォーカス復元（r102）"
      },
      "summary": {
        "zh": "修复移动端（含 844×390 横屏）主触控按钮低于 44px、移动端聊天发送按钮越出输入框、桌面端工具详情卡展开后文字溢出底边，以及桌面池塘模式下欢迎窗与账号弹窗键盘打开/关闭后焦点无法返回的问题。",
        "en": "Restored 44px primary touch targets across mobile and 844x390 landscape layouts, kept the mobile chat send button inside #chat-form, fixed expanded desktop tool card overflow, and restored keyboard focus/Escape/return-focus behavior for desktop Welcome and Account dialogs.",
        "ja": "モバイルおよび 844×390 横画面の 44px タッチ基準を回復し、モバイルチャット送信ボタンの枠外はみ出しとデスクトップツール詳細カード底面あふれを修正。さらにデスクトップ池モードでようこそ窓・アカウント窓のキーボード操作とフォーカス復元を修正しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-26-d1-quota-p0-r1",
      "slug": "2026-11-26-d1-quota-p0-r1",
      "category": "site-updates",
      "tags": [
        "ops",
        "performance",
        "admin"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-26",
      "updated_at": "2026-11-26",
      "published_at": "2026-11-26",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "D1 读写额度 P0 治理与后台按需统计上线",
        "en": "D1 Read/Write Quota P0 Fixes & On-Demand Admin Analytics",
        "ja": "D1 読み書き枠 P0 対策＆管理画面オンデマンド統計の反映"
      },
      "summary": {
        "zh": "补齐 98606dc 后台历史统计按需刷新与本次 D1 读写 P0 治理：关闭流量与写入面板 30 秒自动重数、补齐 article_view_events(created_at) 时间前导索引、将聊天室私密房过期清理移出请求路径并改用 (created_at, message_id) 增量游标与版本/时间条件删除、私人浏览器伴侣空队列轮询改为指数退避且零 grant touch/双审计写入，同步修复发布门测试。",
        "en": "Completed D1 read/write P0 fixes and backfilled release notes for 98606dc: disabled 30s auto-refresh on the Traffic panel (all analytics/traffic tabs now load strictly on demand), added a leading created_at index on article_view_events, moved private chat room cleanup out of request hot paths with (created_at, message_id) cursors and guarded deletes, added idle backoff with zero grant-touch/audit writes on empty private browser companion polls, and updated release-gate tests.",
        "ja": "98606dc の管理画面オンデマンド統計化を補記し、D1 読み書き P0 対策を完了：トラフィック画面の 30 秒自動更新を停止、article_view_events(created_at) 先頭インデックスを追加、チャット秘密部屋の期限切れ削除をリクエスト経路外へ移設して (created_at, message_id) カーソルと条件付き削除へ刷新、プライベートブラウザ伴侶の空ポーリングに指数バックオフと無書き込み化を導入しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-26-unpublish-three-articles-r1",
      "slug": "2026-11-26-unpublish-three-articles-r1",
      "category": "site-updates",
      "tags": [
        "content",
        "knowledge"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-26",
      "updated_at": "2026-11-26",
      "published_at": "2026-11-26",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "知识库内容整理：下架三篇旧文章（转为草稿态）",
        "en": "Knowledge Base Curation: Unpublished Three Articles (Moved to Draft)",
        "ja": "知識庫コンテンツ整理：3 件の記事を非公開化（下書き状態へ変更）"
      },
      "summary": {
        "zh": "按站长指令将工具雷达 2 篇（2026-08-04、2026-07-28）与 AI 分类 1 篇（2026-06-14）文章以可恢复方式调整为草稿状态（status = 'draft'），前台列表与文章直达链接均不再展示正文，原始数据完整保留。",
        "en": "Reversibly moved three articles (two Tool Radar posts from 2026-08-04 / 2026-07-28 and one AI guide from 2026-06-14) to draft status so they no longer appear in public listings or direct article URLs while keeping underlying records intact.",
        "ja": "ツールレーダー 2 件（2026-08-04・2026-07-28）および AI 記事 1 件（2026-06-14）を復元可能な下書き状態（status = 'draft'）へ変更し、公開一覧および直リンクからの閲覧を停止しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-quiet-icons-unclipped-r98",
      "slug": "2026-11-25-quiet-icons-unclipped-r98",
      "category": "site-updates",
      "tags": [
        "ui",
        "pond",
        "glass"
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
        "zh": "桌面图标安静开窗（去点击闪光）＋全站标题栏图标与光晕直线切边根治（r98）",
        "en": "Quiet Desktop Icon Launch (No Click Flash) & Unclipped Window Titlebar Icons/Glows (r98)",
        "ja": "デスクトップアイコンのクリック発光撤去＆全ウィンドウタイトルバー縁切れ根治（r98）"
      },
      "summary": {
        "zh": "取消池塘桌面 6 个点阵启动图标点击时的径向闪光脉冲（点下去安静开窗，悬停呈现保持不变）；在共享层统一解除全站所有窗口标题栏 .window-titlebar > span 与子 span 的 overflow: hidden，彻底消除游戏区/关于/工具/知识库/视频/聊天室标题图标左边与标题文字光晕的直线硬切。",
        "en": "Removed the clickPulse flash halo on the 6 pond desktop launch icons so clicking opens windows quietly while keeping hover states intact; unified overflow: visible on all window titlebar wrappers and icon/text spans across every window to eliminate straight-line drop-shadow and text-shadow clipping.",
        "ja": "池デスクトップ 6 アイコンのクリック時発光パルスを撤去し静かに開窓するように改善（ホバー表示は維持）。あわせて全ウィンドウのタイトルバー親 span の overflow: hidden を共通層で解除し、アイコン左端やタイトル文字光彩の直線切れを一掃しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-zero-hover-shift-r97",
      "slug": "2026-11-25-zero-hover-shift-r97",
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
        "zh": "消除全站卡片悬停描边挤动排版：非盒模型内描边与零位移统一标准（r97）",
        "en": "Eliminate Card Hover Layout Shift: Non-Box-Model Inset Stroke Standard (r97)",
        "ja": "カードホバー枠によるレイアウトズレ根治：非ボックスモデル内枠へ統一（r97）"
      },
      "summary": {
        "zh": "定位并修复知识库文章卡片悬停时三边边框由 0px 骤增至 3px 引起换行与下方卡片下移 37px 的问题：全站统一改用不占盒模型的 box-shadow: inset 0 0 0 1px 绘制悬停/按压描边，并同步收口欢迎窗最近更新条目、视频/游戏/工具卡片边框宽度，实现全站卡片悬停位移严格 0px。",
        "en": "Fixed the Knowledge article-card hover layout shift where toggling border-style: solid turned 0px borders into 3px (medium) and pushed lower cards down by 37px: switched .glass-card hover/press outlines to non-box-model inset box-shadow and locked constant border widths across Welcome, Video, Game, and Tool cards for 0px hover shift site-wide.",
        "ja": "知識庫記事カードホバー時に枠幅が 0px から 3px へ増えて下部カードが 37px 押し下げられる不具合を根治。ボックスモデルを消費しない inset box-shadow 描画へ統一し、ようこそ更新一覧・動画・ゲーム・ツールカードもホバー時ズレ 0px に揃えました。"
      }
    }
  ]
});
