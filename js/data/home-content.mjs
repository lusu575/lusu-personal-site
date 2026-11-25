// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
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
    },
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
    }
  ]
});
