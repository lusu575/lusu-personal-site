// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-25-disable-image-drag-r86",
      "slug": "2026-11-25-disable-image-drag-r86",
      "category": "site-updates",
      "tags": [
        "ui",
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
        "zh": "交互手感收口：全站图片与图标禁止原生拖拽去拖影（r86）",
        "en": "App-Like Interaction Polish: Disable Native Ghost-Image Dragging (r86)",
        "ja": "UI 操作感の調整：画像・アイコンのネイティブドラッグ残像を無効化（r86）"
      },
      "summary": {
        "zh": "统一禁止游戏区封面图与卡片、关于页头像、视频封面、知识库卡片图、聊天头像及桌面图标区的浏览器原生拖影行为（-webkit-user-drag: none + draggable=false + dragstart 拦截），同时完整保留窗口标题栏拖动、画板绘图、滑块与临时互传文件拖放等功能性交互。",
        "en": "Disabled native browser ghost-image dragging across game covers, About avatars, video thumbnails, knowledge card images, chat avatars, and desktop icons via -webkit-user-drag: none, draggable=false, and dragstart interception while preserving window dragging, whiteboard drawing, sliders, and file drops.",
        "ja": "ゲーム表紙、About アバター、動画サムネイル、知識庫カード画像、チャットアイコン、デスクトップアイコンのブラウザ標準ドラッグ残像を無効化し、ウィンドウ移動・ホワイトボード描画・スライダー・ファイルドロップ等の機能操作はそのまま維持しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-ui-text-select-cursor-r85",
      "slug": "2026-11-25-ui-text-select-cursor-r85",
      "category": "site-updates",
      "tags": [
        "ui",
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
        "zh": "交互手感收口：UI 外壳文字禁选去 I 型光标、内容阅读区保留可选（r85）",
        "en": "App-Like Interaction Polish: Non-Selectable UI Chrome & Selectable Reading Areas (r85)",
        "ja": "UI 操作感の調整：UI 外殻テキストの選択禁止と本文エリアの選択維持（r85）"
      },
      "summary": {
        "zh": "消除全站 UI 外壳文字悬停出现 I 型输入光标与误拖选的问题：桌面图标/时钟/ID、欢迎窗、窗口标题栏与按钮/筛选/分页、各区卡片 UI 文字及聊天室元信息统一禁选并保持默认/手型光标；文章与更新记录正文/摘要/代码块、聊天消息正文、关于自介与联系方式、临时互传口令与内容及日语工具内容保持可拖选复制，输入区维持原生。",
        "en": "Removed stray I-beam cursors and accidental text selection across UI chrome (desktop icons/clock/ID, Welcome modal, titlebars, buttons, filters, card labels, chat metadata) while preserving full text selection for article/update bodies, summaries, code blocks, chat message bubbles, About bio/contact info, Quick Transfer room/content, and native inputs.",
        "ja": "デスクトップアイコン・時計・ID、ようこそ画面、ウィンドウ見出し、ボタン・フィルタ、各カード UI 文字やチャット付帯情報での誤選択と I 型カーソルを解消しつつ、記事・更新履歴本文・要約・コードブロック、チャット本文、自己紹介、クイック転送の内容、入力欄は選択・コピー可能なまま維持しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-pond-lightup-boot-r84",
      "slug": "2026-11-25-pond-lightup-boot-r84",
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
        "zh": "启动动画重做上线：A 方案「点亮池塘」同管线无缝显影（r84）",
        "en": "Plan A 'Light Up the Pond' Same-Pipeline Boot Sequence (r84)",
        "ja": "起動演出刷新：A案「池を灯す」同一パイプライン顕像（r84）"
      },
      "summary": {
        "zh": "彻底下线 r57 旧版 CRT 开机壳，在池塘 WebGL2 本体管线内实现 2.2–2.6 秒「点亮池塘」显影：深青微光起手、点阵荧光涟漪由中心扩散依次点亮水面、当季景物、点阵汇聚锦鲤、气泡浮起桌面图标与顶部时钟，扫描光束扫过直接交接为活池塘。",
        "en": "Replaced the legacy r57 boot shell with a unified WebGL2 pond emergence: 0.3s phosphor ignition over a luminous teal base, radial dot-matrix ripple revealing water, active-season flora, coalescing koi, bubble-rising desktop icons, and clock, finishing with a scan beam into the live pond.",
        "ja": "旧 r57 起動画面シェルを完全撤去し、池 WebGL2 本体内で 0.3 秒の蛍光点火から波紋拡散による水面・四季景物・光点収束の錦鯉・泡のように浮上するアイコン・時計点灯までを一気通貫で描画し、走査光でそのまま生きた池へ引き継ぎます。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-glass-v1-complete-r83",
      "slug": "2026-11-25-glass-v1-complete-r83",
      "category": "site-updates",
      "tags": [
        "ui",
        "glass",
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
        "zh": "液态玻璃 CRT Glass Lite V1.0 全量收口：窗口薄壳高光边与动态按钮全覆盖（r83）",
        "en": "CRT Glass Lite V1.0 Completion: Thin-Shell Window Rims & Dynamic Button Coverage (r83)",
        "ja": "CRT Glass Lite V1.0 全ステップ完了：ウィンドウ薄殻リム光と動的ボタン自動適用（r83）"
      },
      "summary": {
        "zh": "完成液态玻璃方案 V1.0 剩余步骤 5 与步骤 8：为桌面池塘窗口与账号弹窗补齐零 backdrop-filter 的 1.25px 荧光薄壳高光边与聚焦微虹彩，补全知识库/视频分类按钮、账号弹窗与快传动态按钮的自动绑定与性能分层闭环。",
        "en": "Completed remaining V1.0 Steps 5 and 8: added zero-backdrop-filter 1.25px thin-shell CRT glass window rims with subtle focus iridescence, auto-bound dynamic category/account/transfer buttons, and finalized low-tier & audit gates.",
        "ja": "V1.0 残ステップ 5・8 を完了。backdrop-filter を使わない 1.25px 蛍光薄殻リムとフォーカス微虹彩をウィンドウ・アカウント枠へ追加し、知識庫／動画のカテゴリボタンやアカウント／転送の動的ボタンも完全カバーしました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-25-glass-rollout-and-residuals-r82",
      "slug": "2026-11-25-glass-rollout-and-residuals-r82",
      "category": "site-updates",
      "tags": [
        "ui",
        "glass",
        "pond",
        "games"
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
        "zh": "液态玻璃 CRT Glass Lite 全站按钮铺开与两处细节收口（r82）",
        "en": "Site-Wide CRT Glass Lite Button Rollout & Two Visual Fixes (r82)",
        "ja": "CRT Glass Lite 全サイトボタン展開と細部 2 点の修正（r82）"
      },
      "summary": {
        "zh": "按 V1.0 方案与 r76 签收参数将液态玻璃三档交互铺开至全站主操作、工具图标与关闭按钮，并同步修复欢迎窗系统更新图标映射为星芒、猫国建筑悬浮提示框整体深色化。",
        "en": "Rolled out the approved r76 CRT Glass Lite three-tier button interactions across all desktop windows, fixed Welcome system update icons to use the System Spark, and unified Kittens Game hover tooltips in dark teal.",
        "ja": "r76 承認パラメータのまま CRT Glass Lite の 3 段階ボタン操作を全ウィンドウへ展開し、ようこそ画面のシステム更新アイコン（星芒）判定と猫国の建物ツールチップ暗色化を修正しました。"
      }
    }
  ]
});
