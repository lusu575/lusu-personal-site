export const content = {
  updates: [
    {
      "article_id": "seed-update-2026-07-26-chatroom-icon-redraw",
      "slug": "2026-07-26-chatroom-icon-redraw",
      "category": "site-updates",
      "tags": ["UI", "Chat", "icon", "Pixel Art", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T10:58:00.000Z",
      "updated_at": "2026-07-26T10:58:00.000Z",
      "published_at": "2026-07-26T10:58:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "匿名聊天室图标重绘",
        "en": "Anonymous Chat Icon Redrawn",
        "ja": "匿名チャットアイコンを再描画"
      },
      "summary": {
        "zh": "重新绘制匿名聊天室图标，缩小可见主体并增加均衡透明留白；Home、窗口、任务栏、欢迎入口与聊天头像现统一使用新图，旧图资源已移除。",
        "en": "Redrew the Anonymous Chat icon with a smaller silhouette and balanced transparent padding. Home, windows, the taskbar, welcome shortcuts, and chat avatars now share the new asset, and the legacy artwork is removed.",
        "ja": "匿名チャットアイコンを描き直し、見える輪郭を小さくして透明余白を均等化しました。Home、ウィンドウ、タスクバー、ウェルカム入口、チャットのアバターを新しい素材へ統一し、旧素材は削除しました。"
      },
      "content_markdown": {
        "zh": "# 匿名聊天室图标重绘\n\n本轮更新匿名聊天室的完整公开图标身份：Home 入口的视觉重量与同组图标协调，窗口和聊天中的小尺寸槽位也统一使用同一张新图，旧图资源不再保留。\n\n## 图标调整\n\n- 新图继续使用小型 XP 聊天终端与粉色、青色双气泡，保持 Windows XP、Pixel Art 与 Y2K 桌面风格。\n- 唯一生产资源为 96×96 RGBA PNG `icon-chatroom.png`，可见主体从旧图的 93×90 缩小到 71×73，并在四边保留 10–13px 透明安全区。\n- 现有桌面 82px 与移动 Home 54px 映射继续使用；标题栏、任务栏、欢迎入口与头像保留各自既有的小槽位 contain 映射，因此不同位置都保持适度尺寸。\n- Home、窗口标题栏、桌面任务栏／移动 Dock、欢迎快捷入口、Chat 页头与消息头像现统一引用新图；`icon-chatroom-clean.png` 和旧原图均已移除。\n\n## 功能边界\n\n匿名聊天室路由、普通大厅、前端加密密码房、消息轮询、会话、发送与纯文本安全渲染均未修改。本轮只调整图标资产、缓存版本和对应视觉回归。",
        "en": "# Anonymous Chat Icon Redrawn\n\nThis pass updates the complete public icon identity for Anonymous Chat. The Home entry now matches the visual weight of its neighbors, while the smaller window and chat slots use the same new artwork. Legacy icon assets are no longer retained.\n\n## Icon adjustment\n\n- The new artwork keeps a compact XP chat terminal with coral and cyan speech bubbles, preserving the Windows XP, Pixel Art, and Y2K desktop style.\n- The sole production asset is the 96×96 RGBA PNG `icon-chatroom.png`. Its visible silhouette is reduced from the old 93×90 footprint to 71×73, with 10–13px of transparent safety padding on every side.\n- Existing 82px desktop and 54px mobile Home mappings remain in place. Titlebar, taskbar, welcome, and avatar slots keep their existing contain sizing, so every placement remains appropriately sized.\n- Home, window titlebars, the desktop taskbar and mobile Dock, welcome shortcuts, the Chat header, and message avatars now share the new asset. `icon-chatroom-clean.png` and the legacy source artwork have been removed.\n\n## Functional boundary\n\nThe Anonymous Chat route, public lobby, browser-encrypted password rooms, polling, sessions, sending, and plain-text safety rendering are unchanged. This update only changes icon assets, cache versions, and related visual regression coverage.",
        "ja": "# 匿名チャットアイコンを再描画\n\n今回は匿名チャットの公開アイコン全体を更新しました。Home 入口は周囲と同じ視覚的な重さに揃え、ウィンドウやチャット内の小さい枠も同じ新素材へ統一し、旧アイコン素材は残していません。\n\n## アイコン調整\n\n- 新しい絵は小型の XP チャット端末とピンク・シアンの2つの吹き出しを保ち、Windows XP、Pixel Art、Y2K のデスクトップ表現に合わせています。\n- 本番素材は 96×96 RGBA PNG の `icon-chatroom.png` だけです。見える輪郭を従来の 93×90 から 71×73 に縮め、四辺へ 10–13px の透明な安全余白を設けました。\n- デスクトップ 82px、モバイル Home 54px の既存表示設定は維持します。タイトルバー、タスクバー、ウェルカム入口、アバターも従来の小さい枠で contain 表示を続け、各位置で適度な大きさを保ちます。\n- Home、ウィンドウのタイトルバー、デスクトップのタスクバー／モバイル Dock、ウェルカムショートカット、Chat ヘッダー、メッセージのアバターを新素材へ統一し、`icon-chatroom-clean.png` と旧原画は削除しました。\n\n## 機能の境界\n\n匿名チャットのルート、公開ロビー、ブラウザー暗号化パスワード部屋、ポーリング、セッション、送信、プレーンテキスト安全描画は変更していません。今回はアイコン素材、キャッシュ版、関連する視覚回帰だけを更新しています。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-interface-audit-fixes",
      "slug": "2026-07-26-interface-audit-fixes",
      "category": "site-updates",
      "tags": ["mobile", "Games", "UI", "privacy", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T08:58:00.000Z",
      "updated_at": "2026-07-26T08:58:00.000Z",
      "published_at": "2026-07-26T08:58:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "全界面移动适配与游戏体验修复",
        "en": "Sitewide Mobile and Game Experience Fixes",
        "ja": "全画面のモバイル・ゲーム体験修正"
      },
      "summary": {
        "zh": "完成全部公开界面复检，修复 A Dark Room、Kittens Game、Life Restart、2048 与 Hextris 五款游戏的手机适配、触控和滚动问题，并收紧弹窗层级与第三方请求边界。",
        "en": "Completed a full public-interface recheck, fixing mobile layout, touch, and scrolling across five games—A Dark Room, Kittens Game, Life Restart, 2048, and Hextris—while tightening modal hierarchy and third-party request boundaries.",
        "ja": "公開画面を全面再点検し、A Dark Room、Kittens Game、Life Restart、2048、Hextris の5ゲームでモバイル配置・タッチ・スクロールを修正。モーダル階層と外部通信の境界も整えました。"
      },
      "content_markdown": {
        "zh": "# 全界面移动适配与游戏体验修复\n\n本轮基于全界面截图和几何点检，集中修复移动游戏首屏、触控尺寸、嵌入页面宽度、弹窗层级及外部请求边界，同时保持桌面布局和现有存档功能不变。\n\n## 移动游戏\n\n- A Dark Room 与 Kittens Game 不再沿用固定桌面宽度，手机上可在当前视口内完整使用，并保留桌面原布局。A Dark Room 在同页横竖屏切换时会重算两层滑轨、当前偏移与资源面板归属；Kittens Game 顶部工具栏在窄屏自然换为两行，Steam 与 Version 信息不再裁切，全部可见关键控件保持至少 44px。\n- Life Restart 只在粗指针移动环境启用运行时适配：主操作与所有可见 `btn*` hitArea 至少 44px，竖屏把工具与主流程分开，短横屏改为底部横排；细指针桌面几何保持原样。\n- 2048 的“新游戏”和 Hextris 的核心控制扩大为移动端友好的触控尺寸。\n- 五个游戏共用壳在短屏上压缩工具区，让游戏画面成为主要滚动区域，避免外层页面与 iframe 同时纵向滚动。\n\n## 本地化与隐私\n\n- A Dark Room 的音频提示随中文、英文和日文界面切换。\n- Kittens Game 移除上游 Google Analytics，并禁用仅适用于原站的 KGNet 与 localhost 本地桥接请求；文档语言随站点同步，未选择主题不再预载或发起外部字体请求。本站自己的本地存档和账号云存档不受影响。\n\n## 公共界面细节\n\n- 短屏欢迎窗增加可读容量；视频无法内嵌时改用紧凑决策窗，不再留下大面积空白。\n- 桌面弹窗遮罩提高层级对比度，工具和关于页面的长文案使用更自然的换行。\n\n## 全面回归\n\n公开首页、知识库、视频、工具、游戏、聊天、关于、文章阅读器与五个游戏均按桌面和关键手机尺寸复检，并覆盖中文、英文与日文可见文案、横向溢出、滚动所有者和 44px 触控目标。",
        "en": "# Sitewide Mobile and Game Experience Fixes\n\nThis pass uses full-interface screenshots and geometry checks to fix mobile game first screens, touch sizes, embedded-document widths, modal hierarchy, and external request boundaries while preserving desktop layouts and existing save behavior.\n\n## Mobile games\n\n- A Dark Room and Kittens Game no longer inherit fixed desktop widths on phones. Their complete interfaces fit the current viewport, and their desktop layouts remain intact. A Dark Room now recomputes both sliders, the active offset, and store-panel ownership during same-page orientation changes; the Kittens Game top toolbar wraps naturally into two rows on narrow screens, keeps Steam and Version fully visible, and maintains at least 44px for every visible critical control.\n- Life Restart enables its runtime adaptation only for coarse pointers: the primary action and every visible `btn*` hit area are at least 44px, portrait separates tools from the main flow, and short landscape places them in a bottom row, while fine-pointer desktop geometry stays unchanged.\n- The New Game action in 2048 and the core Hextris controls now provide mobile-friendly touch targets.\n- The shared shell for all five games compacts its tools on short screens so the game surface owns the primary scroll instead of creating competing outer-page and iframe scrolling.\n\n## Localization and privacy\n\n- The A Dark Room audio prompt follows the Chinese, English, or Japanese interface language.\n- Kittens Game removes upstream Google Analytics and disables KGNet plus the localhost bridge that only applied to the original host. Its document language follows the site, and unselected themes no longer preload or trigger external font requests. This does not affect the site's own local saves or account cloud saves.\n\n## Public-interface details\n\n- The short-screen welcome sheet exposes more readable content. Failed video embeds now use a compact decision sheet instead of a mostly empty full-screen player.\n- Desktop modal dimming has clearer depth, and long copy on Tools and About wraps more naturally.\n\n## Full regression\n\nHome, Knowledge, Videos, Tools, Games, Chat, About, the article reader, and all five games were rechecked at desktop and critical phone sizes, covering Chinese, English, and Japanese copy, horizontal overflow, scroll ownership, and 44px touch targets.",
        "ja": "# 全画面のモバイル・ゲーム体験修正\n\n全画面のスクリーンショットと要素寸法の点検を基に、モバイルゲームの初期画面、タッチ寸法、埋め込み文書幅、モーダル階層、外部通信の境界を修正しました。デスクトップ配置と既存の保存機能は維持しています。\n\n## モバイルゲーム\n\n- A Dark Room と Kittens Game はスマートフォンで固定デスクトップ幅を使わず、現在の表示幅に収まり、デスクトップの元の配置も維持します。A Dark Room は同じ画面で端末を回転した時も、2段のスライダー、現在位置、資源パネルの所属を再計算します。Kittens Game の上部ツールバーは狭い画面で自然に2段へ折り返し、Steam と Version を欠けずに表示し、見えている主要操作をすべて44px以上に保ちます。\n- Life Restart は粗いポインター環境だけで実行時レイアウトを切り替えます。主操作と表示中のすべての `btn*` ヒット領域を44px以上にし、縦画面ではツールを主フローから分離、短い横画面では下部の横並びにします。細かいポインターのデスクトップ配置は変更しません。\n- 2048 の「新しいゲーム」と Hextris の主要操作を、モバイルで押しやすい寸法に広げました。\n- 5ゲーム共通シェルは短い画面でツール部を圧縮し、外側ページと iframe の二重縦スクロールを避けてゲーム面を主スクロールにします。\n\n## 多言語とプライバシー\n\n- A Dark Room の音声案内は中国語・英語・日本語の画面言語に合わせて表示します。\n- Kittens Game から上流の Google Analytics を削除し、元サイト専用の KGNet と localhost ブリッジを無効化しました。文書言語は当サイトに合わせ、未選択テーマの事前読み込みと外部フォント通信も行いません。当サイトのローカル保存とアカウント用クラウド保存には影響しません。\n\n## 公開画面の調整\n\n- 短い画面のウェルカムシートで読める範囲を増やしました。動画を埋め込めない場合は、大きな空白のある全画面ではなくコンパクトな選択シートを表示します。\n- デスクトップのモーダル背景を明確にし、ツールと About の長文を自然に折り返します。\n\n## 全面回帰\n\nHome、Knowledge、Videos、Tools、Games、Chat、About、記事リーダー、5ゲームをデスクトップと主要モバイル寸法で再点検し、中国語・英語・日本語、横方向のはみ出し、スクロール所有者、44px タッチ対象を確認しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-resources-to-tools",
      "slug": "2026-07-26-resources-to-tools",
      "category": "site-updates",
      "tags": ["UI", "i18n", "Tools", "compatibility", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T06:55:36.099Z",
      "updated_at": "2026-07-26T06:55:36.099Z",
      "published_at": "2026-07-26T06:55:36.099Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "资源区正式更名为工具区",
        "en": "Resources Area Renamed to Tools",
        "ja": "リソース欄をツールへ名称変更"
      },
      "summary": {
        "zh": "公开栏目名称已统一为“工具区 / Tools / ツール”，内部 resources 路由、旧 #resources 链接、临时互传和全部功能保持不变。",
        "en": "The public section name is now Tools across Chinese, English, and Japanese, while the resources route, existing #resources links, Quick Transfer, and all behavior remain unchanged.",
        "ja": "公開欄の名称を中国語・英語・日本語で「ツール」に統一し、resources ルート、既存の #resources リンク、一時転送、すべての機能は変更していません。"
      },
      "content_markdown": {
        "zh": "# 资源区正式更名为工具区\n\n公开栏目现在统一使用中文“工具区”、English “Tools”、日本語“ツール”，让入口名称更准确地对应当前的软件、临时互传和学习工具。\n\n## 显示名称\n\n- 首页桌面入口、窗口标题、任务栏、移动 Dock、Appbar、文档标题、空状态和临时互传返回操作已同步三种语言。\n- 旧文章标签中的“资源区 / Resources / リソース”会继续兼容，但显示时统一为新名称。\n\n## 功能兼容\n\n- 内部 route、hash、DOM、CSS、模块、API 和统计键继续使用稳定的 resources / resource-* 技术标识。\n- 既有 #resources 收藏链接、筛选状态、临时互传、工具卡片和后台统计归组均保持可用，不迁移或删除任何数据。\n\n## 点检\n\n构建和三语浏览器审计会同时检查首页入口、窗口标题、文档元信息、Dock、临时互传返回按钮及 #resources 深链，防止只改到部分界面。",
        "en": "# Resources Area Renamed to Tools\n\nThe public section now uses Tools in English, 工具区 in Chinese, and ツール in Japanese so the label accurately matches the software, Quick Transfer, and learning tools available there.\n\n## Display name\n\n- The Home desktop entry, window title, taskbar, mobile Dock, Appbar, document metadata, empty states, and Quick Transfer return actions now use the same trilingual name.\n- Legacy article tags containing 资源区, Resources, or リソース remain accepted and render with the new display name.\n\n## Compatibility\n\n- Stable technical identifiers remain resources and resource-* across the route, hash, DOM, CSS, modules, APIs, analytics, and audits.\n- Existing #resources bookmarks, filters, Quick Transfer, tool cards, and analytics grouping continue to work without data migration or deletion.\n\n## QA\n\nBuild checks and trilingual browser audits now verify the Home entry, section title, document metadata, Dock, Quick Transfer return buttons, and the #resources deep link so partial renames are caught.",
        "ja": "# リソース欄をツールへ名称変更\n\n公開欄の表示名を日本語「ツール」、中文「工具区」、English「Tools」に統一し、ソフトウェア、一時転送、学習ツールという現在の内容に合わせました。\n\n## 表示名\n\n- Home のデスクトップ入口、ウィンドウタイトル、タスクバー、モバイル Dock、Appbar、文書メタデータ、空状態、一時転送の戻る操作を3言語で同期しました。\n- 過去の記事タグにある「资源区 / Resources / リソース」は互換入力として維持し、画面では新しい名称を表示します。\n\n## 互換性\n\n- route、hash、DOM、CSS、モジュール、API、統計、監査の技術識別子は resources / resource-* のままです。\n- 既存の #resources ブックマーク、絞り込み、一時転送、ツールカード、統計グループはデータ移行や削除なしで引き続き利用できます。\n\n## 点検\n\nビルドと3言語ブラウザー監査で Home 入口、欄タイトル、文書メタデータ、Dock、一時転送の戻るボタン、#resources 直リンクを確認し、一部だけ旧名称が残る回帰を防ぎます。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-mobile-article-first-screen",
      "slug": "2026-07-26-mobile-article-first-screen",
      "category": "site-updates",
      "tags": ["mobile", "Knowledge", "accessibility", "QA", "UI"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T06:31:45.722Z",
      "updated_at": "2026-07-26T06:31:45.722Z",
      "published_at": "2026-07-26T06:31:45.722Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "手机文章首屏与全站点检修复",
        "en": "Mobile Article First-Screen and Sitewide QA Fix",
        "ja": "モバイル記事初期画面と全体点検の修正"
      },
      "summary": {
        "zh": "修复手机知识库文章首屏大面积空白、短横屏英文资源卡裁切，并补齐 Dock、回顶按钮、目录语言与图片说明等无障碍细节。",
        "en": "Fixed the large blank area above mobile Knowledge articles and clipped English resource cards in short landscape, while completing Dock, back-to-top, TOC-language, and image-caption accessibility details.",
        "ja": "モバイルのナレッジ記事上部に生じる大きな空白と短い横画面での英語リソースカードの欠けを修正し、Dock、先頭へ戻る操作、目次言語、画像説明のアクセシビリティも整えました。"
      },
      "content_markdown": {
        "zh": "# 手机文章首屏与全站点检修复\n\n本轮针对手机知识库文章首屏的大面积空白做了根因修复，并把同一批移动端、短屏和无障碍问题统一纳入回归点检。\n\n## 首屏与短屏布局\n\n- 根因是按需加载的知识库路由样式插到了移动端样式之后，同等优先级下重新写回了桌面阅读侧栏的最小高度。现在所有路由样式固定插在移动端样式之前，并保留高优先级移动端保护规则。\n- 359×500、390×844 与 844×390 三种关键手机尺寸都会在首屏直接露出正文，不再由目录区域撑出空白。\n- 短横屏英文资源卡改为按内容高度排布，说明、标签和 44px 主操作都保持在卡片内部。\n\n## 阅读与无障碍\n\n- 阅读进度按正文末尾计算，不再把 Dock 安全留白算进正文；回到顶部后焦点交还给文章标题。\n- 收起的 Dock 同时使用 inert、aria-hidden 与视觉隐藏，不再留下可聚焦的透明项目。\n- 目录使用文章实际语言，长标题可换行或横向显露，内部按钮存在时不再给容器增加重复 Tab 停靠点。\n- 图片由可见说明文字负责朗读，装饰性图片使用空替代文本，避免读屏重复播报。\n\n## 统一点检\n\n文章阅读器已覆盖三种关键手机尺寸、中文／英文／日文与回退语言；资源页同时复验三种语言和短横屏返回流程。构建门禁还会持续检查样式加载顺序、首屏正文容量、单一滚动所有者、触控尺寸与焦点行为。",
        "en": "# Mobile Article First-Screen and Sitewide QA Fix\n\nThis pass fixes the root cause of the large blank area above mobile Knowledge articles and adds the related mobile, short-screen, and accessibility cases to the shared regression audit.\n\n## First-screen and short-screen layout\n\n- Lazy Knowledge route CSS was being inserted after the mobile stylesheet, allowing an equal-specificity desktop sidebar minimum height to win. Route styles now always load before the mobile authority, with a defensive mobile guard retained.\n- At 359×500, 390×844, and 844×390, article body copy is visible on the first screen instead of being pushed down by the TOC area.\n- English resource cards in short landscape now use content-sized rows, keeping descriptions, tags, and the 44px primary action inside each card.\n\n## Reading and accessibility\n\n- Reading progress ends at the article body instead of counting Dock safety padding, and back-to-top activation returns focus to the article title.\n- A collapsed Dock is inert, aria-hidden, and visually hidden, leaving no transparent focusable items.\n- The TOC follows the article's actual language, long titles wrap or reveal horizontally, and containers with interactive children no longer create a duplicate Tab stop.\n- Visible captions provide image descriptions while the corresponding image uses empty alt text, preventing duplicate screen-reader announcements.\n\n## Unified QA\n\nThe article reader now covers three critical mobile sizes, Chinese, English, Japanese, and fallback-language content. Resources are also rechecked across all three languages and the short-landscape return flow. Build gates continue to verify stylesheet order, first-screen body capacity, a single scroll owner, touch sizes, and focus behavior.",
        "ja": "# モバイル記事初期画面と全体点検の修正\n\nモバイルのナレッジ記事上部に大きな空白が生じる根本原因を修正し、関連するモバイル、短い画面、アクセシビリティの項目を共通回帰点検へ追加しました。\n\n## 初期画面と短い画面のレイアウト\n\n- 遅延読み込みされるナレッジのルート CSS がモバイル CSS の後ろに挿入され、同じ詳細度のデスクトップ用サイドバー最小高さが再適用されていました。ルート CSS は必ずモバイル CSS より前に読み込み、モバイル側の保護規則も維持します。\n- 359×500、390×844、844×390 の各サイズで、目次領域に押し下げられず初期画面から本文が見えるようになりました。\n- 短い横画面の英語リソースカードは内容に応じた高さとなり、説明、タグ、44px の主操作がカード内に収まります。\n\n## 閲覧とアクセシビリティ\n\n- 読了率は Dock 用の安全余白を含めず本文末尾で完了し、先頭へ戻る操作後は記事タイトルへフォーカスを移します。\n- 折りたたんだ Dock は inert、aria-hidden、視覚非表示を同時に使い、透明なフォーカス項目を残しません。\n- 目次は記事の実際の言語を使用し、長いタイトルは折り返しまたは横方向に表示します。内部に操作要素がある場合、コンテナへ重複した Tab 停止位置を追加しません。\n- 画像説明は表示中のキャプションが担当し、画像の alt は空にしてスクリーンリーダーの重複読み上げを防ぎます。\n\n## 統一点検\n\n記事リーダーは3つの主要モバイルサイズ、中国語・英語・日本語とフォールバック言語を対象にしました。リソース画面も3言語と短い横画面からの復帰を再確認します。ビルドゲートでは CSS 順序、初期画面の本文量、単一スクロール所有者、タッチサイズ、フォーカス挙動を継続して検証します。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-trust-safety-status",
      "slug": "2026-07-26-trust-safety-status",
      "category": "site-updates",
      "tags": ["Games", "Quick Transfer", "reliability", "security", "UI"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T04:54:16.752Z",
      "updated_at": "2026-07-26T04:54:16.752Z",
      "published_at": "2026-07-26T04:54:16.752Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "30 项功能与界面优化完成",
        "en": "30 Functional and UI Improvements Completed",
        "ja": "機能・UI 改善 30 項目を完了"
      },
      "summary": {
        "zh": "完成云存档与互传安全、真实连接与恢复流程、搜索筛选、三语无障碍，以及资源和游戏卡片等 30 项可验证优化。",
        "en": "Thirty verified improvements now cover cloud-save and transfer safety, truthful connection and recovery flows, search and filtering, trilingual accessibility, plus resource and game cards.",
        "ja": "クラウド保存と転送の安全性、正確な接続・復旧、検索と絞り込み、3言語アクセシビリティ、リソースとゲームカードを含む検証可能な30項目を改善しました。"
      },
      "content_markdown": {
        "zh": "# 30 项功能与界面优化完成\n\n本轮把功能可靠性、真实状态、搜索与筛选、三语无障碍和移动端卡片层级一起收口，并继续保持 Windows XP、Pixel Art 与 Y2K 桌面风格。\n\n## 云存档、互传与连接状态\n\n- 云存档写入加入 CAS 版本校验；冲突时暂停全部上传，并提供备份本地、恢复云端、保留本地覆盖云端和稍后决定。\n- 临时互传明确安全边界：文字使用浏览器端 AES-GCM；文件依靠 HTTPS、私有 R2 与服务端鉴权，不宣称口令端到端加密，也不提供病毒扫描。\n- 桌面托盘使用检测中、在线、服务降级和离线四种真实状态，严格校验数据库健康，并在后台暂停退避重试。\n\n## 恢复、搜索与筛选\n\n- 账号状态检查加入超时和原位重试；聊天室增加真实重连、手动重试，密码房切换防重复提交，历史读取失败不会误报进入成功。\n- 知识库搜索支持多关键词 AND 匹配，筛选和搜索会重置真实滚动位置与历史快照。\n- 视频与资源筛选重建后恢复键盘焦点；视频空分类把“显示全部”设为主操作，网站更新为次操作。\n\n## 三语与无障碍\n\n- 首屏会尽早同步页面语言；文章回退内容使用实际内容语言，移动语言按钮完整显示当前语言并播报下一语言。\n- 聊天密码错误、字数计数和互传口令说明都与对应控件关联；上传区域保留原生文件选择器，不再伪装成额外键盘按钮。\n\n## 资源与游戏卡片\n\n- 手机资源卡完整显示说明，把事实字段、标签和主操作分层，短横屏继续保持操作可见。\n- 游戏卡直接显示中、英、日支持情况，简介最多三行，更多信息使用 44px 原生展开控件；后台刷新失败时明确提示正在显示已缓存列表。",
        "en": "# 30 Functional and UI Improvements Completed\n\nThis pass closes out functional reliability, truthful state, search and filtering, trilingual accessibility, and mobile card hierarchy while retaining the Windows XP, Pixel Art, and Y2K desktop style.\n\n## Cloud saves, transfer, and connection state\n\n- Cloud-save writes now use compare-and-swap version checks. A conflict pauses every upload path and offers local backup, restore cloud, keep local and overwrite cloud, or decide later.\n- Quick Transfer now states the real boundary: text uses browser-side AES-GCM; files rely on HTTPS, private R2 storage, and server authorization, with no passphrase end-to-end encryption or malware scanning claim.\n- The desktop tray uses four real states—checking, online, degraded, and offline—strictly verifies database health, and pauses backoff checks in the background.\n\n## Recovery, search, and filtering\n\n- Account checks have a timeout and in-place retry. Chat has truthful reconnect and manual retry, password-room switching is single-flight, and failed history never reports successful entry.\n- Knowledge search supports multi-token AND matching, while searches and filters reset the real scroll owner and history snapshot.\n- Video and resource filters restore keyboard focus after rebuilding. Empty video categories make Show all the primary action and site updates secondary.\n\n## Trilingual accessibility\n\n- The first paint applies the requested document language early. Fallback articles expose their actual content language, and the mobile language control shows the full current language while announcing the next one.\n- Chat password errors, character counts, and Transfer passphrase guidance are associated with their controls. The upload area keeps native file pickers instead of pretending to be another keyboard button.\n\n## Resource and game cards\n\n- Mobile resource cards show their full description and separate facts, tags, and the primary action; short landscape keeps the action visible.\n- Game cards expose Chinese, English, and Japanese support directly, allow three summary lines, and use a native 44px disclosure for secondary details. A failed background refresh clearly says the cached catalog is still on screen.",
        "ja": "# 機能・UI 改善 30 項目を完了\n\n機能の信頼性、正確な状態表示、検索と絞り込み、3言語アクセシビリティ、モバイルカードの階層をまとめて改善し、Windows XP、Pixel Art、Y2K のデスクトップ表現は維持しました。\n\n## クラウド保存・転送・接続状態\n\n- クラウド保存の書き込みに CAS 版照合を追加しました。競合時はすべてのアップロードを停止し、ローカルのバックアップ、クラウドの復元、ローカルを残して上書き、後で決める、を選べます。\n- 一時転送の境界を明記しました。テキストはブラウザー側 AES-GCM、ファイルは HTTPS・非公開 R2・サーバー認可で保護され、パスフレーズによる E2E 暗号化やマルウェア検査は行いません。\n- デスクトップトレイは確認中、オンライン、サービス低下、オフラインの4状態を実際に判定し、DB 健全性も確認。バックグラウンドでは再試行を停止します。\n\n## 復旧・検索・絞り込み\n\n- アカウント確認にタイムアウトとその場での再試行を追加。チャットは正確な再接続と手動再試行に対応し、パスワード部屋の切替は単一実行、履歴失敗時は入室成功と表示しません。\n- ナレッジ検索は複数語の AND 検索に対応し、検索・絞り込み時に実際のスクロール領域と履歴スナップショットを先頭へ戻します。\n- 動画とリソースの絞り込みは再描画後にキーボードフォーカスを復元。空の動画カテゴリでは「すべて表示」を主操作、サイト更新を副操作にしました。\n\n## 3言語アクセシビリティ\n\n- 初回描画で要求された文書言語を早めに適用し、フォールバック記事には実際の本文言語を設定。モバイル言語ボタンは現在の言語名を完全表示し、次の言語も読み上げます。\n- チャットのパスワードエラー、文字数、転送のパスフレーズ説明を各入力に関連付けました。アップロード領域は偽のキーボードボタンを持たず、標準のファイル選択を使います。\n\n## リソースとゲームカード\n\n- モバイルのリソースカードは説明を省略せず、事実情報・タグ・主操作を分離。短い横画面でも操作を表示します。\n- ゲームカードは中国語・英語・日本語対応を直接表示し、概要は3行、詳細は44pxの標準開閉操作に整理。バックグラウンド更新失敗時はキャッシュ済み一覧であることを明示します。"
      }
    },
    {
      "article_id": "seed-update-2026-07-21-desktop-taskbar-active",
      "slug": "2026-07-21-desktop-taskbar-active",
      "category": "site-updates",
      "tags": ["UI", "taskbar", "desktop", "accessibility"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-21T00:41:00.711Z",
      "updated_at": "2026-07-21T00:41:00.711Z",
      "published_at": "2026-07-21T00:41:00.711Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.21",
      "title": {
        "zh": "桌面任务栏选中态降噪",
        "en": "Desktop Taskbar Active-State Polish",
        "ja": "デスクトップタスクバーの選択表示調整"
      },
      "summary": {
        "zh": "移除 PC 端当前任务按钮的黄色底边、外描边和常亮光晕，保留蓝色按下层级与键盘焦点环；移动 Dock 不变。",
        "en": "The desktop active task button drops its yellow edge and persistent glow while retaining a blue pressed hierarchy and keyboard focus ring; the mobile Dock is unchanged.",
        "ja": "デスクトップの選択中タスクボタンから黄色の縁と常時グローを外し、青い押下階層とキーボードフォーカスリングを維持。モバイル Dock は変更しません。"
      },
      "content_markdown": {
        "zh": "# 桌面任务栏选中态降噪\n\nPC 端底部任务栏的当前窗口按钮已移除黄色底边、黄色外描边与持续发光效果，让桌面更安静，也更贴近蓝色 Neo-XP 的窗口层级。\n\n## 调整内容\n\n- 当前任务继续使用蓝色按下背景、内凹边缘和清楚的文字对比，不会失去“当前窗口”识别。\n- 只有键盘操作触发的 focus-visible 焦点环继续保留，避免视觉降噪影响可访问性。\n- 移动端 Dock 的透明选中底板、滑动和触控范围完全不变。\n\n本次同步检查 Home 与 Knowledge 的桌面任务栏，并更新缓存版本，避免浏览器继续显示旧的黄色光晕。",
        "en": "# Desktop Taskbar Active-State Polish\n\nThe active window button in the PC taskbar no longer uses a yellow bottom edge, yellow outer outline, or persistent glow. The desktop now reads more calmly while retaining its blue Neo-XP hierarchy.\n\n## What changed\n\n- The current task keeps its blue pressed background, inset edge, and clear text contrast, so the active window remains obvious.\n- The focus-visible ring still appears for keyboard navigation, preserving an explicit accessible focus indicator.\n- The mobile Dock selection surface, scrolling, and touch geometry are unchanged.\n\nHome and Knowledge were checked with the desktop taskbar, and the public cache version was advanced so browsers do not retain the old yellow glow.",
        "ja": "# デスクトップタスクバーの選択表示調整\n\nPC 版の下部タスクバーで、選択中ウィンドウのボタンに付いていた黄色の下線、外枠、常時グローを削除しました。青い Neo-XP の階層は維持しつつ、画面を落ち着かせています。\n\n## 変更内容\n\n- 現在のタスクは青い押下背景、内側の段差、十分な文字コントラストを保ち、選択中であることを明確に示します。\n- キーボード操作時の focus-visible リングは残し、アクセシブルなフォーカス表示を維持します。\n- モバイル Dock の選択面、横スクロール、タッチ領域は変更していません。\n\nHome と Knowledge のデスクトップタスクバーを確認し、古い黄色グローがキャッシュに残らないよう公開バージョンも更新しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-20-ui-motion-polish",
      "slug": "2026-07-20-ui-motion-polish",
      "category": "site-updates",
      "tags": ["UI", "motion", "accessibility", "mobile", "Chat", "Videos"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-20T14:53:30.199Z",
      "updated_at": "2026-07-20T14:53:30.199Z",
      "published_at": "2026-07-20T14:53:30.199Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.20",
      "title": {
        "zh": "全站界面与动效精修",
        "en": "Site-wide UI and Motion Polish",
        "ja": "サイト全体の UI・モーション調整"
      },
      "summary": {
        "zh": "完成聊天短屏、视频卡片、知识库、资源区、欢迎窗口与移动 Dock 的系统化精修，并统一加载、错误、键盘焦点和减少动效体验。",
        "en": "Chat on short screens, video cards, Knowledge, Resources, the welcome window, and the mobile Dock are systematically refined, with unified loading, error, keyboard-focus, and reduced-motion behavior.",
        "ja": "短い画面のチャット、動画カード、ナレッジ、リソース、ウェルカム画面、モバイル Dock を整理し、読み込み・エラー・キーボードフォーカス・モーション低減の挙動も統一しました。"
      },
      "content_markdown": {
        "zh": "# 全站界面与动效精修\n\n本轮围绕美观度、UI 结构和动效反馈完成 30 项集中优化，继续保留 Windows XP、Pixel Art 与 Y2K 桌面语言。\n\n## 排版与布局\n\n- 聊天室在 1280×720、短竖屏和手机横屏中重新分配标题、房间切换、消息流与输入区空间，输入框和页脚不再被裁切。\n- 视频封面统一为真实 16:9，失败操作收进卡片；欢迎快捷入口、最近更新、知识库正文和资源元信息获得更清楚的层级与可读宽度。\n- 移动欢迎页只保留一个滚动容器，文章 Appbar 保留路由身份，Dock 字号、触控区和横屏排列同步校准。\n\n## 交互与状态\n\n- 视频封面改为原生按钮并支持键盘；加载、空状态与错误状态采用一致结构，重试后恢复焦点，慢速 iframe 也避免旧计时器覆盖新结果。\n- 禁用控件不再播放按压反馈，桌面 CTA 增加清楚的悬停状态，任务栏活动项、系统消息对比度和各路由强调色更容易辨认。\n\n## 动效与偏好\n\n- 最大化与还原改用真实前后几何差值，关闭与最小化反馈方向统一。\n- “减少动效”与“关闭动效”会同步停止 Dock 平滑移动、骨架循环和硬编码过渡；主题切换不再创建无效的整页快照。\n\n本轮同时复核首页与各 App 的桌面、窄竖屏、短屏和手机横屏组合，并保持中、英、日三语内容与 44px 触控边界。",
        "en": "# Site-wide UI and Motion Polish\n\nThis release completes 30 focused improvements across visual quality, UI structure, and motion feedback while retaining the Windows XP, Pixel Art, and Y2K desktop language.\n\n## Typography and layout\n\n- Chat now allocates title, room controls, message history, composer, and footer space correctly at 1280×720, short portrait screens, and mobile landscape, so the composer remains visible.\n- Video covers use a true 16:9 frame and failure actions stay inside each card. Welcome shortcuts, recent updates, Knowledge reading width, and Resources metadata now have clearer hierarchy.\n- Mobile Welcome keeps one scroll owner, article Appbars retain route identity, and Dock type, touch geometry, and landscape alignment are recalibrated.\n\n## Interaction and states\n\n- Video covers are native buttons with keyboard support. Loading, empty, and error states share one structure; retry restores focus, and stale iframe timers can no longer replace a newer result.\n- Disabled controls no longer animate as pressed. Desktop CTAs gain visible hover feedback, while active taskbar items, system-message contrast, and subtle route accents are easier to distinguish.\n\n## Motion preferences\n\n- Maximize and restore use real before-and-after geometry, with consistent close and minimize direction.\n- Reduced and off motion also stop Dock smoothing, skeleton loops, and hard-coded transitions. Theme changes no longer create a redundant full-page snapshot.\n\nThe pass rechecks Home and every App across desktop, narrow portrait, short-screen, and mobile-landscape layouts while preserving Chinese, English, and Japanese content and 44px touch targets.",
        "ja": "# サイト全体の UI・モーション調整\n\nWindows XP、Pixel Art、Y2K のデスクトップ表現を維持しながら、見た目、UI 構造、モーションフィードバックを中心に 30 項目を改善しました。\n\n## 文字組みとレイアウト\n\n- 1280×720、短い縦画面、モバイル横画面のチャットで、タイトル、ルーム切替、履歴、入力欄、フッターの配分を調整し、入力欄が切れないようにしました。\n- 動画サムネイルを正しい 16:9 に統一し、失敗時の操作をカード内に整理。ウェルカムのショートカット、最近の更新、ナレッジ本文、リソースのメタ情報も読みやすくしました。\n- モバイルのウェルカムはスクロール領域を一つにし、記事 Appbar にはルート名を残しています。Dock の文字、タッチ領域、横画面配置も再調整しました。\n\n## 操作と状態表示\n\n- 動画サムネイルはキーボードで操作できる標準ボタンになりました。読み込み、空、エラー表示を統一し、再試行後のフォーカスを復元。古い iframe timer が新しい結果を上書きする競合も防ぎます。\n- 無効な操作には押下アニメーションを出さず、デスクトップ CTA の hover、タスクバーの選択状態、システムメッセージのコントラスト、各ルートの控えめな accent を明確にしました。\n\n## モーション設定\n\n- 最大化と復元は実際の前後座標を使い、閉じる・最小化の方向も統一しました。\n- モーション低減・停止時は Dock の滑らかな移動、スケルトンのループ、固定時間の transition も停止します。テーマ変更時の不要な全画面 snapshot も削除しました。\n\nHome と各 App をデスクトップ、狭い縦画面、短い画面、モバイル横画面で再確認し、中・英・日 3 言語と 44px のタッチ領域を維持しています。"
      }
    },
    {
      "article_id": "seed-update-2026-07-19-historical-video-thumbnail-cache",
      "slug": "2026-07-19-historical-video-thumbnail-cache",
      "category": "site-updates",
      "tags": ["Videos", "Bilibili", "cache", "ETag", "reliability"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-19T11:56:27.825Z",
      "updated_at": "2026-07-19T11:56:27.825Z",
      "published_at": "2026-07-19T11:56:27.825Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.19",
      "title": {
        "zh": "历史视频封面缓存恢复",
        "en": "Historical Video Thumbnail Cache Recovery",
        "ja": "過去の動画サムネイルキャッシュ復旧"
      },
      "summary": {
        "zh": "历史上传的 B 站封面并未丢失；公开视频 ETag 与封面代理地址现已完整版本化，旧浏览器会自动丢弃曾缓存的空封面，无需重新上传。",
        "en": "Previously uploaded Bilibili covers were still intact; complete response ETags and versioned thumbnail proxy URLs now make existing browsers discard cached empty covers without requiring another upload.",
        "ja": "以前アップロードした Bilibili サムネイルは失われていません。完全なレスポンス ETag とバージョン付きプロキシ URL により、既存ブラウザーもキャッシュ済みの空表示を破棄し、再アップロードなしで復旧します。"
      },
      "content_markdown": {
        "zh": "# 历史视频封面缓存恢复\n\n历史 B 站视频的手动封面仍完整保存在数据库中，公开封面端点也能返回有效图片。本次修复针对旧浏览器仍显示空封面的缓存兼容问题。\n\n## 根因与恢复\n\n- 旧版 `/api/videos` 的 ETag 只根据视频行更新时间生成。封面解析逻辑更新后数据库没有变化，浏览器因此收到 304，并继续复用修复前的空封面响应。\n- 公开视频列表与单条详情的 ETag 现在根据完整公开响应生成，任何封面 URL、尺寸或分类表示变化都会得到新的缓存标识。\n- 本地上传封面的同源代理 URL 会携带视频更新时间版本；历史空缓存会立即失效，之后重新上传封面也不会继续看到旧图。\n\n## 验证\n\n线上 11 张历史 B 站封面逐一返回有效 JPEG，并在全新浏览器中正常显示。修复不修改或重新编码数据库中的原始封面，也不需要管理员再次上传。",
        "en": "# Historical Video Thumbnail Cache Recovery\n\nThe manually uploaded covers for older Bilibili videos remain intact in the database, and every public thumbnail endpoint returns a valid image. This fix addresses cached empty covers in existing browsers.\n\n## Cause and recovery\n\n- The previous `/api/videos` ETag was derived only from video-row timestamps. When thumbnail interpretation changed without a database edit, browsers received 304 and reused the pre-fix response with empty cover fields.\n- Video-list and single-video ETags now derive from the complete public representation, so changes to cover URLs, dimensions, categories, or other public fields produce a new cache identity.\n- Same-origin proxy URLs for uploaded covers now carry the video update version. Historical empty caches are bypassed immediately, and later cover replacements cannot remain stuck on an older image.\n\n## Verification\n\nAll 11 historical Bilibili covers on the live site returned valid JPEG responses and rendered in a clean browser profile. The recovery neither rewrites the stored cover data nor requires another admin upload.",
        "ja": "# 過去の動画サムネイルキャッシュ復旧\n\n以前の Bilibili 動画に手動アップロードしたサムネイルはデータベースに残っており、公開サムネイル endpoint も有効な画像を返しています。今回は既存ブラウザーに残った空表示キャッシュを修正しました。\n\n## 原因と復旧\n\n- 旧 `/api/videos` の ETag は動画行の更新時刻だけから生成されていました。サムネイル解釈を修正しても DB 行が変わらないため、ブラウザーは 304 を受け取り、修正前の空サムネイル応答を再利用していました。\n- 動画一覧と単体動画の ETag は完全な公開レスポンスから生成するようになり、URL、寸法、分類などの公開表現が変われば新しいキャッシュ識別子になります。\n- アップロード済み画像の同一 origin プロキシ URL には動画更新版を付与します。過去の空キャッシュを直ちに回避し、今後サムネイルを差し替えた場合も古い画像に固定されません。\n\n## 検証\n\n本番サイトの過去の Bilibili サムネイル 11 枚がすべて有効な JPEG を返し、新規ブラウザープロファイルで表示されることを確認しました。保存済み画像の書き換えや管理画面からの再アップロードは不要です。"
      }
    },
    {
      "article_id": "seed-update-2026-07-19-content-experience-fixes",
      "slug": "2026-07-19-content-experience-fixes",
      "category": "site-updates",
      "tags": ["Knowledge", "Videos", "Resources", "Games", "account", "UI"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-19T04:04:44.666Z",
      "updated_at": "2026-07-19T04:04:44.666Z",
      "published_at": "2026-07-19T04:04:44.666Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.19",
      "title": {
        "zh": "知识库、视频、图标与账号体验修复",
        "en": "Knowledge, Video, Icon, and Account Fixes",
        "ja": "ナレッジ・動画・アイコン・アカウントの修正"
      },
      "summary": {
        "zh": "网站更新日志全部取消置顶，知识库窗口只保留关闭键；恢复后台上传的 B 站封面并移除封面圆圈，替换临时互传和五款游戏的独立图标，同时修正登录、注册与登录后账号界面。",
        "en": "Site update logs are no longer pinned and the Knowledge window keeps only Close; uploaded Bilibili covers are restored, thumbnail circles removed, Quick Transfer and five games receive distinct icons, and account login, registration, and signed-in states are corrected.",
        "ja": "サイト更新ログの固定を解除し、ナレッジ画面は閉じる操作だけにしました。Bilibili のアップロード済みサムネイルを復旧し、円形表示を削除。一時転送と5ゲームに個別アイコンを追加し、ログイン・登録・ログイン後表示も修正しました。"
      },
      "content_markdown": {
        "zh": "# 知识库、视频、图标与账号体验修复\n\n本次修复集中处理知识库、视频、资源、游戏和账号入口中影响日常使用的显示问题。\n\n## 知识库\n\n- 已有的网站更新记录全部取消置顶，后台今后创建或修改 `site-updates` 时也会强制保持非置顶。前端同时忽略更新日志的旧置顶值，避免缓存数据重新露出置顶标记。\n- 知识库标题栏删除最小化和缩放／还原按钮，只保留真实可用的关闭操作。\n\n## 视频与图标\n\n- 公开视频接口现在接受后台上传流程实际会生成的最大 960×540 封面，同时继续限制文件为 320KB，B 站手动上传封面可以正常显示。\n- 视频卡片封面上的蓝色圆形覆盖层已移除。\n- 临时互传入口和五款游戏均换成图像生成的独立透明图标，不再复用通用图标或代码绘制几何图形。\n\n## 账号界面\n\n- 登录模式只显示邮箱和一次密码；确认密码只在注册模式出现。\n- 登录成功后完整隐藏登录／注册表单，只显示登录成功状态和退出账号按钮。",
        "en": "# Knowledge, Video, Icon, and Account Fixes\n\nThis release resolves visible daily-use issues across Knowledge, Videos, Resources, Games, and the account entry.\n\n## Knowledge\n\n- Every existing site update is unpinned. Future admin creates and edits in `site-updates` are also forced to remain unpinned, while the public list defensively ignores stale pinned values from cached data.\n- The Knowledge titlebar removes minimize and maximize/restore controls and keeps only the working Close action.\n\n## Video and icons\n\n- The public video API now accepts the 960×540 maximum generated by the admin upload flow while retaining the 320 KB byte limit, so manually uploaded Bilibili covers render again.\n- The blue circular overlay has been removed from video-card thumbnails.\n- Quick Transfer and all five games now use distinct generated transparent icons instead of shared generic art or code-drawn geometry.\n\n## Account interface\n\n- Login shows email and one password field; confirmation appears only during registration.\n- After sign-in, the complete login/registration form is hidden and only the signed-in success state and Log out action remain.",
        "ja": "# ナレッジ・動画・アイコン・アカウントの修正\n\n今回は、ナレッジ、動画、リソース、ゲーム、アカウント入口で日常利用に影響する表示問題を修正しました。\n\n## ナレッジ\n\n- 既存のサイト更新をすべて固定解除しました。今後も管理画面で `site-updates` を作成・編集すると固定されず、公開一覧は古いキャッシュの固定値も無視します。\n- ナレッジのタイトルバーから最小化と最大化／復元を削除し、実際に動作する閉じる操作だけを残しました。\n\n## 動画とアイコン\n\n- 公開動画 API は管理画面のアップロード処理が生成する最大 960×540 を受け入れ、320KB の上限は維持します。手動アップロードした Bilibili サムネイルが再び表示されます。\n- 動画カードのサムネイル上にあった青い円形表示を削除しました。\n- 一時転送と5つのゲームは、共通アイコンやコード描画ではなく、それぞれ異なる生成済み透明アイコンを使用します。\n\n## アカウント画面\n\n- ログインはメールと1回のパスワードだけを表示し、確認用パスワードは登録時だけ表示します。\n- ログイン後はログイン／登録フォーム全体を隠し、ログイン成功表示とログアウト操作だけを残します。"
      }
    },
    {
      "article_id": "seed-update-2026-07-19-service-recovery",
      "slug": "2026-07-19-service-recovery",
      "category": "site-updates",
      "tags": ["Knowledge", "Japanese", "Quick Transfer", "reliability", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-18T17:35:00.000Z",
      "updated_at": "2026-07-18T17:35:00.000Z",
      "published_at": "2026-07-18T17:35:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.19",
      "title": {
        "zh": "知识库、日语与互传服务恢复",
        "en": "Knowledge, Japanese, and Transfer Service Recovery",
        "ja": "ナレッジ・日本語・転送サービスの復旧"
      },
      "summary": {
        "zh": "修复知识库文章种子中的无效 D1 参数，兼容 Cloudflare 无扩展名互传片段地址，并补齐本地预览隐私配置检查；日语工具、知识库与互传入口已重新联调。",
        "en": "An invalid D1 article-seed parameter is fixed, Quick Transfer now accepts Cloudflare's canonical extensionless fragment path, and local-preview privacy configuration is checked; Japanese, Knowledge, and Transfer flows are reverified together.",
        "ja": "記事 seed の不正な D1 引数を修正し、Quick Transfer が Cloudflare の拡張子なし canonical fragment を受け入れるようにしました。ローカル preview の privacy 設定も補い、日本語・ナレッジ・転送を一括で再確認しています。"
      },
      "content_markdown": {
        "zh": "# 知识库、日语与互传服务恢复\n\n本次修复针对生产站与本地预览中叠加出现的服务异常，恢复知识库文章接口与资源区临时互传入口，并重新验证日语工具的静态资源和云端进度降级路径。\n\n## 知识库数据恢复\n\n- 修正一条三语网站更新 seed 漏传 UTC 时间戳的问题，避免 D1 收到 `undefined` 后让全部文章查询返回 500。\n- 新增全量 seed bind 回归测试，任何未来的未定义绑定参数都会在发布前直接失败。\n\n## 互传与本地预览恢复\n\n- Quick Transfer 继续只允许同源固定片段，但同时接受源文件 `.html` 路径和 Cloudflare clean URL 的无扩展名规范路径。\n- 本地 `.dev.vars` 必须具备两个独立、足够长度的隐私盐；健康检查会在 UI 验收前暴露缺失配置，秘密值不会进入仓库。\n\n## 验证范围\n\n回归覆盖中、英、日文章接口、资源区真实点击到互传登录门、日语课程目录与音频清单，并检查桌面和手机尺寸截图。匿名用户的互传登录提示与日语本地进度降级仍是设计行为。",
        "en": "# Knowledge, Japanese, and Transfer Service Recovery\n\nThis release addresses overlapping production and local-preview failures. It restores the Knowledge article API and the Resources Quick Transfer entry, then rechecks the Japanese tool's static assets and cloud-progress fallback.\n\n## Knowledge data recovery\n\n- A trilingual site-update seed now passes its missing UTC timestamp, preventing D1 from receiving `undefined` and failing every article query with HTTP 500.\n- A full seed-bind regression test now fails the release gate whenever any future binding argument is undefined.\n\n## Transfer and local-preview recovery\n\n- Quick Transfer remains restricted to a fixed same-origin fragment while accepting both the authored `.html` path and Cloudflare's extensionless clean-URL form.\n- Local `.dev.vars` must contain two independent, sufficiently long privacy salts. Health probing exposes missing configuration before UI review, while secret values stay outside Git.\n\n## Verification scope\n\nRegression coverage includes Chinese, English, and Japanese article APIs, a real Resources click into the Transfer sign-in gate, the Japanese course catalog and audio manifest, plus desktop and mobile screenshots. Anonymous Transfer sign-in prompts and Japanese local-progress fallback remain intentional behavior.",
        "ja": "# ナレッジ・日本語・転送サービスの復旧\n\n本リリースでは、本番環境とローカル preview で重なって発生した障害を修正しました。ナレッジの記事 API とリソース画面の Quick Transfer 入口を復旧し、日本語ツールの静的素材とクラウド進捗の fallback も再確認しています。\n\n## ナレッジデータの復旧\n\n- 3 言語のサイト更新 seed に不足していた UTC timestamp を渡し、D1 に `undefined` が bind されて全記事 query が HTTP 500 になる問題を防ぎました。\n- すべての seed bind を検査する回帰テストを追加し、今後未定義の引数があればリリース前に失敗します。\n\n## 転送とローカル preview の復旧\n\n- Quick Transfer は固定された同一 origin の fragment だけを許可しつつ、元の `.html` path と Cloudflare clean URL の拡張子なし canonical path の両方を受け入れます。\n- ローカル `.dev.vars` には、独立した十分な長さの privacy salt が 2 つ必要です。UI 確認前の health probe で不足を検出し、secret 値は Git に含めません。\n\n## 検証範囲\n\n中国語・英語・日本語の記事 API、リソースから転送ログイン画面までの実クリック、日本語 course catalog と audio manifest、デスクトップとモバイルの screenshot を確認します。匿名時の転送ログイン表示と日本語のローカル進捗 fallback は意図した動作です。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-resource-icons-layout",
      "slug": "2026-07-18-resource-icons-layout",
      "category": "site-updates",
      "tags": ["Resources", "Quick Transfer", "UI", "mobile", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-18T15:35:00.000Z",
      "updated_at": "2026-07-18T15:35:00.000Z",
      "published_at": "2026-07-18T15:35:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "资源区图标与排版修复",
        "en": "Resources Icon and Layout Fixes",
        "ja": "リソースのアイコンとレイアウト修正"
      },
      "summary": {
        "zh": "修复临时互传整套图标的洋红底色，收紧资源卡片与互传登录布局，并保证关闭互传后准确恢复资源列表；安全、API 与数据边界不变。",
        "en": "The magenta background across the Quick Transfer icon atlas is removed, Resources cards and the sign-in layout are tightened, and closing Transfer now restores the exact Resources list state; security, API, and data boundaries are unchanged.",
        "ja": "一時転送のアイコン atlas 全体に残っていたマゼンタ背景を除去し、リソースカードとログイン画面を整理しました。転送を閉じるとリソース一覧の状態を正確に復元し、安全性、API、データ境界は変更していません。"
      },
      "content_markdown": {
        "zh": "# 资源区图标与排版修复\n\n本轮针对资源区中最明显的图标异常、卡片节奏和临时互传返回状态进行专项复查，继续沿用既有 Windows XP、Pixel Art 与 Y2K 视觉语言。\n\n## 透明且可验证的图标资产\n\n- 临时互传的原始素材是带洋红抠图底色的源图，不能直接缩放为生产图集。现在先完成柔和抠图与边缘去色，再生成 168×168 RGBA 透明图集。\n- 16 个图标单元都加入透明角点与可见像素比例检查，避免只修入口图标而让房间、文件、图片或操作图标继续带紫色方块。\n- 公开资源扫描未发现第二个同类运行时资产；洋红源图继续保留为构建输入，不作为页面资源引用。\n\n## 更紧凑的资源与互传布局\n\n- 桌面资源窗口收敛到与相邻 App 更协调的宽度，资源卡片按真实内容自然增高，不再用固定空白撑高；重复的“可获取”状态也从当前两张可用卡片中移除。\n- 移动端去掉资源卡的强制高度，保留完整说明、元数据、标签与至少 44px 操作，并覆盖 359×500、375×667、390×844 和 844×390。\n- 临时互传登录任务在可用区域内居中，窄屏不再重复显示标题图标。关闭互传时会恢复打开前的分类栏与列表可见状态，不再出现空分类条或列表闪失。\n\n## 验证边界\n\n精确 CDP 尺寸审计以中、英、日三语覆盖资源列表、互传登录和返回资源列表三个状态，并以 Home、Games 作为同壳参考；359×500、375×667、390×844、760×900、844×390 与 1280×720 共 58 个受控检查均通过。Headless 截图不等同真实设备或完整读屏器认证。本轮未连接生产数据，未 push，也未 deploy。",
        "en": "# Resources Icon and Layout Fixes\n\nThis pass focuses on the most visible Resources icon defect, card rhythm, and Quick Transfer return state while preserving the established Windows XP, Pixel Art, and Y2K visual language.\n\n## Transparent, testable icon assets\n\n- The original Quick Transfer artwork is a magenta-key source and must not be resized directly into the production atlas. It is now softly keyed and edge-despilled before generating a 168×168 RGBA transparent atlas.\n- All 16 sprite cells have transparent-corner and visible-pixel-ratio checks, so fixing the entry icon cannot leave room, file, media, or action icons with purple blocks.\n- A public asset sweep found no second affected runtime asset. The magenta source remains a build input and is not referenced by the page.\n\n## Tighter Resources and Transfer layout\n\n- The desktop Resources window now uses a width consistent with neighboring Apps, and cards grow from real content instead of fixed empty height. The redundant Available badge is removed from the two currently usable cards.\n- Mobile cards no longer have forced height while retaining complete descriptions, metadata, tags, and actions of at least 44px across 359×500, 375×667, 390×844, and 844×390.\n- The Quick Transfer sign-in task is centered in the usable area, and narrow screens no longer repeat the heading icon. Closing Transfer restores the exact category and list visibility that existed before opening, avoiding an empty category bar or list flash.\n\n## Verification boundary\n\nExact CDP-size review covers the Resources list, Transfer sign-in, and returned Resources states in Chinese, English, and Japanese, with Home and Games used as same-shell references; all 58 controlled checks pass across 359×500, 375×667, 390×844, 760×900, 844×390, and 1280×720. Headless screenshots are not real-device or complete screen-reader certification. No production data was accessed, and nothing was pushed or deployed.",
        "ja": "# リソースのアイコンとレイアウト修正\n\n今回は、リソース画面で目立っていたアイコン異常、カードの間隔、一時転送から戻る際の状態を重点的に再確認しました。既存の Windows XP、Pixel Art、Y2K の表現は維持しています。\n\n## 透明で検証可能なアイコン素材\n\n- 一時転送の原画はマゼンタキー付きの素材であり、そのまま本番 atlas に縮小できません。現在はソフトなキー処理と輪郭の色除去を行ってから、168×168 の RGBA 透明 atlas を生成します。\n- 16 個すべての sprite cell に透明な四隅と可視ピクセル比率の検査を追加し、入口だけを直してルーム、ファイル、メディア、操作アイコンに紫色の四角が残ることを防ぎます。\n- 公開素材の走査では、同じ問題を持つ別の実行時素材は見つかりませんでした。マゼンタ原画はビルド入力としてのみ保持し、ページからは参照しません。\n\n## 整理されたリソースと転送レイアウト\n\n- デスクトップのリソースウィンドウを隣接 App と調和する幅にし、カードは固定された空白ではなく実際の内容に合わせて伸びます。現在利用可能な 2 枚のカードから重複する「利用可能」表示も外しました。\n- モバイルカードの強制高さを廃止し、359×500、375×667、390×844、844×390 で説明、メタ情報、タグ、44px 以上の操作を維持します。\n- 一時転送のログイン課題を利用可能領域の中央に置き、狭い画面では見出しアイコンを重複表示しません。転送を閉じると、開く前のカテゴリと一覧の表示状態を正確に復元し、空のカテゴリバーや一覧のちらつきを防ぎます。\n\n## 検証範囲\n\n正確な CDP サイズで、中国語・英語・日本語のリソース一覧、転送ログイン、リソースへ戻った状態を確認し、同じシェルの Home と Games も参照しました。359×500、375×667、390×844、760×900、844×390、1280×720 の計 58 件の制御済み検査はすべて成功しています。Headless のスクリーンショットは実機や完全なスクリーンリーダー認証ではありません。本番データへの接続、push、deploy は行っていません。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-public-site-100-complete",
      "slug": "2026-07-18-public-site-100-complete",
      "category": "site-updates",
      "tags": ["performance", "UX", "accessibility", "mobile", "security", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-18T04:00:00.000Z",
      "updated_at": "2026-07-18T04:00:00.000Z",
      "published_at": "2026-07-18T04:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "公开主站 100 项优化与稳定性复查完成",
        "en": "100 Public-Site Improvements and Stability Recheck",
        "ja": "公開サイト 100 項目の改善と安定性再確認"
      },
      "summary": {
        "zh": "公开主站 100 项优化及稳定性复查已完成：修复冷启动 Chat 图标、短屏头像和移动 Dock 切换闪失，并以全动效中间帧、快速连续切换及竖横屏截图重新验证。",
        "en": "All 100 public-site improvements and the stability recheck are complete: cold-start Chat icons, short-screen avatars, and mobile Dock flicker are fixed and reverified with full-motion intermediate frames, rapid switching, and portrait/landscape screenshots.",
        "ja": "公開サイト 100 項目の改善と安定性再確認を完了しました。初回表示の Chat アイコン、短画面のアバター、モバイル Dock の切替時の消失を修正し、フルモーションの中間フレーム、連続切替、縦横画面のスクリーンショットで再検証しています。"
      },
      "content_markdown": {
        "zh": "# 公开主站 100 项优化与稳定性复查完成\n\n公开主站的 UI、UX、动效、视觉、性能、响应式、无障碍、安全与发布质量 100 项计划已经完整收口，并继续保持 Windows XP、Pixel Art 与 Y2K 的既有身份。\n\n## 更轻且可恢复\n\n- 四时段壁纸、窗口背景、入口图标和 Quick Transfer 图集完成按槽位压缩，并提供响应式 AVIF / WebP 与可靠 fallback；首屏只预加载当前主题和当前壳。\n- Knowledge、Videos、Games 与社交数据使用有界 ETag / SWR / last-known-good 缓存。短暂失败保留已成功内容，用户重试可绕过新鲜缓存。\n- 生产构建提供内容哈希、白名单 manifest、可定位 sourcemap 与分层缓存策略，同时不改变根目录 Git 自动部署链。\n\n## 核心流程与移动体验\n\n- Home 欢迎、最近更新、桌面图标键盘导航、顶栏和 About 外链更清楚；Knowledge、文章、视频、资源、游戏与可选 Blog 的加载、空态、恢复、焦点和滚动路径统一。\n- Chat 与 Quick Transfer 完成增量游标、单飞刷新、稳定 DOM、草稿保护、幂等、队列背压、取消/重试和旧 D1 安全迁移，并继续遵守 HttpOnly、纯文本渲染与隐私边界。\n- 359×500、375×667、390×844、844×390 的中英日布局覆盖 App 高度、卡片包含、44px 触控、Dock、forced-colors、日文断行与四档动效。\n\n## 稳定性复查补充\n\n- Home 的 Chat 图标改由始终加载的主壳样式提供，聊天室标题栏与短屏头像统一使用真实 Chat 资产。\n- 移动页面切换改为只动画当前 App 表面，不再让整页快照覆盖固定顶栏与 Dock；40ms 快速连续切换仍保持最终路由和选中状态一致。\n- 在完整动效下采集切换前、起始、60ms、140ms 与稳定帧，并复拍 359×500、390×844、844×390 竖横屏布局。\n\n## 验证边界\n\n本地发布闸门覆盖自动化测试、公共模块图、静态构建检查、可复现生产构建、本地 D1 迁移和隔离 Headless UI 矩阵。Headless 结果不等同真实设备或完整读屏器认证；本轮未连接生产数据，未 push，也未 deploy。",
        "en": "# 100 Public-Site Improvements and Stability Recheck\n\nThe 100-item public-site plan for UI, UX, motion, visuals, performance, responsive behavior, accessibility, security, and release quality is complete while preserving the established Windows XP, Pixel Art, and Y2K identity.\n\n## Lighter and recoverable\n\n- Four-time-period wallpapers, window backdrops, entry icons, and the Quick Transfer atlas are compressed for their real slots, with responsive AVIF / WebP and reliable fallbacks. The first view preloads only the current theme and shell.\n- Knowledge, Videos, Games, and social data use bounded ETag / SWR / last-known-good caching. Temporary failures retain successful content, and an explicit retry bypasses fresh cache.\n- The production build provides content hashes, an allowlisted manifest, traceable sourcemaps, and layered cache policy without replacing the repository-root Git deployment chain.\n\n## Core flows and mobile experience\n\n- Home welcome content, recent updates, desktop-icon keyboard navigation, top chrome, and About links are clearer. Knowledge, articles, videos, resources, games, and the optional Blog share consistent loading, empty, recovery, focus, and scroll behavior.\n- Chat and Quick Transfer add incremental cursors, single-flight refresh, stable DOM updates, draft safety, idempotency, queue backpressure, cancel/retry, and safe legacy D1 migration while retaining HttpOnly, plain-text rendering, and privacy boundaries.\n- The Chinese, English, and Japanese matrix at 359×500, 375×667, 390×844, and 844×390 covers App height, card containment, 44px targets, Dock behavior, forced colors, Japanese line breaking, and four motion tiers.\n\n## Stability recheck addendum\n\n- The Home Chat icon now belongs to the always-loaded shell stylesheet; the Chat titlebar and short-screen avatar use the real Chat asset consistently.\n- Mobile page navigation animates only the active App surface, so a full-page snapshot can no longer cover the fixed topbar or Dock. A 40ms rapid double switch still settles on the correct final route and selected item.\n- Full-motion evidence captures before, start, 60ms, 140ms, and stable frames, with additional portrait and landscape checks at 359×500, 390×844, and 844×390.\n\n## Verification boundary\n\nLocal release gates cover automated tests, the public module graph, static build checks, reproducible production output, local D1 migration, and an isolated Headless UI matrix. Headless results are not real-device or complete screen-reader certification. No production data was accessed, and nothing was pushed or deployed.",
        "ja": "# 公開サイト 100 項目の改善と安定性再確認\n\nUI、UX、モーション、ビジュアル、性能、レスポンシブ、アクセシビリティ、安全性、リリース品質に関する公開サイトの 100 項目を完了しました。既存の Windows XP、Pixel Art、Y2K の表現は維持しています。\n\n## 軽量で復旧可能\n\n- 4 時間帯の壁紙、ウィンドウ背景、入口アイコン、Quick Transfer atlas を実際の表示枠に合わせて圧縮し、レスポンシブ AVIF / WebP と確実な fallback を用意しました。初期表示は現在のテーマとシェルだけを先読みします。\n- Knowledge、Videos、Games、ソーシャルデータは上限付き ETag / SWR / last-known-good キャッシュを使用します。一時的な失敗でも成功済み内容を保持し、明示的な再試行は新鮮なキャッシュを迂回します。\n- 本番ビルドは内容ハッシュ、許可リスト manifest、追跡可能な sourcemap、階層別キャッシュ方針を提供し、リポジトリ直下の Git デプロイ経路は変更しません。\n\n## 主要フローとモバイル体験\n\n- Home の歓迎表示、最近の更新、デスクトップアイコンのキーボード操作、上部 UI、About リンクを整理しました。Knowledge、記事、動画、リソース、ゲーム、任意の Blog は読み込み、空状態、復旧、フォーカス、スクロールを統一しています。\n- Chat と Quick Transfer は増分カーソル、単一通信、安定 DOM、下書き保護、冪等性、キュー制御、取消／再試行、旧 D1 の安全な移行を備え、HttpOnly、プレーンテキスト描画、プライバシー境界を維持します。\n- 359×500、375×667、390×844、844×390 の中英日マトリクスで App 高さ、カード内包、44px 操作、Dock、forced-colors、日本語改行、4 段階モーションを確認します。\n\n## 安定性再確認の追記\n\n- Home の Chat アイコンを常時読み込むシェル用スタイルに移し、Chat のタイトルバーと短画面のアバターで実際の Chat 素材を統一して使用します。\n- モバイルの画面遷移は現在の App 面だけをアニメーションし、全画面スナップショットが固定トップバーや Dock を覆わないようにしました。40ms 間隔の連続切替でも最終ルートと選択状態が一致します。\n- フルモーションで切替前、開始、60ms、140ms、安定後のフレームを収集し、359×500、390×844、844×390 の縦横画面も再確認しました。\n\n## 検証範囲\n\nローカルのリリースゲートは自動テスト、公開モジュールグラフ、静的ビルド検査、再現可能な本番成果物、ローカル D1 移行、分離 Headless UI マトリクスを対象にします。Headless の結果は実機や完全なスクリーンリーダー認証ではありません。本番データへの接続、push、deploy は行っていません。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-reliable-forms-reading-chat",
      "slug": "2026-07-18-reliable-forms-reading-chat",
      "category": "site-updates",
      "tags": [
        "account",
        "reading",
        "chat",
        "privacy",
        "accessibility",
        "QA"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-18T00:26:00.000Z",
      "updated_at": "2026-07-18T00:26:00.000Z",
      "published_at": "2026-07-18T00:26:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "账号、阅读与聊天可靠性升级",
        "en": "More Reliable Account, Reading, and Chat Flows",
        "ja": "アカウント・閲覧・Chat の信頼性向上"
      },
      "summary": {
        "zh": "账号表单改为稳定 DOM 与明确登录/注册模式，文章只保留正文滚动并使用 4px 进度条；Chat 保留在途新草稿和私聊安全说明，公共隐私闸门同步加固。",
        "en": "Account forms now keep a stable DOM with explicit sign-in and registration modes; articles use one content scroller and a 4px progress track; Chat preserves in-flight drafts and private-room safety guidance while public privacy gates are tightened.",
        "ja": "アカウントフォームを安定 DOM と明確なログイン／登録モードに変更し、記事は一つの本文スクロールと 4px の進捗線を使用します。Chat は送信中の新しい下書きと非公開ルームの安全説明を保持し、公開プライバシー境界も強化しました。"
      },
      "content_markdown": {
        "zh": "# 账号、阅读与聊天可靠性升级\n\n本轮集中修复公开主站中最容易造成输入丢失、内容遮挡和隐私回归的路径，同时延续 Windows XP、Pixel Art 与 Y2K 的既有界面语言。\n\n## 稳定且可恢复的账号流程\n\n- 账号表单现在只创建一次稳定 DOM。身份初始化、语言切换、模式切换、开关弹层和请求失败不会再重建字段或清空正在编辑的邮箱与密码。\n- 登录与注册成为明确模式，每种模式只有一个主提交动作；可见 label、正确 autocomplete、密码显示、注册确认与匹配校验均已补齐。\n- 字段错误、忙碌原因和退出失败会真实呈现并把焦点移到可恢复位置。Escape、外点与移动 44px 关闭入口都会把焦点归还触发源。\n- Quick Transfer 的未登录状态压缩为单一任务卡，登录后回到原 Transfer 上下文，不再重复表达门槛或使用含糊的红色关闭动作。\n\n## 不遮挡的文章与不丢草稿的 Chat\n\n- 文章阅读时 document 高度严格等于视口，正文详情成为唯一纵向滚动所有者；桌面与移动端的顶栏、任务栏和返回入口保持稳定。\n- 原先覆盖正文的阅读进度层改为窗口内状态，实际进度轨道为 4px、与正文零交叠，屏幕可见百分比和读屏数值误差不超过 2%。\n- Chat 发送期间只锁定提交按钮，输入框与软键盘继续可用；旧请求只会清空未被编辑过的原始草稿，不会删除用户在等待期间输入的新文字。\n- 359×500 下普通房日志保持 177px，私聊表单展开时保持至少 119px；口令用途、最短长度与风险说明通过 44px 折叠入口可达且不覆盖日志。\n\n## 隐私边界与验证\n\n公开 Chat 不再为旧消息回退暴露服务端隐藏访客标识。新增闸门同时约束安全 DOM、密码与草稿的存储/日志/遥测边界，以及外链、媒体、iframe 与 Transfer 片段白名单。当前 112/112 自动化测试、完整构建和 140/140 受控 Headless Chrome 审计均已通过；未访问生产数据，未 push，未 deploy。",
        "en": "# More Reliable Account, Reading, and Chat Flows\n\nThis release fixes the public paths most likely to lose editing state, cover content, or regress privacy while retaining the site's established Windows XP, Pixel Art, and Y2K language.\n\n## Stable and recoverable account work\n\n- The account form now creates one stable DOM tree. Session initialization, language and mode changes, opening or closing the popover, and request failures no longer rebuild fields or clear an email or password being edited.\n- Sign-in and registration are explicit modes with one primary submit action each. Persistent labels, correct autocomplete values, password reveal controls, confirmation, and matching validation are included.\n- Field errors, busy reasons, and logout failures report the real state and move focus to a recoverable target. Escape, outside clicks, and the mobile 44px close action return focus to the originating control.\n- Quick Transfer reduces its signed-out gate to one task card and returns to the original Transfer context after sign-in, without duplicated instructions or an ambiguous red close action.\n\n## Unobstructed articles and draft-safe Chat\n\n- While reading, the document height exactly matches the viewport and the article detail is the only vertical scroll owner. Desktop and mobile chrome, taskbar, and return control stay stable.\n- The former content-covering progress overlay is now an in-window status with a 4px track and zero article overlap. Its visible percentage and screen-reader value stay within two percentage points.\n- During Chat sending, only the submit action is locked. The input and on-screen keyboard remain available, and an older request clears only an untouched submitted draft, never text entered while waiting.\n- At 359×500, the public-room log remains 177px and the private-room state remains at least 119px. Password purpose, minimum length, and risk guidance are reachable through a 44px disclosure without covering the log.\n\n## Privacy boundary and verification\n\nPublic Chat no longer falls back to a hidden server visitor identifier for legacy messages. New gates also lock safe DOM rendering, password and draft storage/logging/telemetry boundaries, and the narrow allowlists for links, media, iframes, and the Transfer fragment. All 112/112 automated tests, the complete build, and all 140/140 controlled Headless Chrome checks pass. No production data was accessed, and nothing was pushed or deployed.",
        "ja": "# アカウント・閲覧・Chat の信頼性向上\n\n今回の更新では、入力の消失、本文の遮蔽、プライバシー回帰が起きやすい公開経路を修正し、既存の Windows XP、Pixel Art、Y2K の表現を維持しました。\n\n## 安定して復旧できるアカウント操作\n\n- アカウントフォームは一度だけ安定した DOM を作成します。セッション初期化、言語・モード切替、ポップオーバーの開閉、通信失敗で編集中のメールやパスワードを再作成・消去しません。\n- ログインと登録を明確なモードに分け、各モードの主要送信操作を一つにしました。常時表示ラベル、適切な autocomplete、パスワード表示、登録確認、一致検証を備えます。\n- フィールドエラー、処理中の理由、ログアウト失敗を実状態のまま通知し、復旧可能な位置へフォーカスを移します。Escape、外側クリック、モバイルの 44px 閉じる操作は起点へフォーカスを返します。\n- Quick Transfer の未ログイン表示は一つのタスクカードに整理し、ログイン後は元の Transfer 文脈へ戻ります。重複説明や曖昧な赤い閉じる操作は使用しません。\n\n## 本文を隠さない記事と下書きを守る Chat\n\n- 記事閲覧中は document の高さをビューポートと一致させ、記事詳細だけを縦スクロール所有者にします。デスクトップとモバイルの上部 UI、タスクバー、戻る操作は安定します。\n- 本文を覆っていた進捗レイヤーをウィンドウ内の状態表示へ変更しました。実際の進捗線は 4px で本文との重なりはなく、表示値と読み上げ値の誤差は 2 ポイント以内です。\n- Chat の送信中は送信操作だけをロックし、入力欄と画面キーボードは使い続けられます。古い要求が消去できるのは未編集の送信済み下書きだけで、待機中に入力した新しい文章は失われません。\n- 359×500 では公開ルームのログを 177px、非公開ルームを 119px 以上に保ちます。パスワードの用途、最短長、危険性の説明は 44px の開閉操作から到達でき、ログを覆いません。\n\n## プライバシー境界と検証\n\n公開 Chat は古いメッセージでもサーバー内部の訪問者 ID へフォールバックしません。安全な DOM、パスワードと下書きの保存・ログ・テレメトリ境界、外部リンク、メディア、iframe、Transfer fragment の限定許可も自動検査で固定しました。112/112 の自動テスト、完全ビルド、140/140 の制御済み Headless Chrome 監査が成功しています。本番データへの接続、push、deploy は行っていません。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-route-lazy-transfer",
      slug: "2026-07-18-route-lazy-transfer",
      category: "site-updates",
      tags: ["performance", "lazy-loading", "routes", "transfer", "UX", "QA"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T23:35:00.000Z",
      updated_at: "2026-07-17T23:35:00.000Z",
      published_at: "2026-07-17T23:35:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.18",
      title: {
        zh: "路由与临时互传按需加载",
        en: "On-Demand Routes and Quick Transfer",
        ja: "ルートと一時転送のオンデマンド読込"
      },
      summary: {
        zh: "Home 初始数据缩至约 8 KB 的五条更新摘要；五个业务路由与四份重样式首次进入时加载并复用，Quick Transfer 只在真实 CTA 点击后加载完整链路，失败可重试且离开不误初始化。",
        en: "Home now starts with about 8 KB of five update summaries; five route modules and four heavy styles load once on first entry, while Quick Transfer loads its full chain only after a real CTA click with retry-safe, leave-safe initialization.",
        ja: "Home の初期データを約 8 KB・5 件の更新要約に縮小し、5 つのルートモジュールと 4 つの重い CSS は初回進入時だけ読み込みます。一時転送は実際の CTA 操作後に全構成を読み込み、再試行と離脱競合にも対応します。"
      },
      content_markdown: {
        zh: "# 路由与临时互传按需加载\n\n本轮把公开主站的非首屏业务与临时互传改为真正按需加载，同时保持 Windows XP、Pixel Art 与 Y2K 的视觉、三语界面和既有安全边界。\n\n## 更轻的 Home 与可复用路由\n\n- Home 初始数据只保留约 8 KB 的五条更新摘要，不再携带完整更新正文或未进入路由的业务数据。\n- Knowledge、Videos、Resources、Games 与 Chat 的 JavaScript 在首次进入对应路由时加载；Knowledge、Videos、Games 与 Chat 的四份重路由 CSS 同步按需加载。\n- 模块、样式和初始化承诺会被缓存并复用，返回已访问路由不会重复下载、重复初始化或产生闪烁。\n\n## 点击后才启动 Quick Transfer\n\n- Quick Transfer 的加载器、CSS、客户端、界面片段和 API 链路只在用户真实点击资源卡 CTA 后启动；点击前没有完整 DOM、轮询或 Transfer API 请求。\n- 首次加载保留 XP 风格进度与明确失败状态，失败后可以重试。若加载期间离开 Resources，竞态结果会被丢弃，不会在非活动路由初始化。\n- HttpOnly 会话、AES-GCM、上传与配额边界保持不变；访客内容仍使用安全 DOM API，三语文案完整保留。\n\n## 验证边界\n\n当前 97/97 自动化测试和完整构建已通过；Headless Chrome 精确视口与按需加载审计 137/137 通过。本批未访问生产数据，未 push，也未 deploy。",
        en: "# On-Demand Routes and Quick Transfer\n\nThis release moves non-Home work and Quick Transfer behind real demand boundaries while preserving the public site's Windows XP, Pixel Art, and Y2K visuals, trilingual interface, and existing security model.\n\n## A lighter Home and reusable routes\n\n- Home starts with only about 8 KB containing five update summaries. Full update bodies and unvisited route data are no longer part of its initial data.\n- JavaScript for Knowledge, Videos, Resources, Games, and Chat loads on the first entry to each route. Four heavy route styles for Knowledge, Videos, Games, and Chat load on the same demand boundary.\n- Module, style, and initialization promises are cached and reused, so returning to a visited route does not download or initialize it again and does not introduce a loading flicker.\n\n## Quick Transfer starts after a real click\n\n- The Quick Transfer loader, CSS, client, UI fragment, and API chain start only after the user actually clicks its resource-card CTA. Before that click there is no complete Transfer DOM, polling, or Transfer API request.\n- First load keeps an XP-style progress state and an explicit retryable failure state. If the user leaves Resources during loading, the stale result is discarded and cannot initialize on an inactive route.\n- HttpOnly sessions, AES-GCM, upload, and quota boundaries remain unchanged. Visitor content continues to use safe DOM APIs, and all three interface languages remain available.\n\n## Verification boundary\n\nAll 97/97 automated tests and the complete build pass, together with all 137/137 exact-viewport and demand-loading Headless Chrome audit checks. No production data was accessed, and nothing was pushed or deployed.",
        ja: "# ルートと一時転送のオンデマンド読込\n\n今回の更新では、Home 以外の処理と一時転送を実際の利用時だけ読み込む構成に変更しました。公開サイトの Windows XP、Pixel Art、Y2K の表現、3 言語 UI、既存の安全境界は維持します。\n\n## 軽量な Home と再利用可能なルート\n\n- Home の初期データは約 8 KB、5 件の更新要約だけになり、更新の全文や未訪問ルートの業務データを含みません。\n- Knowledge、Videos、Resources、Games、Chat の JavaScript は各ルートへの初回進入時に読み込みます。Knowledge、Videos、Games、Chat の 4 つの重いルート CSS も同じ境界で読み込みます。\n- モジュール、スタイル、初期化 Promise をキャッシュして再利用するため、訪問済みルートへ戻っても再ダウンロード、重複初期化、読み込み時のちらつきは発生しません。\n\n## 実際のクリック後に一時転送を開始\n\n- 一時転送の loader、CSS、client、UI fragment、API 経路は、利用者がリソースカードの CTA を実際にクリックした後だけ開始します。クリック前には完全な Transfer DOM、ポーリング、Transfer API 通信はありません。\n- 初回読込には XP 形式の進捗表示と再試行可能な失敗状態があります。読込中に Resources から離れた場合、古い結果を破棄し、非アクティブルートでは初期化しません。\n- HttpOnly セッション、AES-GCM、アップロード、容量制限の境界は変更しません。訪問者データには安全な DOM API を使い続け、3 言語表示も維持します。\n\n## 検証範囲\n\n現在 97/97 の自動テストと完全ビルドが成功し、正確なビューポートとオンデマンド読込を検証する Headless Chrome 監査も 137/137 で成功しました。本番データにはアクセスせず、push と deploy も行っていません。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-mobile-viewport-keyboard",
      slug: "2026-07-18-mobile-viewport-keyboard",
      category: "site-updates",
      tags: ["mobile", "viewport", "keyboard", "focus", "accessibility", "QA"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T22:08:00.000Z",
      updated_at: "2026-07-17T22:08:00.000Z",
      published_at: "2026-07-17T22:08:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.18",
      title: {
        zh: "移动视口与软键盘统一避让",
        en: "Unified Mobile Viewport and Keyboard Avoidance",
        ja: "モバイルビューポートとキーボード回避の統合"
      },
      summary: {
        zh: "移动端现在统一处理安全区、地址栏收放、旋转、页面缩放与软键盘状态；Chat、账号、搜索和 Transfer 会在同一滚动容器内保持输入、提交与反馈可见。",
        en: "Mobile safe areas, browser chrome, rotation, page zoom, and on-screen keyboard states now share one viewport model, keeping Chat, account, search, and Transfer controls visible inside one scroll owner.",
        ja: "モバイルのセーフエリア、ブラウザー UI、回転、ページ拡大、画面キーボードを一つのビューポートモデルで扱い、Chat、アカウント、検索、Transfer の操作を同じスクロール領域内で表示します。"
      },
      content_markdown: {
        zh: "# 移动视口与软键盘统一避让\n\n本轮把公开主站移动壳的安全区、地址栏收放、旋转、页面缩放和软键盘避让收敛到唯一视口状态源，同时保留 Windows XP、Pixel Art 与 Y2K 的固定壳构图。\n\n## 一个视口状态源\n\n- FramePipeline 现在同时记录布局与可见视口宽高、偏移、页面缩放、方向、键盘状态，并区分 `stable`、`browser-ui`、`keyboard` 与 `zoom`。\n- 每个方向维护独立稳定高度基线；只有编辑控件聚焦且高度减少至少 96px 或 18% 时才进入键盘态。键盘关闭前会保持状态，恢复后布局与 Dock 自动回到用户原来的展开或折叠偏好。\n- 页面缩放使用布局视口尺寸并把键盘偏移保持为 0，避免把双指缩放误判成软键盘。统一 data 属性和 CSS 变量在同一写阶段提交。\n\n## 同一滚动所有者内的完整操作\n\n- Chat 输入、发送与反馈，私聊口令与进入动作，Knowledge 搜索、账号表单，以及 Transfer 房间入口和 composer 都按组合矩形测量。\n- 聚焦恢复只修改最近真实纵向滚动容器的 `scrollTop`，不会移动 document、Home、Appbar 或整站壳；键盘打开时 Dock 仅临时退出并释放占位。\n- 账号提交错误改为原地状态更新，保留邮箱、密码、焦点和键盘。Transfer 删除了自己的 viewport 订阅、几何恢复与 `scrollIntoView`，统一委托移动壳。\n\n## 验证边界\n\n受控 Headless Chrome 使用高度收缩、浏览器 UI 高度代理、方向往返、原生 page scale、safe-area 变量代理及 Dock 两种偏好验证状态、滚动所有者和控件可见性。它不等同真实 iOS / Android 软键盘、刘海安全区或浏览器地址栏认证，因此报告明确保留 `realSoftKeyboardTested:false`、`realSafeAreaTested:false` 和 `realBrowserChromeTested:false`。本批未连接生产数据，也未推送或部署。",
        en: "# Unified Mobile Viewport and Keyboard Avoidance\n\nThis release brings safe areas, browser chrome changes, rotation, page zoom, and on-screen keyboard avoidance into the public mobile shell's single viewport state source while preserving its fixed Windows XP, Pixel Art, and Y2K composition.\n\n## One viewport state source\n\n- FramePipeline now records layout and visual dimensions, offsets, page scale, orientation, and keyboard state, classifying each frame as `stable`, `browser-ui`, `keyboard`, or `zoom`.\n- Each orientation keeps its own stable-height baseline. Keyboard mode requires an editing control to have focus and a reduction of at least 96px or 18%. The state remains until height recovers, after which layout and the Dock return to the user's original expanded or collapsed preference.\n- Page zoom uses layout viewport dimensions and keeps keyboard offset at zero, so pinch zoom is not mistaken for an on-screen keyboard. Shared data attributes and CSS variables commit in the same write phase.\n\n## Complete actions inside one scroll owner\n\n- Chat input, send, and feedback; private-room password and enter action; Knowledge search; account forms; and Transfer room entry and composer are measured as contextual groups.\n- Focus recovery mutates only the nearest real vertical owner's `scrollTop`. It never moves the document, Home, App bar, or whole site shell. While the keyboard is open, the Dock temporarily leaves view and releases its reserved space.\n- Account submission errors now update status in place, preserving email, password, focus, and keyboard. Transfer removed its private viewport subscription, geometry recovery, and `scrollIntoView`, delegating to the mobile shell instead.\n\n## Verification boundary\n\nControlled Headless Chrome uses height contraction, a browser-UI height proxy, orientation round trips, native page scale, safe-area variable proxies, and both Dock preferences to verify state, scroll ownership, and control visibility. This is not certification on real iOS or Android keyboards, notches, or browser chrome, so the report explicitly keeps `realSoftKeyboardTested:false`, `realSafeAreaTested:false`, and `realBrowserChromeTested:false`. No production data is accessed, and nothing is pushed or deployed.",
        ja: "# モバイルビューポートとキーボード回避の統合\n\n今回の更新では、公開サイトの固定モバイルシェルを維持したまま、セーフエリア、ブラウザー UI の伸縮、回転、ページ拡大、画面キーボード回避を一つのビューポート状態源に統合しました。Windows XP、Pixel Art、Y2K の構図は保持します。\n\n## 一つのビューポート状態源\n\n- FramePipeline はレイアウトと表示ビューポートの寸法、オフセット、ページ倍率、向き、キーボード状態を記録し、`stable`、`browser-ui`、`keyboard`、`zoom` を区別します。\n- 縦向きと横向きは別々の安定高さ基準を持ちます。編集操作にフォーカスがあり、高さが 96px または 18% 以上減った場合だけキーボード状態になります。高さが戻るまで状態を保持し、復元後はレイアウトと Dock が利用者の元の展開・折りたたみ設定へ戻ります。\n- ページ拡大時はレイアウトビューポートを使い、キーボードオフセットを 0 に保つため、ピンチズームを画面キーボードと誤判定しません。共通 data 属性と CSS 変数は同じ書き込み段階で反映されます。\n\n## 同じスクロール所有者内で操作を表示\n\n- Chat の入力・送信・フィードバック、非公開ルームのパスワードと入室操作、Knowledge 検索、アカウントフォーム、Transfer のルーム入口と composer を操作単位の矩形として測定します。\n- フォーカス復元は最寄りの実際の縦スクロール所有者の `scrollTop` だけを変更します。document、Home、App バー、サイト全体は移動しません。キーボード表示中は Dock だけが一時的に退避し、予約領域を解放します。\n- アカウント送信エラーはその場で状態だけを更新し、メール、パスワード、フォーカス、キーボードを保持します。Transfer の独自 viewport 購読、形状復元、`scrollIntoView` は削除し、モバイルシェルへ統一しました。\n\n## 検証範囲\n\n制御した Headless Chrome で、高さ縮小、ブラウザー UI 高さの代理、画面方向の往復、ネイティブ page scale、safe-area 変数の代理、Dock の二つの設定を確認します。実機 iOS / Android のキーボード、ノッチ、ブラウザー UI の認証ではないため、レポートは `realSoftKeyboardTested:false`、`realSafeAreaTested:false`、`realBrowserChromeTested:false` を明示します。本番データには接続せず、push や deploy も行っていません。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-mobile-scroll-recovery",
      slug: "2026-07-18-mobile-scroll-recovery",
      category: "site-updates",
      tags: ["mobile", "scroll", "focus", "accessibility", "QA"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T21:32:00.000Z",
      updated_at: "2026-07-17T21:32:00.000Z",
      published_at: "2026-07-17T21:32:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.18",
      title: {
        zh: "移动固定壳的滚动与焦点恢复",
        en: "Mobile Fixed-Shell Scroll and Focus Recovery",
        ja: "モバイル固定シェルのスクロールとフォーカス復元"
      },
      summary: {
        zh: "移动 App 内容增长或可见高度受限时，会保留真实纵向滚动逃生路径；聚焦控件由统一帧管线滚入最近内容容器，同时不移动 Home、顶栏或 Dock。",
        en: "Growing mobile App content and constrained viewports now retain a real vertical escape path, while the frame pipeline reveals focused controls inside the nearest content scroller without moving Home, the App bar, or the Dock.",
        ja: "モバイル App の内容増加や表示高さの制限時にも実際の縦スクロール経路を維持し、統合フレーム処理が Home、App バー、Dock を動かさず最寄りのコンテンツ領域へフォーカス中の操作を表示します。"
      },
      content_markdown: {
        zh: "# 移动固定壳的滚动与焦点恢复\n\n本轮为公开主站的固定移动壳补齐内容增长与受限高度下的恢复路径，同时保留 Home 固定桌面构图、顶部 Appbar 和底部 Dock。\n\n## 真实滚动所有者\n\n- 非 Home 的活动 App 窗口现在提供休眠式纵向溢出兜底；只有内部内容确实增长时才成为可用滚动路径，默认视口和布局尺寸不变。\n- Knowledge、Videos、Resources、Games、Blog、About 与 Chat 的既有内部滚动区域允许在到达边界后把剩余滚动交给活动窗口。文章阅读态继续由正文详情独占滚动，避免重新出现双重滚动。\n- Quick Transfer 的登录、房间入口与房间内容沿用自身安全流程，只补齐纵向滚动链和聚焦留白，不改变会话、加密或上传协议。\n\n## 焦点恢复\n\n- 移动 App 的 `focusin` 会通过唯一帧管线测量最近一个真正可滚动的祖先和当前可见高度，再只写入该容器的 `scrollTop`。\n- Home 仅允许账号浮层参与这条恢复路径；普通 Home 构图、页面文档、Appbar 和 Dock 都不会被焦点恢复移动。\n- Transfer 继续使用自己的聚焦恢复逻辑，不建立第二套原生 VisualViewport 监听。\n\n## 验证边界\n\n受控 Headless Chrome 以内容增长、390×500 受限高度、2 倍页面缩放以及既有精确视口验证真实滚动所有者、焦点可见性、文档滚动为 0 与默认构图不回归。该测试不模拟真实 iOS / Android 屏幕软键盘；完整地址栏、安全区、旋转和键盘避让继续由后续专项处理。本批未连接生产数据，也未发布或部署。",
        en: "# Mobile Fixed-Shell Scroll and Focus Recovery\n\nThis release gives the public mobile fixed shell a recovery path for growing content and constrained height while preserving the fixed Home desktop composition, top App bar, and bottom Dock.\n\n## Real scroll ownership\n\n- The active non-Home App window now has a dormant vertical overflow fallback. It becomes a usable path only when its content truly grows, so default viewport geometry and layout dimensions remain unchanged.\n- Existing internal scrollers in Knowledge, Videos, Resources, Games, Blog, About, and Chat can hand remaining movement to the active window at their boundary. Article reading keeps the detail body as its exclusive scroll owner, preventing nested scrolling from returning.\n- Quick Transfer login, room entry, and room content retain their existing security flow. Only vertical chaining and focus padding change; session, encryption, and upload protocols do not.\n\n## Focus recovery\n\n- A mobile App `focusin` is measured through the single frame pipeline. It finds the nearest genuinely scrollable ancestor and the current visible height, then mutates only that container's `scrollTop`.\n- On Home, only the account popover may use this recovery path. The normal Home composition, document, App bar, and Dock are never moved by focus recovery.\n- Transfer continues to use its own focused-control recovery without creating a second native VisualViewport listener.\n\n## Verification boundary\n\nControlled Headless Chrome exercises growing content, a constrained 390×500 viewport, native 2× page scale, and the established exact viewport matrix. It verifies the real scroll owner, focused-control visibility, a zero document scroll position, and unchanged default composition. This does not emulate a real iOS or Android on-screen keyboard; complete address-bar, safe-area, rotation, and keyboard avoidance remain a follow-up. No production data, release, or deployment is involved.",
        ja: "# モバイル固定シェルのスクロールとフォーカス復元\n\n今回の更新では、公開サイトの固定モバイルシェルに、内容増加と高さ制限時の復元経路を追加しました。Home の固定デスクトップ構図、上部 App バー、下部 Dock は維持します。\n\n## 実際のスクロール所有者\n\n- Home 以外のアクティブ App ウィンドウに、待機状態の縦オーバーフロー代替経路を追加しました。実際に内容が増えた時だけ有効になり、通常のビューポート形状とレイアウト寸法は変わりません。\n- Knowledge、Videos、Resources、Games、Blog、About、Chat の既存内部スクローラーは、端に達した後の移動をアクティブウィンドウへ渡せます。記事閲覧中は本文詳細を唯一のスクロール所有者とし、二重スクロールの再発を防ぎます。\n- Quick Transfer のログイン、ルーム入口、ルーム内容は既存の安全性フローを維持します。縦方向の連鎖とフォーカス余白だけを変更し、セッション、暗号化、アップロード方式は変更しません。\n\n## フォーカス復元\n\n- モバイル App の `focusin` は唯一のフレームパイプラインで計測されます。実際にスクロール可能な最寄りの祖先と現在の可視高さを取得し、そのコンテナの `scrollTop` だけを更新します。\n- Home ではアカウントポップオーバーだけがこの復元経路を使用できます。通常の Home 構図、ドキュメント、App バー、Dock はフォーカス復元で移動しません。\n- Transfer は 2 組目のネイティブ VisualViewport リスナーを作らず、独自のフォーカス中コントロール復元を維持します。\n\n## 検証範囲\n\n制御された Headless Chrome で、内容増加、390×500 の高さ制限、ネイティブ 2 倍ページ倍率、既存の正確なビューポート行列を確認します。実際のスクロール所有者、フォーカス中操作の可視性、ドキュメントのスクロール位置 0、通常構図の非回帰を検証します。この自動化は実際の iOS / Android 画面キーボードを再現しません。完全なアドレスバー、セーフエリア、回転、キーボード回避は後続の専門作業で扱います。本番データへの接続、公開、デプロイは行っていません。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-frame-pipeline-low-performance",
      slug: "2026-07-18-frame-pipeline-low-performance",
      category: "site-updates",
      tags: ["performance", "viewport", "mobile", "accessibility", "QA"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T21:12:00.000Z",
      updated_at: "2026-07-17T21:12:00.000Z",
      published_at: "2026-07-17T21:12:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.18",
      title: {
        zh: "统一帧管线与低性能绘制档",
        en: "Unified Frame Pipeline and Low-Performance Paint Tier",
        ja: "統合フレームパイプラインと低性能描画モード"
      },
      summary: {
        zh: "窗口、可视视口与关键滚动测量现在由同一帧管线统一先读后写；Save-Data 和明确低配设备会启用清晰的实色低性能绘制档。",
        en: "Window, VisualViewport, and key scroll measurements now share one read-then-write frame pipeline, with a clear solid-surface tier for Save-Data and confirmed low-end devices.",
        ja: "Window、VisualViewport、主要スクロール計測を 1 つの読み取り・書き込みフレームへ統合し、Save-Data と明確な低性能端末には判読しやすい単色描画モードを適用します。"
      },
      content_markdown: {
        zh: "# 统一帧管线与低性能绘制档\n\n本轮把公开主站分散的窗口、VisualViewport 与关键滚动工作收敛到一个可审计的单帧调度器，同时为节省流量和明确低配设备提供不牺牲功能与对比度的绘制降级。\n\n## 单帧先读后写\n\n- `mobile-shell.js` 现在是窗口 resize、VisualViewport resize 与 scroll 的唯一原生监听者；同一事件风暴中的同键任务只保留最后一次，并在一帧内先完成全部布局读取，再完成全部样式写入。\n- Home 壁纸舞台与桌面图标几何、Knowledge 文章进度与目录、移动 Dock、动效层和 Quick Transfer 聚焦控件都接入同一管线；离开路由会退订对应任务。\n- 视口宽高、键盘偏移和 Dock 选中面在同一帧提交。原生页面缩放比例不为 1 时，缩小的 VisualViewport 不会被误判成软键盘。\n- 构建守卫会拒绝主脚本重新增加第二套原生 viewport 监听，并检查主消费者继续遵守 keyed measure/mutate 契约。\n\n## 清晰的低性能绘制档\n\n- 浏览器启用 Save-Data，或明确报告不超过 2 个逻辑核心 / 2GiB 设备内存时进入 `low`；能力未知的设备保持 `normal`，不会被猜测性降级。\n- `low` 关闭大面积 blur、backdrop-filter、壁纸 filter、循环云层、常驻 `will-change` 与全页 View Transition，并为顶部栏、任务栏、Dock、账户层和模态遮罩提供实色高对比回退。\n- `normal` 档的 XP、Pixel Art、Y2K 壁纸、玻璃层次和交互保持不变；小图标阴影与短暂 transform/opacity 反馈继续保留。\n\n## 验证边界\n\n受控 Headless Chrome 通过 117 项检查：40 组同帧事件只产生一次读阶段与一次写阶段，390×844 / 844×390 的视口变量和 Dock 几何一致，原生 2 倍页面缩放的键盘偏移为 0，Save-Data、2 核与未知能力三种档位判定正确，低性能截图无大面积滤镜残留且文字与控件清楚。该自动化没有模拟或声称验证真实 iOS / Android 屏幕软键盘；本批未连接生产数据，也未发布或部署。",
        en: "# Unified Frame Pipeline and Low-Performance Paint Tier\n\nThis release consolidates scattered window, VisualViewport, and key scroll work into one auditable frame scheduler, while giving data-saving and confirmed low-end devices a paint fallback that preserves function and contrast.\n\n## Read once, then write once per frame\n\n- `mobile-shell.js` is now the only native listener for window resize plus VisualViewport resize and scroll. Repeated requests for the same key within an event storm keep the latest job, all layout reads run first, and all style writes follow in the same frame.\n- The Home wallpaper stage and desktop-icon geometry, Knowledge reading progress and table of contents, mobile Dock, motion layer, and focused Quick Transfer control use the same pipeline. Route exits unsubscribe their related jobs.\n- Viewport dimensions, keyboard offset, and the Dock selection surface commit together. When native page scale differs from 1, the smaller VisualViewport is not misclassified as an on-screen keyboard.\n- Build guards reject a second native viewport listener in public scripts and verify that primary consumers retain the keyed measure/mutate contract.\n\n## A clear low-performance paint tier\n\n- `low` activates when Save-Data is enabled or the browser explicitly reports no more than 2 logical cores or 2 GiB of device memory. Devices with unknown capability remain `normal` instead of receiving a guessed downgrade.\n- The low tier removes large blur, backdrop filters, wallpaper filters, looping clouds, permanent `will-change`, and full-page View Transitions. Solid high-contrast fallbacks cover the top bar, taskbar, Dock, account layer, and modal backdrop.\n- The normal tier keeps the XP, Pixel Art, and Y2K wallpaper, glass depth, and interactions unchanged. Small icon shadows and short transform/opacity feedback remain available.\n\n## Verification boundary\n\nControlled Headless Chrome passes 117 checks: 40 same-frame event groups produce one read and one write phase; 390×844 and 844×390 viewport variables match final Dock geometry; native 2× page scale yields zero keyboard offset; Save-Data, two-core, and unknown-capability profiles select the correct tier; and the low-tier screenshot retains clear text and controls without large paint effects. This automation does not emulate or claim validation of a real iOS or Android on-screen keyboard. No production data, release, or deployment is involved.",
        ja: "# 統合フレームパイプラインと低性能描画モード\n\n今回の更新では、分散していた Window、VisualViewport、主要スクロール処理を監査可能な 1 つのフレームスケジューラへ統合し、通信量を節約する設定と明確な低性能端末に、機能とコントラストを維持した描画フォールバックを追加しました。\n\n## 1 フレームで先に読み取り、後で書き込み\n\n- `mobile-shell.js` が window resize、VisualViewport resize、scroll の唯一のネイティブリスナーになりました。同じイベント集中内の同一キーは最新ジョブだけを残し、すべてのレイアウト読み取り後に、同じフレームですべてのスタイル書き込みを行います。\n- Home の壁紙ステージとデスクトップアイコン形状、Knowledge の読書進捗と目次、モバイル Dock、モーション層、Quick Transfer のフォーカス中コントロールが同じパイプラインを使用します。ルート終了時には関連ジョブを解除します。\n- ビューポート寸法、キーボードオフセット、Dock 選択面を同じフレームで反映します。ネイティブページ倍率が 1 以外の時は、縮小した VisualViewport を画面キーボードと誤判定しません。\n- ビルドガードは公開スクリプトへの 2 組目のネイティブ viewport リスナーを拒否し、主要利用箇所の keyed measure/mutate 契約を確認します。\n\n## 判読しやすい低性能描画モード\n\n- Save-Data が有効、またはブラウザが論理コア 2 以下 / 端末メモリ 2GiB 以下を明示した場合に `low` を有効にします。能力が不明な端末は推測で低下させず `normal` を維持します。\n- `low` では大きな blur、backdrop-filter、壁紙 filter、雲のループ、常駐 `will-change`、全画面 View Transition を停止し、トップバー、タスクバー、Dock、アカウント層、モーダル背景へ高コントラストの単色フォールバックを適用します。\n- `normal` の XP、Pixel Art、Y2K 壁紙、ガラスの奥行き、操作感は変更しません。小さなアイコン影と短い transform/opacity フィードバックは維持します。\n\n## 検証範囲\n\n制御された Headless Chrome で 117 項目が成功しました。40 組の同一フレームイベントは読み取り 1 回・書き込み 1 回に統合され、390×844 / 844×390 のビューポート変数と Dock 形状が一致し、ネイティブ 2 倍ページ倍率ではキーボードオフセットが 0 になり、Save-Data、2 コア、能力不明の各プロファイルが正しいモードを選択します。低性能スクリーンショットにも大面積描画効果の残留はなく、文字と操作は明瞭です。この自動化は実際の iOS / Android 画面キーボードを再現したものではなく、その検証を主張しません。本番データへの接続、公開、デプロイは行っていません。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-route-lifecycle-mobile-css",
      slug: "2026-07-18-route-lifecycle-mobile-css",
      category: "site-updates",
      tags: ["performance", "lifecycle", "mobile", "CSS", "QA"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T20:48:00.000Z",
      updated_at: "2026-07-17T20:48:00.000Z",
      published_at: "2026-07-17T20:48:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.18",
      title: {
        zh: "路由生命周期与移动样式权威源",
        en: "Route Lifecycle and Mobile CSS Ownership",
        ja: "ルートライフサイクルとモバイル CSS の一元管理"
      },
      summary: {
        zh: "八个主路由现在显式进入与离开：非活动页会中止请求、定时器和临时监听；移动响应式布局也收敛到单一 CSS 权威文件并由构建守卫防止冲突回归。",
        en: "All eight routes now enter and leave explicitly, aborting inactive requests, timers, and temporary listeners; responsive mobile layout also has one guarded CSS owner.",
        ja: "8 つの主要ルートに明示的な開始・終了処理を設け、非表示ページの通信、タイマー、一時リスナーを停止しました。モバイルレイアウトも 1 つの CSS 管理元へ統合しています。"
      },
      content_markdown: {
        zh: "# 路由生命周期与移动样式权威源\n\n本轮补齐公开主站的路由资源生命周期，并把分散的移动响应式布局收敛到唯一权威文件，为后续懒加载、视口协调和软键盘避让建立可验证基础。\n\n## 路由资源按需启停\n\n- Home、Knowledge、Videos、Resources、Games、Blog、Chat 与 About 都使用显式 `enter/leave` 作用域。每次进入只创建一套监听、定时器、动画帧和 `AbortController`，同一路由重复导航不会再次绑定。\n- 离开 Knowledge、Videos、Games 或 About 时会中止尚未完成的列表请求；Home 不再提前读取这些隐藏路由的数据。返回目标路由时会重新建立干净作用域。\n- Chat 只在活动且可见时轮询；离开或页面隐藏后不保留后台定时器。Quick Transfer 的事件、轮询、请求、XHR 与重试等待也跟随 Resources 生命周期清理。\n- 移动壳和动效层继续作为全站基础设施运行，但会接收统一的路由进入/离开通知，并清理只属于旧路由的临时帧与状态。\n\n## 移动 CSS 单一权威源\n\n- 原先散落在 `style.css` 尾部的响应式媒体规则按原顺序迁入 `mobile-ios-shell.css`，选择器、声明和值保持不变，因此 XP、Pixel Art 与 Y2K 构图不被重画。\n- 动效样式中的移动层级越权被限定到桌面壳；移动关键组件的高度、溢出、定位、布局和层级现在只允许由移动壳文件定义。\n- 构建检查会解析三份主 CSS，逐条报告跨文件重复或越权的移动关键布局属性，防止以后用更高优先级补丁重新制造冲突。\n\n## 验证\n\n受控 Headless Chrome 在 1280×720 与 390×844 连续遍历八个路由，验证同路由不重复绑定、延迟请求在离开时被中止、Chat 与 Transfer 资源归零；完整三语语义、元信息、模态、历史、Caret 和精确视口截图共通过 110 项检查。该自动化验证不连接生产数据，也未执行发布或部署。",
        en: "# Route Lifecycle and Mobile CSS Ownership\n\nThis release adds an explicit resource lifecycle to every public route and consolidates responsive mobile layout under one authoritative stylesheet, creating a testable base for later lazy loading, viewport coordination, and keyboard avoidance.\n\n## Route resources start and stop on demand\n\n- Home, Knowledge, Videos, Resources, Games, Blog, Chat, and About use explicit `enter/leave` scopes. Each entry creates one set of listeners, timers, animation frames, and an `AbortController`; navigating to the same route does not bind them again.\n- Leaving Knowledge, Videos, Games, or About aborts unfinished list requests. Home no longer preloads those hidden-route datasets, and a clean scope is created when the route is opened again.\n- Chat polls only while active and visible, leaving no background timer after a route exit or hidden page. Quick Transfer events, polling, requests, XHR, and retry waits are likewise cleared with the Resources lifecycle.\n- The mobile shell and motion layer remain global site infrastructure, but now receive consistent route enter and leave notifications and discard route-specific transient frames and state.\n\n## One owner for mobile CSS\n\n- Responsive media rules formerly scattered at the end of `style.css` moved, in the same order, into `mobile-ios-shell.css`. Selectors, declarations, and values are unchanged, so the XP, Pixel Art, and Y2K composition is not redesigned.\n- Mobile stacking overrides in the motion sheet are constrained to the desktop shell. Height, overflow, positioning, layout, and stacking for critical mobile components now belong only to the mobile shell stylesheet.\n- The build check parses all three primary stylesheets and reports every duplicate or out-of-bound critical mobile layout declaration, preventing future specificity patches from recreating the conflict.\n\n## Verification\n\nControlled Headless Chrome traverses all eight routes at 1280×720 and 390×844, checking same-route idempotence, delayed-request aborts, and zero inactive Chat and Transfer resources. The complete trilingual semantics, metadata, modal, history, caret, and exact-viewport suite passes 110 checks. No production data, release, or deployment is involved.",
        ja: "# ルートライフサイクルとモバイル CSS の一元管理\n\n今回の更新では、公開サイトの各ルートに明示的なリソースライフサイクルを追加し、分散していたレスポンシブなモバイルレイアウトを 1 つのスタイルシートへ統合しました。今後の遅延読み込み、ビューポート調整、キーボード回避を検証できる基盤になります。\n\n## ルートごとにリソースを開始・終了\n\n- Home、Knowledge、Videos、Resources、Games、Blog、Chat、About は明示的な `enter/leave` スコープを使います。開始時にリスナー、タイマー、アニメーションフレーム、`AbortController` を 1 組だけ作り、同じルートへの再ナビゲーションでは重複登録しません。\n- Knowledge、Videos、Games、About を離れると未完了の一覧通信を中止します。Home は非表示ルートのデータを先読みせず、再び開いた時に新しいスコープを作ります。\n- Chat は表示中のアクティブルートだけでポーリングし、離脱またはページ非表示後にタイマーを残しません。Quick Transfer のイベント、ポーリング、通信、XHR、再試行待機も Resources の終了時に解放します。\n- モバイルシェルとモーション層はサイト全体の基盤として維持しつつ、共通の開始・終了通知を受け取り、旧ルートだけに属する一時フレームと状態を破棄します。\n\n## モバイル CSS の管理元を 1 つに統一\n\n- `style.css` 末尾に分散していたレスポンシブ規則を、元の順序のまま `mobile-ios-shell.css` へ移しました。セレクター、宣言、値は変えていないため、XP、Pixel Art、Y2K の構図を作り直していません。\n- モーション用スタイルのモバイル階層上書きをデスクトップシェルへ限定しました。重要なモバイル部品の高さ、オーバーフロー、配置、レイアウト、重なり順はモバイルシェルだけが管理します。\n- ビルドチェックは 3 つの主要 CSS を解析し、重複または管理範囲外の重要レイアウト宣言を項目ごとに報告します。優先度の高い後付け規則で競合が再発することを防ぎます。\n\n## 検証\n\n制御された Headless Chrome で 1280×720 と 390×844 の全 8 ルートを連続移動し、同一ルートの重複登録防止、遅延通信の中止、非アクティブな Chat と Transfer のリソース解放を確認しました。3 言語の意味構造、メタデータ、モーダル、履歴、キャレット、正確なビューポートを含む全 110 項目が成功しています。本番データへの接続、公開、デプロイは行っていません。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-route-metadata-modal-focus",
      slug: "2026-07-18-route-metadata-modal-focus",
      category: "site-updates",
      tags: ["SEO", "metadata", "accessibility", "dialog", "navigation"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T20:22:00.000Z",
      updated_at: "2026-07-17T20:22:00.000Z",
      published_at: "2026-07-17T20:22:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.18",
      title: {
        zh: "三语路由分享信息与模态焦点隔离",
        en: "Trilingual Route Metadata and Modal Focus Isolation",
        ja: "3 言語ルートメタデータとモーダルフォーカス分離"
      },
      summary: {
        zh: "八个主路由与文章详情现在同步独立三语标题、描述、canonical、OG 和 Twitter 信息；欢迎窗与视频窗会隔离背景、圈定焦点并可靠归还触发源。",
        en: "All eight routes and article details now synchronize distinct trilingual title, description, canonical, Open Graph, and Twitter data, while welcome and video dialogs isolate background focus.",
        ja: "8 つの主要ルートと記事詳細で 3 言語のタイトル、説明、canonical、OG、Twitter 情報を同期し、ウェルカムと動画ダイアログは背景を分離してフォーカスを確実に戻します。"
      },
      content_markdown: {
        zh: "# 三语路由分享信息与模态焦点隔离\n\n本轮完成路由级分享信息和两个公开模态窗口的键盘隔离，让地址、语言、页面语义与焦点生命周期保持一致。\n\n## 路由与文章元信息\n\n- Home、Knowledge、Videos、Resources、Games、Blog、Chat 与 About 都有独立三语标题、描述、canonical、Open Graph 与 Twitter 信息。\n- 临时壁纸、欢迎窗和审计参数不会进入 canonical；文章始终使用正式 `/articles/<slug>?lang=<lang>` 地址。\n- 文章安全封面会替换分享图并清除未知尺寸，离开文章后立即恢复目标栏目的网站类型、默认图片与尺寸，不残留旧文章标题、简介或封面。\n\n## 欢迎窗与视频窗\n\n- 模态打开时，skip link 与整个站点壳使用原生 `inert` 隔离；若两个模态异常重叠，只保留最上层可交互。\n- Tab 与 Shift+Tab 在对话框内循环，Escape 关闭；完整动效结束前背景继续隔离，减少动态或关闭动效时立即完成。\n- 视频卡显式记录真实点击按钮，关闭后优先归还该触发源；触发源失效时回到当前模态或路由稳定标题。手机关闭入口继续保持至少 44×44px。\n\n## 验证边界\n\n受控 Headless Chrome 在三语八路由、三语文章和桌面/短竖屏/标准竖屏/横屏模态场景共执行 108 项检查。运行时 Hash 元信息可保持浏览器状态一致，但不等同独立路径 SSR 或社交抓取器预渲染。",
        en: "# Trilingual Route Metadata and Modal Focus Isolation\n\nThis release completes route-level sharing data and keyboard isolation for the two public modal windows, keeping addresses, language, semantics, and focus lifecycles aligned.\n\n## Route and article metadata\n\n- Home, Knowledge, Videos, Resources, Games, Blog, Chat, and About now expose distinct trilingual titles, descriptions, canonicals, Open Graph fields, and Twitter fields.\n- Temporary wallpaper, welcome, and audit parameters never enter canonical URLs. Articles always use `/articles/<slug>?lang=<lang>`.\n- A safe article cover replaces the share image and clears unknown dimensions. Leaving an article immediately restores the target route's website type, default image, and dimensions without retaining the old title, summary, or cover.\n\n## Welcome and video dialogs\n\n- While a modal is open, native `inert` isolates both the skip link and the complete site shell. If two modals overlap unexpectedly, only the top surface remains interactive.\n- Tab and Shift+Tab wrap inside the dialog, and Escape closes it. The background stays isolated through the full close animation, while reduced or disabled motion commits immediately.\n- Video cards pass the exact clicked button as the return target. Closing restores that trigger first, with the active modal or stable route heading as fallback. Mobile Close remains at least 44 by 44 pixels.\n\n## Verification boundary\n\nControlled Headless Chrome runs 108 checks across all eight routes in three languages, trilingual article metadata, and desktop, short portrait, standard portrait, and landscape modal scenarios. Runtime hash metadata keeps browser state coherent but is not equivalent to independent-path SSR or social-crawler prerendering.",
        ja: "# 3 言語ルートメタデータとモーダルフォーカス分離\n\n今回の更新では、ルート単位の共有情報と 2 つの公開モーダルのキーボード分離を完成させ、URL、言語、意味構造、フォーカスのライフサイクルを一致させました。\n\n## ルートと記事のメタデータ\n\n- Home、Knowledge、Videos、Resources、Games、Blog、Chat、About に、それぞれ異なる 3 言語のタイトル、説明、canonical、Open Graph、Twitter 情報を設定します。\n- 一時的な壁紙、ウェルカム、監査パラメータは canonical に含めません。記事は常に `/articles/<slug>?lang=<lang>` を使用します。\n- 安全な記事カバーは共有画像へ反映し、不明な寸法を消去します。記事を離れると、古いタイトル、概要、カバーを残さず、移動先ルートの website 種別、既定画像、寸法を復元します。\n\n## ウェルカムと動画ダイアログ\n\n- モーダル表示中は、ネイティブ `inert` で本文スキップとサイトシェル全体を分離します。2 つが予期せず重なった場合も、最上位だけを操作可能にします。\n- Tab と Shift+Tab はダイアログ内を循環し、Escape で閉じます。通常動作では閉じるアニメーション完了まで背景を分離し、動きを減らす設定または動作オフでは即座に完了します。\n- 動画カードは実際に押したボタンを戻り先として渡します。閉じるとそのトリガーを優先し、利用できない場合は表示中のモーダルまたはルートの安定した見出しへ戻します。モバイルの閉じる操作は 44×44px 以上を維持します。\n\n## 検証範囲\n\n制御された Headless Chrome で、3 言語の 8 ルート、3 言語の記事メタデータ、デスクトップ、短い縦画面、標準縦画面、横画面のモーダルを含む 108 項目を確認しました。実行時の Hash メタデータはブラウザ状態を一致させますが、独立パスの SSR やソーシャルクローラー向け事前描画と同等ではありません。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-knowledge-history-restoration",
      slug: "2026-07-18-knowledge-history-restoration",
      category: "site-updates",
      tags: ["Knowledge", "navigation", "history", "state", "accessibility"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T20:01:00.000Z",
      updated_at: "2026-07-17T20:01:00.000Z",
      published_at: "2026-07-17T20:01:00.000Z",
      fallbackOnly: true,
      icon: "knowledge",
      date: "2026.07.18",
      title: {
        zh: "知识库列表与文章历史状态恢复",
        en: "Knowledge List and Article History Restoration",
        ja: "ナレッジ一覧と記事の履歴状態を復元"
      },
      summary: {
        zh: "从筛选或搜索结果打开文章后，返回与前进会恢复原分类、搜索词、列表位置和文章阅读位置；直链返回默认知识库，并保持稳定焦点。",
        en: "Back and Forward now restore the Knowledge category, search term, list position, and article reading position, while direct links return safely to the default Knowledge view.",
        ja: "絞り込みや検索結果から記事を開いた後、戻る・進むで分類、検索語、一覧位置、記事の読書位置を復元し、直リンクは既定のナレッジへ安全に戻ります。"
      },
      content_markdown: {
        zh: "# 知识库列表与文章历史状态恢复\n\n本轮让知识库的文章列表、详情和浏览器历史成为一条可预测、可恢复的导航路径。\n\n## 列表与文章往返\n\n- 从分类或 Unicode 搜索结果打开文章前，当前分类、搜索词和列表滚动位置会写入当前历史条目。\n- 返回列表后会恢复完整上下文；浏览器前进可再次打开同一篇文章，并恢复详情阅读位置。\n- 站内返回只回到来源列表，不额外创建重复历史条目。\n\n## 直链与安全回退\n\n- 直接访问 `/articles/<slug>` 时，返回操作会在当前条目中进入默认 Knowledge，不会把访客带离站点。\n- 未知版本、错误路由或异常滚动值会按当前 URL 重新建立安全默认状态，同时保留其他代码写入的根级 History 字段。\n- 搜索词只保存在浏览器 History 状态，不写进 URL；账号、Chat 草稿、互传口令和内容不会进入该状态。\n\n## 焦点与验证\n\n列表和详情恢复完成后，焦点只落在对应稳定标题且不会自动聚焦搜索框。桌面与手机无头审计覆盖站内返回、浏览器 Back / Forward、直链和损坏状态，共 99 项检查通过。",
        en: "# Knowledge List and Article History Restoration\n\nThis release makes the Knowledge list, article detail, and browser history a predictable and recoverable navigation path.\n\n## List and article round trips\n\n- Before an article opens from a category or Unicode search result, the active category, search term, and list scroll position are stored in the current history entry.\n- Returning restores that complete context. Browser Forward reopens the same article and restores its reading position.\n- The in-app Back action returns to the source entry without creating a duplicate history item.\n\n## Direct links and safe fallback\n\n- When `/articles/<slug>` is opened directly, Back replaces the current entry with the default Knowledge view instead of taking the visitor away from the site.\n- Unknown versions, mismatched routes, and invalid scroll values are rebuilt from the current URL with safe defaults while unrelated root-level History fields are preserved.\n- Search terms stay in browser History rather than the URL. Account data, Chat drafts, Quick Transfer passphrases, and content are never stored there.\n\n## Focus and verification\n\nAfter list or detail restoration, focus moves once to the matching stable heading and never selects the search field automatically. Desktop and mobile headless audits cover in-app Back, browser Back and Forward, direct links, and malformed state, with all 99 checks passing.",
        ja: "# ナレッジ一覧と記事の履歴状態を復元\n\n今回の更新で、ナレッジ一覧、記事詳細、ブラウザ履歴を予測可能で復元できる移動経路にしました。\n\n## 一覧と記事の往復\n\n- 分類または Unicode 検索結果から記事を開く前に、現在の分類、検索語、一覧のスクロール位置を履歴エントリへ保存します。\n- 一覧へ戻ると文脈を完全に復元し、ブラウザの進む操作で同じ記事と読書位置を再表示します。\n- 画面内の戻る操作は元の一覧エントリへ戻り、重複する履歴を作りません。\n\n## 直リンクと安全なフォールバック\n\n- `/articles/<slug>` を直接開いた場合、戻る操作は訪問者をサイト外へ送らず、現在のエントリを既定の Knowledge 表示へ置き換えます。\n- 未知の版、URL と一致しないルート、不正なスクロール値は現在の URL から安全な既定値で再構築し、他のコードが持つルート階層の History フィールドは保持します。\n- 検索語は URL ではなくブラウザ履歴だけに保存します。アカウント情報、Chat 下書き、一時転送の合言葉や内容は保存しません。\n\n## フォーカスと検証\n\n一覧または詳細の復元後、フォーカスは対応する安定した見出しへ 1 回だけ移り、検索欄を自動選択しません。デスクトップとモバイルのヘッドレス監査で画面内の戻る、ブラウザの戻る・進む、直リンク、壊れた状態を確認し、99 項目すべてに合格しました。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-focus-popover-caret",
      slug: "2026-07-18-focus-popover-caret",
      category: "site-updates",
      tags: ["accessibility", "navigation", "account", "Quick Transfer", "UI"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T19:42:00.000Z",
      updated_at: "2026-07-17T19:42:00.000Z",
      published_at: "2026-07-17T19:42:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.18",
      title: {
        zh: "路由焦点、账号浮层与输入光标修复",
        en: "Route Focus, Account Popover, and Caret Fixes",
        ja: "ルートフォーカス・アカウントポップオーバー・入力カーソル修正"
      },
      summary: {
        zh: "统一 8 个路由、文章详情/列表与历史导航的稳定标题焦点，补全账号非模态浮层语义和关闭归还，并恢复临时互传密码与输入区的可见光标；安全、API 与 D1 不变。",
        en: "Aligns focus across eight routes, article views, and history navigation; strengthens the non-modal account popover; and restores visible carets in Quick Transfer without changing security, APIs, or D1.",
        ja: "8 ルート、記事表示、履歴移動のフォーカスを安定した見出しにそろえ、アカウントの非モーダルポップオーバーを補強し、一時転送の入力カーソルを復元しました。安全性、API、D1 は変更していません。"
      },
      content_markdown: {
        zh: "# 路由焦点、账号浮层与输入光标修复\n\n本轮统一公开页面的键盘焦点、账号浮层语义和编辑光标，只修复前端交互与无障碍体验。\n\n## 路由与文章焦点\n\n- 8 个公开路由切换后，程序焦点只移动一次并落在新页面的稳定标题；首次 Tab 仍先到三语“跳到主内容”链接，不会自动聚焦搜索框、密码框或输入区。\n- 文章详情与列表切换、浏览器 history back / forward 后，焦点分别跟随文章标题或知识库标题，和当前 URL 保持一致。\n\n## 账号浮层\n\n- 账号入口继续使用非模态 popover，并补充带可访问名称的 `role=group`；触发器保持正确的 `aria-expanded` 与 `aria-controls`。\n- Escape 和点击浮层外都会关闭它，并把焦点归还到账号触发器。\n\n## 输入光标\n\n- 移除 body 级透明 caret，临时互传的密码框与 composer 恢复可见光标和正常编辑；公开文字仍按原有安全方式渲染。\n\n## 边界不变\n\n本轮不改变账号安全模型、会话、文章或临时互传 API、D1 数据结构与后端权限。",
        en: "# Route Focus, Account Popover, and Caret Fixes\n\nThis release aligns keyboard focus, account-popover semantics, and editing carets across the public site. Only frontend interaction and accessibility behavior changed.\n\n## Route and article focus\n\n- Switching among all eight public routes moves programmatic focus once to the stable heading for the new route. The first Tab still reaches the trilingual Skip to main content link, and automatic focus never targets a search field, password field, or composer.\n- Article detail/list transitions and browser history back/forward now focus the article title or Knowledge heading to match the current URL.\n\n## Account popover\n\n- The account entry remains a non-modal popover and now exposes a labelled `role=group`; its trigger keeps accurate `aria-expanded` and `aria-controls` state.\n- Escape and outside click both close the popover and return focus to the account trigger.\n\n## Editing carets\n\n- The body-level transparent caret is removed, restoring visible carets and normal editing in the Quick Transfer passphrase field and composer while preserving the existing safe text-rendering path.\n\n## Unchanged boundaries\n\nAccount security, sessions, article and Quick Transfer APIs, the D1 schema, and backend permissions are unchanged.",
        ja: "# ルートフォーカス・アカウントポップオーバー・入力カーソル修正\n\n今回の更新では、公開サイトのキーボードフォーカス、アカウントポップオーバーの意味付け、編集カーソルを統一しました。変更はフロントエンドの操作性とアクセシビリティに限定しています。\n\n## ルートと記事のフォーカス\n\n- 8 つの公開ルートを切り替えると、プログラムによるフォーカスは 1 回だけ新しいルートの安定した見出しへ移ります。最初の Tab は引き続き 3 言語の「本文へスキップ」に到達し、検索欄、パスワード欄、入力欄を自動選択しません。\n- 記事詳細と一覧の切り替え、ブラウザの history back / forward 後は、現在の URL に合わせて記事タイトルまたは知識庫の見出しへフォーカスします。\n\n## アカウントポップオーバー\n\n- アカウント入口は非モーダルポップオーバーのまま、アクセシブルな名前を持つ `role=group` を公開します。トリガーの `aria-expanded` と `aria-controls` も正しい状態を維持します。\n- Escape または外側のクリックで閉じ、フォーカスをアカウントトリガーへ戻します。\n\n## 入力カーソル\n\n- body 全体の透明 caret を削除し、一時転送のパスワード欄と composer で見えるカーソルと通常の編集を復元しました。公開テキストの安全な描画方法は維持します。\n\n## 変更していない境界\n\nアカウントの安全モデル、セッション、記事と一時転送の API、D1 スキーマ、バックエンド権限は変更していません。"
      }
    },
    {
      article_id: "seed-update-2026-07-18-theme-accessibility-foundation",
      slug: "2026-07-18-theme-accessibility-foundation",
      category: "site-updates",
      tags: ["performance", "accessibility", "theme", "navigation", "UI"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-17T18:53:00.000Z",
      updated_at: "2026-07-17T18:53:00.000Z",
      published_at: "2026-07-17T18:53:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.18",
      title: {
        zh: "四时段首屏与无障碍导航底座",
        en: "Theme Bootstrap and Accessible Navigation Foundation",
        ja: "時間帯テーマとアクセシブルナビゲーション基盤"
      },
      summary: {
        zh: "首屏在阻塞样式前确定真实四时段主题，避免非日间先下载 day 壁纸；同时新增三语跳到主内容、语义 Landmark 与活动路由唯一 H1。",
        en: "Selects the real four-period theme before blocking styles to avoid a needless day-wallpaper request, and adds a trilingual skip link, landmarks, and one H1 for the active route.",
        ja: "ブロッキング CSS より前に実際の時間帯テーマを確定して day 壁紙の余分な取得を防ぎ、3 言語の本文スキップ、ランドマーク、アクティブルートごとの唯一の H1 を追加しました。"
      },
      content_markdown: {
        zh: "# 四时段首屏与无障碍导航底座\n\n本轮完成首屏资源与页面语义的基础优化，让四时段主题从第一帧正确加载，并让键盘和辅助技术更快到达当前内容。\n\n## 首屏主题\n\n- 在阻塞样式加载前，根据 `?wallpaper=` 调试参数或本地时间确定 morning、day、dusk、night。\n- 首个样式计算直接从 `html[data-time-theme]` 读取正确主题，主脚本随后同步到 body、Home 与壁纸舞台；非 day 时段不再先请求 day 资源。\n- 桌面窗口背景、动态壁纸与移动壁纸均接受同一早期主题，调试参数继续有效。\n\n## 导航与语义\n\n- 首个 Tab 显示三语“跳到主内容”入口，并把焦点送到稳定的 main Landmark，不改变当前路由或地址。\n- 每个活动路由只暴露一个 H1，隐藏路由继续离开无障碍树，Home 构图和 Neo-XP 视觉不变。\n- 卡片标题与安全 Markdown 标题从 H2 开始，为后续统一路由焦点和语义烟测提供稳定层级。\n\n## 边界不变\n\n公开路由、账号、Chat、文章 API、D1 与四时段视觉资产均未改变。",
        en: "# Theme Bootstrap and Accessible Navigation Foundation\n\nThis release improves first-paint resources and page semantics so the correct four-period theme loads from the first frame and keyboard or assistive-technology users can reach the active content quickly.\n\n## First-paint theme\n\n- Before blocking styles load, an early bootstrap selects morning, day, dusk, or night from the `?wallpaper=` debug override or local time.\n- The first style calculation reads the correct `html[data-time-theme]`; the main script then synchronizes body, Home, and the wallpaper stage, so non-day sessions no longer request a day asset first.\n- Desktop window backdrops, dynamic wallpaper, and mobile wallpaper share the same early theme while the debug override remains available.\n\n## Navigation and semantics\n\n- The first Tab reveals a trilingual Skip to main content link that focuses the stable main landmark without changing the current route or address.\n- Only the active route exposes one H1. Hidden routes stay outside the accessibility tree, while the Home composition and Neo-XP appearance remain unchanged.\n- Card titles and safe Markdown headings now begin at H2, providing a stable hierarchy for later route-focus and semantic smoke tests.\n\n## Unchanged boundaries\n\nPublic routes, accounts, Chat, article APIs, D1, and four-period visual assets are unchanged.",
        ja: "# 時間帯テーマとアクセシブルナビゲーション基盤\n\n今回は初回描画のリソースとページ構造を整え、4 つの時間帯テーマを最初のフレームから正しく表示し、キーボードや支援技術から現在の内容へ素早く移動できるようにしました。\n\n## 初回描画のテーマ\n\n- ブロッキング CSS を読み込む前に、`?wallpaper=` デバッグ指定または端末のローカル時刻から morning、day、dusk、night を決定します。\n- 最初のスタイル計算は正しい `html[data-time-theme]` を参照し、メインスクリプトが body、Home、壁紙ステージへ同期するため、day 以外で day の資産を先に取得しません。\n- デスクトップのウィンドウ背景、動的壁紙、モバイル壁紙は同じ初期テーマを使い、デバッグ指定も維持します。\n\n## ナビゲーションと構造\n\n- 最初の Tab で 3 言語の「本文へスキップ」を表示し、現在のルートや URL を変えずに安定した main ランドマークへフォーカスを移します。\n- アクティブなルートだけが 1 つの H1 を公開します。非表示ルートはアクセシビリティツリーから外れ、Home の構図と Neo-XP の外観は変わりません。\n- カード見出しと安全な Markdown 見出しを H2 から始め、今後のルートフォーカス統一とセマンティック smoke test の基準にします。\n\n## 変更していない境界\n\n公開ルート、アカウント、Chat、記事 API、D1、4 時間帯のビジュアル資産は変更していません。"
      }
    },
    {
      article_id: "seed-update-2026-07-17-mobile-transfer-send-fix",
      slug: "2026-07-17-mobile-transfer-send-fix",
      category: "site-updates",
      tags: ["mobile", "Knowledge", "Quick Transfer", "attachments", "UI"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-16T18:45:00.000Z",
      updated_at: "2026-07-16T18:45:00.000Z",
      published_at: "2026-07-16T18:45:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.17",
      title: {
        zh: "手机顶栏与临时互传发送体验修复",
        en: "Mobile Header and Quick Transfer Send Fixes",
        ja: "モバイル上部バーと一時転送の送信修正"
      },
      summary: {
        zh: "修复手机进入知识库时误弹输入法，并整理移动顶栏与阅读信息；临时互传采用纵向正常流，让整个发送区始终排在完整消息卡之后。",
        en: "Prevents Knowledge from opening the software keyboard on entry, streamlines mobile reading, and keeps the entire Quick Transfer composer after complete message cards in a non-shrinking vertical flow.",
        ja: "知識庫を開いた直後のキーボード表示を防ぎ、モバイル閲覧を整理しました。一時転送を縮まない縦方向の通常フローにし、入力欄全体を完全なメッセージカードの後へ確実に配置します。"
      },
      content_markdown: {
        zh: "# 手机顶栏与临时互传发送体验修复\n\n本轮修复手机阅读和临时互传的直接操作问题，不改变登录、房间口令、加密、R2、配额、24 小时过期或下载鉴权。\n\n## 手机阅读\n\n- 手机虚拟 OS 移除顶部时间与 LUSU OS 状态行，释放正文空间；栏目 Appbar、首页入口和桌面顶栏保持不变。\n- 知识库文章不再同时显示栏目文字、百分比和进度条，只保留进度条以及可操作的返回、复制与回到顶部控件。\n- 从 Home、欢迎快捷入口或 Dock 进入知识库时，自动焦点只落在可见的非编辑控件或窗口表面，不再直接聚焦搜索框；主动点击搜索时输入法仍正常工作。\n\n## 临时互传\n\n- 从相册或文件选择器添加的附件会先显示在输入区，用户再次点击发送后才开始上传。\n- 手机竖屏房间使用纵向 Flex，toolbar、消息区、发送区和任务区等直接子项不可收缩；消息区按文字、图片和文件卡的实际高度完整撑开，发送区所有控件始终排在最后一条完整消息之后；短横屏显式恢复原有双栏布局。\n- 待发送图片以小缩略图显示并可单独移除；发送后的图片使用占满消息卡片宽度且高度稳定的预览框，普通文件卡片同步占满可用宽度。\n- 每个图片或文件都保留下载按钮，每条已解密文字末尾提供复制按钮。\n\n## 边界不变\n\n房间明文口令仍不会发送到服务器；文字继续在浏览器使用 AES-GCM，文件继续由 HTTPS、私有 R2 与服务端鉴权保护。普通账号配额、管理员 Multipart、24 小时过期和现有 API 保持不变。",
        en: "# Mobile Header and Quick Transfer Send Fixes\n\nThis release fixes direct mobile-reading and Quick Transfer interactions without changing sign-in, passphrases, encryption, R2, quotas, 24-hour expiry, or download authorization.\n\n## Mobile reading\n\n- The mobile virtual OS removes the time and LUSU OS status row to return space to content. The Appbar, Home entry, and desktop top bar stay unchanged.\n- Knowledge articles no longer repeat the route label, percentage, and progress bar together. The progress bar and real Back, Copy, and Back to Top controls remain.\n- Opening Knowledge from Home, the welcome shortcut, or the Dock now moves automatic focus only to a visible non-editing control or the window surface instead of the search field. The keyboard still opens after a deliberate search tap.\n\n## Quick Transfer\n\n- Attachments added from the photo library or file picker stay in the composer until the user presses Send again.\n- In mobile portrait, the room uses a vertical flex layout whose toolbar, feed, composer, and task children cannot shrink. Text, image, and file cards contribute their full height, so every composer control begins after the final complete message card. Short landscape explicitly restores the existing two-column layout.\n- Pending images use small removable thumbnails. Sent images use a stable full-width preview inside the message card, and regular file cards fill the same available width.\n- Every image or file keeps a Download action, and each decrypted text message ends with a Copy action.\n\n## Unchanged boundaries\n\nPlaintext room passphrases still never reach the server. Text continues to use browser AES-GCM, while files remain protected by HTTPS, private R2, and server authorization. Standard quotas, admin Multipart, 24-hour expiry, and existing APIs are unchanged.",
        ja: "# モバイル上部バーと一時転送の送信修正\n\n今回はモバイル記事と一時転送の直接操作を修正し、ログイン、合言葉、暗号化、R2、割り当て、24 時間の有効期限、ダウンロード認可は変更していません。\n\n## モバイル記事\n\n- モバイル仮想 OS から時刻と LUSU OS の状態行を外し、本文の表示領域を広げました。Appbar、Home 入口、デスクトップ上部バーは維持します。\n- ナレッジ記事では、ルート名、百分率、進捗バーの重複表示をやめ、進捗バーと実際に操作できる戻る・コピー・トップへ戻るを残しました。\n- Home、ウェルカムのショートカット、Dock から知識庫を開いた際、自動フォーカスは表示中の非編集操作またはウィンドウ面にだけ移り、検索欄を直接選ばなくなりました。検索をタップした場合は従来どおりキーボードを利用できます。\n\n## 一時転送\n\n- 写真ライブラリまたはファイル選択から追加した添付は入力欄に保持され、もう一度送信を押してからアップロードを開始します。\n- モバイル縦画面の部屋は縦方向 Flex を使い、ツールバー・メッセージ欄・入力欄・タスク欄の直下要素を縮ませません。文字・画像・ファイルカードの実際の高さを確保し、入力欄内のすべての操作を最後の完全なメッセージカードの後に配置します。短い横画面では既存の 2 列配置を明示的に復元します。\n- 送信待ち画像は削除できる小さなサムネイルで表示します。送信済み画像はカード幅いっぱいの安定したプレビュー、通常ファイルは同じ利用可能幅のファイルカードで表示します。\n- 画像とファイルにはダウンロード、復号済みテキストの末尾にはコピー操作を用意しました。\n\n## 変更していない境界\n\n部屋の平文合言葉は引き続きサーバーへ送りません。文字はブラウザ AES-GCM、ファイルは HTTPS、非公開 R2、サーバー認可で保護します。一般割り当て、管理者 Multipart、24 時間期限、既存 API は変更していません。"
      }
    },
    {
      article_id: "seed-update-2026-07-16-mobile-transfer-ui-polish",
      slug: "2026-07-16-mobile-transfer-ui-polish",
      category: "site-updates",
      tags: ["mobile", "Quick Transfer", "UI", "accessibility"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-16T13:30:00.000Z",
      updated_at: "2026-07-16T13:30:00.000Z",
      published_at: "2026-07-16T13:30:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.16",
      title: {
        zh: "手机文章与临时互传界面修复",
        en: "Mobile Reading and Transfer UI Fixes",
        ja: "モバイル記事と一時転送 UI の修正"
      },
      summary: {
        zh: "修复手机端知识库文章回顶触控，并统一资源卡片尺寸与互传页面在窄屏、短屏和软键盘下的布局；安全、配额与 API 边界保持不变。",
        en: "Fixes mobile article back-to-top touch handling, aligns Resource cards, and adapts Quick Transfer to narrow, short, and keyboard-constrained screens without changing security, quotas, or APIs.",
        ja: "モバイル記事のトップへ戻る操作を修正し、リソースカードと一時転送を狭い画面・短い画面・ソフトキーボード向けに整えました。安全・割り当て・API の境界は変更していません。"
      },
      content_markdown: {
        zh: "# 手机文章与临时互传界面修复\n\n本轮针对手机阅读和资源区互传做可见体验修复，不改变后端能力与权限模型。\n\n## 知识库文章\n\n- 手机阅读文章时，回到顶部按钮不再被固定 Appbar 的触控层拦截，点击后可以正常返回文章开头。\n- Appbar 中真实可操作的返回、复制等控件仍然可以正常使用。\n\n## 资源区与互传\n\n- 临时互传卡片与日语学习卡片使用一致的网格宽度和卡片节奏，标题、元信息、说明与入口重新对齐。\n- 互传入口、房间、消息、上传任务、文件预览和输入区适配窄竖屏、短屏与手机横屏；软键盘出现时输入控件保持可见。\n- 非首页手机 App 中的登录入口仍然可达，关键控件保持合适的触控尺寸，不通过裁剪隐藏排版问题。\n\n## 边界不变\n\n本次只调整公开交互和响应式 UI。房间口令派生、HttpOnly 会话、私有 R2、24 小时过期、普通账号配额、管理员 Multipart 权限、下载鉴权以及现有 API 均未改变。",
        en: "# Mobile Reading and Transfer UI Fixes\n\nThis release improves mobile reading and the Resources transfer experience without changing backend capabilities or the permission model.\n\n## Knowledge articles\n\n- The Back to Top control is no longer blocked by the fixed Appbar touch layer while reading an article on mobile, so it returns to the article start as expected.\n- Real Appbar controls such as Back and Copy remain interactive.\n\n## Resources and Quick Transfer\n\n- The Quick Transfer and Japanese learning cards now share a consistent grid width and card rhythm, with aligned headings, metadata, descriptions, and actions.\n- Entry, room, message, upload task, file preview, and composer layouts now adapt to narrow portrait screens, short screens, and mobile landscape; focused inputs remain visible when the software keyboard opens.\n- Sign-in remains reachable from a non-Home mobile App, and key controls retain practical touch sizes without clipping content to hide layout problems.\n\n## Unchanged boundaries\n\nThis release changes only public interaction and responsive UI. Passphrase derivation, HttpOnly sessions, private R2 storage, 24-hour expiry, standard-account quotas, admin Multipart permissions, download authorization, and existing APIs are unchanged.",
        ja: "# モバイル記事と一時転送 UI の修正\n\n今回はモバイルでの記事閲覧とリソース欄の一時転送を改善し、バックエンド機能や権限モデルは変更していません。\n\n## ナレッジ記事\n\n- モバイルで記事を読む際、トップへ戻る操作が固定 Appbar のタッチ層に遮られなくなり、記事の先頭へ正しく戻ります。\n- 戻る・コピーなど Appbar 上の実際の操作ボタンは引き続き利用できます。\n\n## リソースと一時転送\n\n- 一時転送カードと日本語学習カードのグリッド幅とカードのリズムを揃え、見出し、メタ情報、説明、操作を整列しました。\n- 入口、部屋、メッセージ、アップロードタスク、ファイルプレビュー、入力欄を、狭い縦画面、短い画面、モバイル横画面に対応させました。ソフトキーボード表示中も入力欄を確認できます。\n- Home 以外のモバイル App からもログインへ進め、主要操作は内容を切り捨てずに十分なタッチ領域を保ちます。\n\n## 変更していない境界\n\n今回は公開操作とレスポンシブ UI のみの変更です。合言葉の派生、HttpOnly セッション、非公開 R2、24 時間の有効期限、一般アカウントの割り当て、管理者 Multipart 権限、ダウンロード認可、既存 API は変更していません。"
      }
    },
    {
      article_id: "seed-update-2026-07-16-quick-transfer",
      slug: "2026-07-16-quick-transfer",
      category: "site-updates",
      tags: ["Quick Transfer", "R2", "files", "security"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-16T10:00:00.000Z",
      updated_at: "2026-07-16T10:00:00.000Z",
      published_at: "2026-07-16T10:00:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.16",
      title: {
        zh: "临时互传进入资源区",
        en: "Quick Transfer Arrives in Resources",
        ja: "リソースに一時転送を追加"
      },
      summary: {
        zh: "资源区新增登录限定的临时互传房间，支持浏览器端 AES-GCM 加密文字，以及通过 HTTPS、私有 R2 和服务端鉴权保护的图片、视频与文件；普通账号受免费池保护，管理员可使用分片大文件上传。",
        en: "Resources now includes signed-in temporary rooms for text encrypted in the browser with AES-GCM, plus images, video, and files protected by HTTPS, private R2 storage, and server-side authorization, with a guarded free pool for standard accounts and multipart large files for admins.",
        ja: "リソースにログイン限定の一時転送部屋を追加し、ブラウザー側で AES-GCM 暗号化するテキストと、HTTPS・非公開 R2・サーバー認可で保護する画像・動画・ファイル、一般ユーザーの無料枠保護、管理者の大容量分割送信に対応しました。"
      },
      content_markdown: {
        zh: "# 临时互传进入资源区\n\n已登录用户输入同一房间口令后，可以临时交换浏览器端 AES-GCM 加密文字，以及通过 HTTPS、私有 R2、随机对象键和服务端鉴权保护的图片、视频与普通文件。房间明文口令不会发送到服务器，文件不使用该口令加密。普通账号单文件上限 95 MiB，并受个人、房间、频率及全站 8 GiB 免费池保护；只有数据库角色为 admin 的账号可用 Multipart Upload 发送数百 MB 到数 GB 文件。内容发布完成 24 小时后立即不可读取，下载支持 Range 和视频拖动。R2 桶、Pages 绑定、独立清理 Worker、生命周期规则和 Cloudflare 官方预算提醒仍需站长在 Dashboard 完成人工配置。",
        en: "# Quick Transfer Arrives in Resources\n\nSigned-in users who enter the same passphrase can exchange text encrypted in the browser with AES-GCM, plus images, video, and regular files protected by HTTPS, private R2 storage, random object keys, and server-side authorization. Plaintext passphrases never reach the server, and files are not encrypted with the passphrase. Standard accounts are limited to 95 MiB per file and guarded by personal, room, rate, and shared 8 GiB free-pool limits. Only database admins may use Multipart Upload for hundreds of megabytes through multi-GB files. Items become unreadable after 24 hours, and downloads support Range requests and video seeking. The owner must still configure R2, Pages bindings, the cleanup Worker, lifecycle rules, and official Cloudflare budget alerts.",
        ja: "# リソースに一時転送を追加\n\n同じ合言葉を入力したログイン済みユーザー同士で、ブラウザー側で AES-GCM 暗号化するテキストと、HTTPS・非公開 R2・ランダムなオブジェクトキー・サーバー認可で保護する画像、動画、通常ファイルを一時共有できます。平文の合言葉はサーバーへ送信されず、ファイルは合言葉では暗号化されません。一般アカウントは1件 95 MiB までで、個人・部屋・頻度・全体 8 GiB の無料枠保護を受けます。Multipart Upload で数百 MB から数 GB を送れるのはデータベースの admin のみです。公開完了から24時間後にアクセス不可となり、Range ダウンロードと動画シークに対応します。R2、Pages バインド、清理 Worker、ライフサイクル、Cloudflare 公式予算通知は Dashboard で手動設定が必要です。"
      }
    },
    {
      article_id: "seed-update-2026-07-14-japanese-subtext-retry-hotfix",
      slug: "2026-07-14-japanese-subtext-retry-hotfix",
      category: "site-updates",
      tags: ["Japanese", "learning", "accessibility", "bugfix"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-14T02:20:00.000Z",
      updated_at: "2026-07-14T02:20:00.000Z",
      published_at: "2026-07-14T02:20:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.14",
      title: {
        zh: "日语潜台词训练器 1.0.3 重答修复",
        en: "Japanese Subtext Trainer 1.0.3 Retry Fix",
        ja: "日本語の裏側 1.0.3 再回答修正"
      },
      summary: {
        zh: "修复错答后关闭结果弹窗、点击弹窗外或查看解析时可能失去重新答题入口的问题；题库、音频和云存档兼容版本继续保持 1.0.2。",
        en: "Fixes the dead end that could hide retry after a wrong answer when the result dialog was dismissed or analysis was opened; course, audio, and save compatibility remain on 1.0.2.",
        ja: "誤答後に結果ダイアログを閉じたり解説を開いたりすると再回答できなくなる問題を修正しました。問題集・音声・セーブ互換版は 1.0.2 のままです。"
      },
      content_markdown: {
        zh: "# 日语潜台词训练器 1.0.3 重答修复\n\n“日语的言外之意”应用更新至 1.0.3，集中修复错答后的操作死路。\n\n## 错答后始终可以继续\n\n- 结果弹窗不再允许通过关闭按钮、Escape 或点击弹窗外绕过必选操作。\n- 即使弹窗被浏览器或其他代码强制关闭，题面仍会显示重新答题按钮。\n- 查看解析后，重新答题入口会放在解析正文之前；只有本次答对时才显示进入下一关。\n\n## 版本边界\n\n本次只更新应用界面与交互。250 关题库、10,088 段静态音频以及云存档兼容边界继续使用 contentVersion 1.0.2，没有伪造内容迁移或重录记录。",
        en: "# Japanese Subtext Trainer 1.0.3 Retry Fix\n\nBehind the Japanese moves to app version 1.0.3 with a focused fix for the wrong-answer dead end.\n\n## Retry always remains available\n\n- The result dialog can no longer bypass its required actions through the close button, Escape, or an outside click.\n- If the browser or another script forcibly closes the dialog, the question area still exposes Try Again.\n- After View Analysis, Try Again appears before the explanation content; Next Stage appears only when the current attempt is correct.\n\n## Version boundary\n\nThis release changes only the application interface and interaction. The 250-stage course, 10,088 static audio files, and cloud-save compatibility boundary remain on contentVersion 1.0.2, with no fabricated content migration or rerecording claim.",
        ja: "# 日本語の裏側 1.0.3 再回答修正\n\n「日本語の裏側」をアプリ版 1.0.3 に更新し、誤答後に操作できなくなる経路を修正しました。\n\n## いつでも再回答できる導線\n\n- 結果ダイアログは、閉じるボタン、Escape、外側クリックで必須操作を回避できないようにしました。\n- ブラウザや別のスクリプトがダイアログを強制的に閉じても、問題欄には再回答ボタンが残ります。\n- 解説を開いた後は本文より前に再回答を表示し、今回の回答が正解した場合だけ次のステージを表示します。\n\n## バージョン境界\n\n今回はアプリ画面と操作だけの更新です。250 ステージの問題集、10,088 件の静的音声、クラウドセーブの互換境界は contentVersion 1.0.2 のままで、内容移行や再録を行ったとは扱いません。"
      }
    },
    {
      article_id: "seed-update-2026-07-11-japanese-subtext-trainer",
      slug: "2026-07-11-japanese-subtext-trainer",
      category: "site-updates",
      tags: ["Japanese", "listening", "learning", "tools"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-10T17:30:00.000Z",
      updated_at: "2026-07-10T17:30:00.000Z",
      published_at: "2026-07-10T17:30:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.11",
      title: {
        zh: "日语潜台词训练工具更新至 1.0.2",
        en: "Japanese Subtext Trainer 1.0.2 Update",
        ja: "日本語の裏側 1.0.2 アップデート"
      },
      summary: {
        zh: "“日语的言外之意”更新至 1.0.2：重置全库语音读音链路，修复句尾异常“いい”和“今日”漏读；重做 PC 布局、打卡记录、解析续关与四格漫画配图。",
        en: "Behind the Japanese 1.0.2 rebuilds the speech pipeline to fix detached ending sounds and missing consonants, then adds a denser PC shell, calendar check-ins, analysis-to-next-stage flow, and four-panel manga scenes.",
        ja: "「日本語の裏側」1.0.2 では、語尾の異音と子音欠落を直すため音声生成を全面更新し、PC レイアウト、カレンダー式学習記録、解説後の次ステージ導線、四コマ漫画を追加しました。"
      },
      content_markdown: {
        zh: "# 日语潜台词训练工具更新至 1.0.2\n\n“日语的言外之意”继续使用 250 关数据题库，这次重点重置语音生成、桌面布局和学习记录，让听力训练更可靠也更紧凑。\n\n## 语音读音全量重置\n\n- 句子、选项和词块先保存可审校的假名读音，再交给离线模型；画面仍显示原来的日语汉字。\n- 生成器会分离 Misaki 的音高标记、规范化特殊辅音并拒绝未知音素，不再把末尾标记读成额外的“いい”，也不会把“きょう”的辅音丢掉后读成“おう”。\n- 语音管线升级到 v4 后强制重建全库静态音频。浏览器训练时仍不加载 TTS，批处理结束后模型保持关闭且不自启动。\n\n## 更紧凑的 PC 训练界面\n\n- 桌面端复用游戏区的壳层思路：左上角返回个人站，右上角显示名称，中间突出存档同步。\n- 关卡内容取消重复的整屏最小高度，场景、题目和解析重新排布，减少大块空白。\n- 查看解析后可直接进入下一关；资源区入口改为“开始”，标题、按钮和卡片文案不再被误拖选。\n\n## 月历打卡与四格场景\n\n- 学习记录改为月历打卡，显示当前连续、最长连续、总打卡天数和最近活动；登录后通过独立日活动表同步。\n- 每关配一张贴合题目情境的原创黑白四格漫画，统一人物、线条、网点和分镜，并适配桌面、平板和手机窗口。",
        en: "# Japanese Subtext Trainer 1.0.2 Update\n\nBehind the Japanese keeps its 250-stage data-driven course while rebuilding speech generation, desktop layout, and learning history for a more reliable and compact listening experience.\n\n## Full speech-reading reset\n\n- Sentences, answer choices, and phrase tokens now store reviewable kana readings before they reach the offline model, while the interface continues to display the original kanji.\n- The generator separates Misaki pitch metadata, normalizes special consonants, and rejects unknown phonemes. This removes the detached ending sound and prevents kyou from losing its ky consonant and becoming ou.\n- Pipeline v4 forces the static audio library to be regenerated. The browser still never loads TTS during training, and the local model remains stopped with no autostart after the batch.\n\n## A denser PC training shell\n\n- The desktop tool adopts the game-area shell pattern: Back to Site at top left, the tool name at top right, and save synchronization centered in the frame.\n- Repeated viewport-height constraints were removed, and the scene, questions, and analysis were rearranged to eliminate large unused gaps.\n- Analysis now leads directly to the next stage. The Resources action is Start, and non-input headings, buttons, and card labels no longer become accidentally selected.\n\n## Calendar check-ins and four-panel scenes\n\n- Learning history is now a monthly check-in calendar with current streak, longest streak, total days, and recent activity, synchronized through a dedicated daily-activity table after sign-in.\n- Every stage receives an original black-and-white four-panel manga scene matched to its prompt, with consistent characters, line work, screentones, and responsive placement.",
        ja: "# 日本語の裏側 1.0.2 アップデート\n\n250 ステージのデータ式問題はそのままに、音声生成、PC レイアウト、学習記録を作り直し、聴解練習をより確実でコンパクトにしました。\n\n## 読みを固定した全音声の再生成\n\n- 文、選択肢、語句は、オフラインモデルへ渡す前に確認可能なかな読みを保存します。画面には従来どおり漢字を含む日本語を表示します。\n- Misaki の音高メタデータを音素から分離し、特殊な子音を正規化して未知音素を拒否します。語尾の余分な「いい」を除き、「きょう」の ky が欠けて「おう」になる問題も防ぎます。\n- 音声パイプライン v4 で静的音声を全件再生成します。練習中のブラウザーは TTS を読み込まず、処理後のローカルモデルは停止したままで自動起動しません。\n\n## 空白を減らした PC 画面\n\n- ゲーム欄のシェル構成を取り入れ、左上にサイトへ戻る操作、右上にツール名、中央にセーブ同期を配置しました。\n- 重複していた画面高の制約を外し、場面、問題、解説を再配置して大きな空白を減らしました。\n- 解説から次のステージへ直接進めます。リソース欄の操作は「開始」とし、見出し、ボタン、カード文字の誤選択も防ぎます。\n\n## カレンダー式記録と四コマ場面\n\n- 学習記録を月間カレンダーに変更し、現在・最長の連続日数、合計日数、最近の活動を表示します。ログイン後は専用の日別活動テーブルで同期します。\n- 各ステージに、設問の状況に合うオリジナル白黒四コマ漫画を用意し、人物、線、スクリーントーン、配置を統一して各画面幅に対応します。"
      }
    },
    {
      article_id: "seed-update-2026-07-10-premium-interaction-mobile-os",
      slug: "2026-07-10-premium-interaction-mobile-os",
      category: "site-updates",
      tags: ["design", "mobile", "interaction", "accessibility"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-10T16:20:00.000Z",
      updated_at: "2026-07-10T16:20:00.000Z",
      published_at: "2026-07-10T16:20:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.11",
      title: {
        zh: "GPT-5.6 高级交互与移动 OS 重设计",
        en: "GPT-5.6 Premium Interaction & Mobile OS Redesign",
        ja: "GPT-5.6 プレミアム操作とモバイル OS 再設計"
      },
      summary: {
        zh: "桌面任务栏选中态随模块切换即时同步；手机 Dock 按六个高频入口重新适配为更短的栏体与更清晰的图标尺寸。",
        en: "Desktop taskbar selection now follows module changes immediately, while the six-item mobile Dock uses a shorter bar and clearer icon sizing.",
        ja: "デスクトップのタスクバー選択状態を切り替えと同時に同期し、6 項目のモバイル Dock を短いバーと見やすいアイコン寸法に最適化しました。"
      },
      content_markdown: {
        zh: "# GPT-5.6 高级交互与移动 OS 重设计\n\n这次汇总更新继续保留桌面端 Windows XP、像素艺术与 Y2K 识别度，并把手机端完善为更紧凑、更易读的原创虚拟手机 OS。\n\n## 全站轻动效重置\n\n- 桌面 Home 图标打开 App 时不再创建 Home 全屏快照，只让目标窗口用 200ms 淡入并上移 3px 归位；实时壁纸、顶栏和任务栏保持不动。\n- 桌面任务栏在模块间切换时只显示新活动页面的约 200ms、±6px 轻滑入；返回 Home 时仅让图标区轻滑入，Home 快照不会进入顶层遮住任务栏。\n- 手机 Dock 切换使用约 220ms、±12px 的方向滑动；一个共享选中底板在入口间连续移动，快速连续点击会中止旧转场，不再硬切或留下重影。\n- 弹窗、窗口、按钮和主题统一为低位移反馈；减少动态与关闭动效模式立即完成导航。\n\n## 真实可用的手机导航\n\n- 手机 Appbar 左上角使用带文字的 Home 返回按钮，当前模块名移到右上角，账号和语言仍只在 Home 显示。\n- 底部 Dock 在所有模块内保持悬浮，只保留 Home、知识库、视频、资源、游戏和聊天室六个高频入口；375px 以上居中排列，359px 可短距离横滑，杂谈与关于仍从 Home 图标进入。\n- 网页无法可靠读取 iPhone 的真实信号、Wi-Fi 与电量，因此移除装饰性状态图标，避免把模拟状态误认为设备状态。\n\n## 更紧凑的首页与分层模块\n\n- Home 图标按从左到右、从上到下排列，固定行高，热区贴合图标与标题并保持至少 44px。\n- 知识库、视频、资源、游戏、杂谈、聊天室与关于页继续使用统一的外框、工具区、标签区和内容区层级。\n- 边框使用本站四时段和 Neo-XP 色彩，不复制参考图配色或图标；卡片、文案和按钮继续适配短竖屏与横屏。\n\n所有原有路由、API、D1 数据、账户登录、游戏云存档、普通与密码聊天室、三语内容、视频系统和遥测隐私边界保持不变。",
        en: "# GPT-5.6 Premium Interaction & Mobile OS Redesign\n\nThis consolidated update keeps the Windows XP, pixel-art, and Y2K identity on desktop while refining mobile into a tighter and more readable original virtual phone OS.\n\n## Site-wide calm motion reset\n\n- Desktop Home App launches no longer create a full Home-screen snapshot. Only the destination window fades in and settles upward by 3px over 200ms, while the live wallpaper, top bar, and taskbar remain still.\n- Desktop taskbar module changes reveal only the new active page with an approximately 200ms, ±6px slide. Returning Home animates only the icon group, so no Home snapshot can cover the taskbar.\n- Mobile Dock changes use an approximately 220ms directional ±12px slide. One shared selection pill moves continuously between routes, and rapid taps skip the previous transition instead of producing a hard cut or ghost frame.\n- Dialogs, windows, buttons, and theme changes now share low-displacement feedback. Reduced-motion and motion-off modes navigate immediately.\n\n## A real mobile navigation Dock\n\n- The mobile Appbar has a labeled Home button on the left and the current module name aligned on the right. Account and language controls remain Home-only.\n- The frosted Dock persists across Apps with six high-frequency routes: Home, Knowledge, Videos, Resources, Games, and Chat. They center from 375px upward and briefly scroll at 359px; Notes and About remain available from Home.\n- Browsers cannot reliably read an iPhone's real signal, Wi-Fi, or battery status, so decorative status glyphs were removed to avoid presenting simulated values as device state.\n\n## Tighter Home and layered Apps\n\n- Home icons fill left to right and top to bottom with fixed rows; hit areas hug the visible icon and label while retaining a 44px minimum.\n- Knowledge, Videos, Resources, Games, Notes, Chat, and About keep a shared outer-frame, toolbar, tab, and content hierarchy.\n- Frames use this site's four-time Neo-XP palette rather than copying reference colors or icons, and content remains adaptive in short portrait and landscape layouts.\n\nExisting routes, APIs, D1 data, account sessions, game cloud saves, public and password chat, three-language content, video delivery, and telemetry privacy boundaries remain unchanged.",
        ja: "# GPT-5.6 プレミアム操作とモバイル OS 再設計\n\n今回の統合更新では、デスクトップの Windows XP、ピクセルアート、Y2K の個性を保ちながら、モバイルをよりコンパクトで読みやすい独自の仮想スマートフォン OS に整えました。\n\n## 全体を軽い動きに再設計\n\n- デスクトップの Home から App を開くときは全画面スナップショットを作らず、対象ウィンドウだけを 200ms のフェードと 3px の上移動で整えます。壁紙、上部バー、タスクバーは動きません。\n- デスクトップ下部ナビのモジュール切り替えは、新しい活動ページだけを約 200ms、±6px で軽く表示します。Home 復帰ではアイコン領域だけを動かし、Home のスナップショットがタスクバーを覆うことはありません。\n- モバイル Dock は約 220ms、±12px の方向付きスライドを使います。一つの共有選択プレートが項目間を連続して移動し、素早い連続操作では古い遷移を中止するため、硬い切り替えや残像が出ません。\n- ダイアログ、ウィンドウ、ボタン、テーマも低移動量の反応に統一しました。動きを減らす設定では直ちに移動します。\n\n## 実際に使えるモバイル Dock\n\n- Appbar 左上に文字付き Home ボタンを置き、現在のモジュール名を右上に揃えました。アカウントと言語操作は Home のみに残します。\n- 半透明 Dock は Home、知識庫、動画、リソース、ゲーム、チャットの高頻度 6 項目に整理しました。375px 以上では中央に並び、359px では短く横スクロールできます。雑談とプロフィールは Home から開けます。\n- ブラウザーは iPhone の実際の電波、Wi-Fi、バッテリーを安定して取得できないため、模擬値と誤解される装飾表示を削除しました。\n\n## コンパクトな Home と多層 App\n\n- Home アイコンは左から右、上から下へ固定行高で並び、タップ範囲は見えるアイコンとラベルに沿わせつつ 44px 以上を保ちます。\n- 知識庫、動画、リソース、ゲーム、雑談、チャット、プロフィールは、外枠、ツール、タブ、内容領域の共通階層を維持します。\n- 参考画像の色やアイコンはコピーせず、このサイトの四時間帯 Neo-XP 配色を使い、短い縦画面と横画面にも適応します。\n\n既存のルート、API、D1 データ、アカウント、ゲームのクラウドセーブ、公開・パスワードチャット、三言語コンテンツ、動画、テレメトリーのプライバシー境界は変更していません。"
      }
    },
    {
      icon: "🔒",
      date: "2026.07.06",
      title: {
        zh: "暗色加密密码房上线",
        en: "Dark Encrypted Password Rooms",
        ja: "暗色の暗号化パスワード部屋"
      },
      desc: {
        zh: "匿名聊天室新增暗色密码房，并修复旧库自动补字段时普通大厅读取失败的问题",
        en: "Anonymous chat now has dark encrypted password rooms, with a migration fix for existing public rooms",
        ja: "匿名チャットに暗色の暗号化パスワード部屋を追加し、既存ルームの移行時読み込み不具合も修正しました"
      }
    },
    {
      icon: "🪟",
      date: "2026.06.30",
      title: {
        zh: "账号弹窗层级修复",
        en: "Account Popover Layer Fix",
        ja: "アカウント表示の重なり修正"
      },
      desc: {
        zh: "右上角账号入口现在会显示在首页和各栏目窗口之上，登录、注册和退出流程保持不变",
        en: "The top-right account entry now opens above the home page and section windows while keeping login, registration, and sign-out behavior unchanged",
        ja: "右上のアカウント入口がホームや各セクションのウィンドウより前面に表示され、ログイン、登録、ログアウトの動作はそのままです"
      }
    },
    {
      icon: "🧩",
      date: "2026.06.24",
      title: {
        zh: "账号流程与合并上线整理",
        en: "Account Flow and Merge Launch",
        ja: "アカウント操作とマージ公開の整理"
      },
      desc: {
        zh: "账号登录、注册和退出改为更稳定的按钮流程，最近更新操作区完成精简，发布方式回到合并 main 后自动上线",
        en: "Account sign-in, registration, and sign-out now use steadier button handling, the recent-update actions are simplified, and releases return to merge-to-main deployment",
        ja: "ログイン、登録、ログアウトのボタン処理を安定させ、最近の更新の操作欄を簡潔にし、main へのマージで公開する流れに戻しました"
      }
    },
    {
      icon: "🛠️",
      date: "2026.06.23",
      title: {
        zh: "公开体验、无障碍和隐私收尾",
        en: "Public UX, Accessibility, and Privacy Wrap-up",
        ja: "公開体験・アクセシビリティ・プライバシー仕上げ"
      },
      desc: {
        zh: "主站按钮点击、弹窗焦点、资源空状态、社交入口、游戏来源链接和访问统计隐私做了一轮集中收口",
        en: "The public site received a wrap-up pass for button clicks, modal focus, honest empty states, social links, game source links, and analytics privacy",
        ja: "公開サイトのボタン操作、モーダルのフォーカス、空状態、SNS入口、ゲーム出典リンク、アクセス解析のプライバシーをまとめて整えました"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.22",
      title: { zh: "底部导航与四时段窗口背景", en: "Pinned Taskbar and Window Backdrops", ja: "固定タスクバーと時間帯背景" },
      desc: {
        zh: "底部导航固定贴合屏幕下沿，窗口页改用随时间切换的专用低干扰背景，并补齐窄屏手机窗口避让",
        en: "The bottom taskbar now stays pinned to the viewport edge, with dedicated quiet backdrops and small-phone window spacing",
        ja: "下部タスクバーを画面下端に固定し、専用の控えめな背景と狭いスマホ幅での余白を整えました"
      }
    },
    {
      icon: "📇",
      date: "2026.06.22",
      title: { zh: "联系方式图标归位", en: "Contact Icons Aligned", ja: "連絡先アイコンを整理" },
      desc: {
        zh: "关于我窗口删除联系方式占位文案，把 X、GitHub、Bilibili、Instagram 和 Discord 原应用图标移入联系方式行",
        en: "The About window removes the contact placeholder and moves the X, GitHub, Bilibili, Instagram, and Discord app icons into the Contact row",
        ja: "プロフィール画面の連絡先プレースホルダーを削除し、X、GitHub、Bilibili、Instagram、Discord のアプリアイコンを連絡先行へ移動しました"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.20",
      title: { zh: "关于我社交图标上线", en: "About Social Icons", ja: "プロフィールのSNSアイコン" },
      desc: {
        zh: "关于我窗口新增 X、GitHub、Bilibili、Instagram 和 Discord 纯图标入口，后台可修改每个跳转链接",
        en: "The About window now has icon-only links for X, GitHub, Bilibili, Instagram, and Discord, with admin-editable URLs",
        ja: "プロフィール画面に X、GitHub、Bilibili、Instagram、Discord のアイコンリンクを追加し、管理画面でURLを変更できます"
      }
    },
    {
      icon: "🖥️",
      date: "2026.06.19",
      title: { zh: "四时段沉浸式桌面栏", en: "Immersive Time-of-Day Chrome", ja: "時間帯別の没入デスクトップバー" },
      desc: {
        zh: "首页顶部栏和底部任务栏改为无竖线的现代玻璃像素 HUD，morning、day、dusk、night 四套主题继续保留原有图标和功能",
        en: "The home top bar and taskbar now use four modern glass pixel HUD themes without vertical grid lines while keeping all existing icons and behavior",
        ja: "ホームの上部バーとタスクバーを縦線なしのモダンなガラス調ピクセル HUD に更新し、既存アイコンと動作はそのまま保ちました"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.19",
      title: { zh: "主站发现与收口记录", en: "Main Site Discovery Wrap-up", ja: "メインサイト発見性の仕上げ" },
      desc: {
        zh: "本次主站循环补齐搜索发现配置、站点地图、manifest、robots、三语页面 meta 和语言按钮状态，并完成构建与多视口检查",
        en: "This cycle added discovery metadata, sitemap, manifest, robots, trilingual page meta sync, language button state, and final build plus viewport checks",
        ja: "今回のサイクルでは、検索向けメタ情報、サイトマップ、manifest、robots、三言語 meta 同期、言語ボタン状態、最終確認を追加しました"
      }
    },
    {
      icon: "🎨",
      date: "2026.06.18",
      title: { zh: "主端视觉改版循环更新", en: "Main Site Visual Polish Cycle", ja: "メインサイト視覚調整サイクル更新" },
      desc: {
        zh: "本次循环统一打磨首页、知识库、视频区、资源区、游戏区、聊天室、关于我和账号入口的 XP 桌面视觉与移动端排版",
        en: "This cycle polished the XP desktop visuals and responsive layout across Home, Knowledge, Videos, Resources, Games, Chat, About, and Account surfaces",
        ja: "今回のサイクルでは、ホーム、知識庫、動画、リソース、ゲーム、チャット、About、アカウント周りの XP デスクトップ表示とモバイル配置を整えました"
      }
    },
    {
      icon: "🪟",
      date: "2026.06.18",
      title: { zh: "主站夜间优化汇总", en: "Public Site Nightly Summary", ja: "メインサイト夜間更新まとめ" },
      desc: {
        zh: "合并昨晚主站优化记录，并按参考图完成知识库文章页 10 轮阅读布局复刻打磨；文章窗口不再拉伸占满全站",
        en: "Merged last night's public-site updates, completed ten reference-matching passes, and kept the article window inside the site frame",
        ja: "昨夜のメインサイト更新をまとめ、参考画像に合わせて知識庫の記事ページを10回調整し、記事ウィンドウはサイト内サイズに戻しました"
      }
    },
    {
      icon: "🗂️",
      date: "2026.06.18",
      title: { zh: "资源空分类提示", en: "Resource Empty Category State", ja: "リソース空分類表示" },
      desc: {
        zh: "资源区空分类现在会显示三语空状态和返回全部资源按钮，不再留下空白列表",
        en: "Empty resource categories now show a trilingual empty state with a button back to all resources",
        ja: "空のリソース分類に三言語の空状態とすべてへ戻るボタンを表示します"
      }
    },
    {
      icon: "📊",
      date: "2026.06.18",
      title: { zh: "资源分类数量徽标", en: "Resource Filter Counts", ja: "リソース分類数バッジ" },
      desc: {
        zh: "资源区分类按钮现在显示每类资源数量，筛选前就能看到占位和资源分布",
        en: "Resource category buttons now show item counts so the resource distribution is visible before filtering",
        ja: "リソース分類ボタンに件数を表示し、絞り込み前に配分が分かるようにしました"
      }
    },
    {
      icon: "📦",
      date: "2026.06.18",
      title: { zh: "资源卡片状态徽标", en: "Resource Status Badges", ja: "リソース状態バッジ" },
      desc: {
        zh: "资源区卡片会显示准备中或可获取状态，下载按钮逻辑继续走安全链接校验",
        en: "Resource cards now show pending or ready status badges while download actions still use safe link checks",
        ja: "リソースカードに準備中または利用可の状態バッジを追加し、リンク確認は従来どおりです"
      }
    },
    {
      icon: "🎮",
      date: "2026.06.18",
      title: { zh: "游戏卡片信息增强", en: "Game Card Info Badges", ja: "ゲームカード情報バッジ" },
      desc: {
        zh: "游戏区卡片新增云存档和源码徽标，进入游戏前能看到保存与开源状态",
        en: "Game cards now show cloud-save and source badges so save and open-source status are visible before launch",
        ja: "ゲームカードにクラウド保存とソースのバッジを追加し、起動前に状態を確認できます"
      }
    },
    {
      icon: "⬆️",
      date: "2026.06.18",
      title: { zh: "文章回到顶部按钮", en: "Article Back-to-Top Button", ja: "記事先頭へ戻るボタン" },
      desc: {
        zh: "知识库文章详情新增三语回到顶部按钮，目录跳转后可以快速回到标题区",
        en: "Knowledge article details now include a trilingual back-to-top button after jumping through contents",
        ja: "知識庫の記事詳細に三言語の先頭へ戻るボタンを追加し、目次移動後に戻りやすくしました"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.18",
      title: { zh: "文章目录导航", en: "Article Contents Navigation", ja: "記事目次ナビ" },
      desc: {
        zh: "知识库文章详情会按正文标题生成三语目录，长文可以快速跳到对应段落",
        en: "Knowledge article details now build a trilingual contents strip from body headings for quicker jumps",
        ja: "知識庫の記事詳細で本文見出しから三言語の目次を作り、長文の移動を速くしました"
      }
    },
    {
      icon: "📊",
      date: "2026.06.18",
      title: { zh: "文章阅读进度条", en: "Article Reading Progress", ja: "記事の読書進捗バー" },
      desc: {
        zh: "知识库文章详情新增三语阅读进度条，长文滚动时能看到当前位置",
        en: "Knowledge article details now show a trilingual reading progress bar while long posts scroll",
        ja: "知識庫の記事詳細に三言語の読書進捗バーを追加し、長文の現在位置が分かります"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.18",
      title: { zh: "文章链接保留语言", en: "Article Links Keep Language", ja: "記事リンクの言語保持" },
      desc: {
        zh: "文章卡片和最近更新的真实链接会带上当前 lang，新开标签也保留语言",
        en: "Article cards and recent updates now include the active lang in their real links for new tabs",
        ja: "記事カードと最近の更新リンクに現在の lang を含め、新しいタブでも言語を保持します"
      }
    },
    {
      icon: "🧾",
      date: "2026.06.18",
      title: { zh: "最近更新完整提示", en: "Recent Update Full Labels", ja: "最近の更新ラベル補足" },
      desc: {
        zh: "最近更新链接补充完整 title 和 aria-label，截断标题也能读到完整内容",
        en: "Recent update links now include full title and aria-label text even when the visible title is truncated",
        ja: "最近の更新リンクに完全な title と aria-label を追加し、省略表示でも内容を確認できます"
      }
    },
    {
      icon: "🖼️",
      date: "2026.06.18",
      title: { zh: "静态图片尺寸提示", en: "Static Image Dimensions", ja: "静的画像サイズ指定" },
      desc: {
        zh: "首屏品牌头像、聊天室头像、关于头像和 Start 图标补充真实 width / height，减少图片解码前的布局不确定性",
        en: "Brand, chat, profile, and Start images now declare real width / height values to reduce layout uncertainty before decoding",
        ja: "ブランド、チャット、プロフィール、Start 画像に実寸の width / height を追加し、デコード前のレイアウト揺れを減らします"
      }
    },
    {
      icon: "🏷️",
      date: "2026.06.18",
      title: { zh: "文章标签本地化", en: "Article Tag Locales", ja: "記事タグのローカライズ" },
      desc: {
        zh: "知识库和站点更新里的安全、iframe、聊天室、云存档等标签补齐三语显示",
        en: "Knowledge and site-update tags such as security, iframe, chat room, and cloud saves now have localized labels",
        ja: "知識庫とサイト更新の安全、iframe、チャット、クラウド保存などのタグに多言語表示を追加しました"
      }
    },
    {
      icon: "🎮",
      date: "2026.06.18",
      title: { zh: "游戏 iframe 启动守卫", en: "Game Frame Source Guard", ja: "ゲームフレーム起動ガード" },
      desc: {
        zh: "游戏入口页会校验 catalog 中的 iframe 启动路径和语言参数名，再加载本地 source 页面",
        en: "Game entry pages now validate catalog iframe launch paths and language query names before loading local source pages",
        ja: "ゲーム入口ページが catalog の iframe 起動パスと言語パラメータ名を確認してからローカル source ページを読み込みます"
      }
    },
    {
      icon: "💬",
      date: "2026.06.18",
      title: { zh: "聊天室昵称本地化", en: "Chat Nickname Locale", ja: "チャット名ロケール対応" },
      desc: {
        zh: "匿名聊天室的新随机昵称会跟随当前中文、英文、日文界面生成",
        en: "New random chat nicknames now follow the current Chinese, English, or Japanese interface",
        ja: "匿名チャットの新しいランダム名が現在の中国語・英語・日本語表示に合わせて生成されます"
      }
    },
    {
      icon: "🖼️",
      date: "2026.06.18",
      title: { zh: "文章图片路径守卫", en: "Article Image Path Guard", ja: "記事画像パスガード" },
      desc: {
        zh: "文章 Markdown 配图继续限制在项目文章图片目录，并显式拒绝路径穿越片段",
        en: "Markdown article images stay limited to the project article-image folder and now explicitly reject traversal segments",
        ja: "Markdown 記事画像は記事画像フォルダに限定し、パストラバーサル片を明示的に拒否します"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.18",
      title: { zh: "资源链接白名单", en: "Resource URL Allowlist", ja: "リソースURL許可リスト" },
      desc: {
        zh: "资源下载和外链在渲染前会先规范化 URL，并只接受安全本地路径或 http(s) 链接",
        en: "Resource downloads and external links are normalized before rendering and only accept safe local paths or http(s) URLs",
        ja: "リソースのダウンロードと外部リンクは描画前に正規化し、安全なローカルパスまたは http(s) URL のみ受け付けます"
      }
    },
    {
      icon: "🎞️",
      date: "2026.06.18",
      title: { zh: "视频链接白名单", en: "Video Link Allowlist", ja: "動画リンク許可リスト" },
      desc: {
        zh: "视频缩略图、原地址和播放器 iframe 在前端也会经过域名白名单校验",
        en: "Video thumbnails, source links, and player iframes now pass frontend domain allowlist checks",
        ja: "動画サムネイル、元リンク、プレイヤー iframe にフロント側のドメイン許可リストを追加しました"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.18",
      title: { zh: "游戏链接白名单", en: "Game Link Allowlist", ja: "ゲームリンク許可リスト" },
      desc: {
        zh: "游戏列表入口和封面路径补充白名单校验，避免不可信 URL 进入页面",
        en: "Game entry links and cover paths now use allowlist checks before rendering",
        ja: "ゲーム入口リンクとカバー画像パスに許可リスト確認を追加しました"
      }
    },
    {
      icon: "🎮",
      date: "2026.06.18",
      title: { zh: "游戏列表安全渲染", en: "Game List Safe DOM", ja: "ゲーム一覧の安全な DOM 描画" },
      desc: {
        zh: "游戏区卡片、语言标签、许可证和加载状态改为 DOM/textContent 构建",
        en: "Game cards, language tags, license labels, and loading states now render through DOM/textContent",
        ja: "ゲームカード、言語タグ、ライセンス、読み込み状態を DOM/textContent 構築にしました"
      }
    },
    {
      icon: "🧰",
      date: "2026.06.18",
      title: { zh: "资源筛选安全渲染", en: "Resource Filters Safe DOM", ja: "リソースフィルターの安全な DOM 描画" },
      desc: {
        zh: "资源区分类筛选按钮改为 DOM/textContent 构建，筛选值和 active 状态保持不变",
        en: "Resource filter buttons now render through DOM/textContent while keeping filter values and active state",
        ja: "リソースのフィルターボタンを DOM/textContent 構築にし、値と active 状態を維持します"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.18",
      title: { zh: "知识库筛选安全渲染", en: "Knowledge Filters Safe DOM", ja: "知識庫フィルターの安全な DOM 描画" },
      desc: {
        zh: "知识库分类筛选按钮改为 DOM/textContent 构建，分类名和 active 状态保持不变",
        en: "Knowledge category filter buttons now render through DOM/textContent while preserving labels and active state",
        ja: "知識庫カテゴリーフィルターを DOM/textContent 構築にし、ラベルと active 状態を維持します"
      }
    },
    {
      icon: "🧾",
      date: "2026.06.18",
      title: { zh: "知识库列表安全渲染", en: "Knowledge List Safe DOM", ja: "知識庫リストの安全な DOM 描画" },
      desc: {
        zh: "知识库文章列表改为 DOM/textContent 构建，标题、摘要、标签、日期和阅读入口继续按纯文本渲染",
        en: "Knowledge article cards now render through DOM/textContent for titles, summaries, tags, dates, and read links",
        ja: "知識庫の記事カードを DOM/textContent 構築にし、タイトル、概要、タグ、日付、読む入口を純テキストで描画します"
      }
    },
    {
      icon: "🛡️",
      date: "2026.06.18",
      title: { zh: "最近更新安全渲染", en: "Recent Updates Safe DOM", ja: "最近更新の安全な DOM 描画" },
      desc: {
        zh: "首页最近更新列表改为 DOM/textContent 构建，标题、摘要、日期和图标都按纯文本渲染",
        en: "The home recent-update list now renders through DOM/textContent for titles, summaries, dates, and icons",
        ja: "ホームの最近更新リストを DOM/textContent 構築にし、タイトル、概要、日付、アイコンを純テキストで描画します"
      }
    },
    {
      icon: "🛠️",
      date: "2026.06.18",
      title: { zh: "最近更新图标优化", en: "Recent Update Icons", ja: "最近更新アイコンを調整" },
      desc: {
        zh: "首页最近更新会按站点更新类型显示工具图标，避免从文章 API 读取后全部显示书本图标",
        en: "The home recent-update list now shows a site-update tool icon instead of treating every API article as a book",
        ja: "ホームの最近更新で、記事 API 由来の更新もすべて本アイコンにならず、サイト更新らしいツールアイコンを表示します"
      }
    },
    {
      icon: "🔐",
      date: "2026.06.18",
      title: { zh: "账号弹窗安全 DOM 渲染", en: "Account Popover Safe DOM", ja: "アカウント表示の安全な DOM 描画" },
      desc: {
        zh: "顶部账号/云存档弹窗改为 DOM/textContent 构建，登录、注册和退出行为保持不变",
        en: "The top account and cloud-save popover now renders through DOM/textContent while keeping login flows unchanged",
        ja: "上部アカウント/クラウド保存表示を DOM/textContent 描画にし、ログイン動作は維持しました"
      }
    },
    {
      icon: "🛡️",
      date: "2026.06.18",
      title: { zh: "游戏外壳安全 DOM 渲染", en: "Game Shell Safe DOM", ja: "ゲームシェルの安全な DOM 描画" },
      desc: {
        zh: "游戏入口页的云存档面板和协议栏改为 DOM/textContent 构建，并限制协议链接格式",
        en: "Game entry cloud-save panels and license links now render through DOM/textContent with safer link checks",
        ja: "ゲーム入口のクラウド保存パネルとライセンス欄を DOM/textContent 描画にし、リンク形式も確認します"
      }
    },
    {
      icon: "🗂️",
      date: "2026.06.18",
      title: { zh: "资源入口文案对齐", en: "Resources Label Sync", ja: "リソース入口ラベル同期" },
      desc: {
        zh: "资源区桌面入口继续保留待定状态，但英文和日文名称与资源窗口标题保持一致",
        en: "The Resources desktop icon keeps its TBD state while matching the Resources window label",
        ja: "リソースのデスクトップ入口は未定表示を保ちつつ、リソースウィンドウ名と揃えました"
      }
    },
    {
      icon: "🎞️",
      date: "2026.06.18",
      title: { zh: "视频缩略图异步解码", en: "Async Video Thumbnail Decoding", ja: "動画サムネイルの非同期デコード" },
      desc: {
        zh: "公开视频卡片缩略图在懒加载基础上补充异步解码，和文章图、游戏封面保持一致",
        en: "Public video thumbnails now add async decoding on top of lazy loading, matching article images and game covers",
        ja: "公開動画カードのサムネイルに遅延読み込みに加えて非同期デコードを追加し、記事画像やゲームカバーと揃えました"
      }
    },
    {
      icon: "📦",
      date: "2026.06.18",
      title: { zh: "资源占位提示补齐", en: "Resource Placeholder Hints", ja: "リソース準備中ヒント" },
      desc: {
        zh: "资源区准备中按钮增加三语 title 与 aria 说明，明确暂时没有下载或外链",
        en: "Coming-soon resource buttons now include localized title and aria hints when no link is available",
        ja: "準備中のリソースボタンに、リンク未設定を示す多言語 title と aria 説明を追加しました"
      }
    },
    {
      icon: "💾",
      date: "2026.06.18",
      title: { zh: "游戏外壳三语同步", en: "Localized Game Shell", ja: "ゲームシェルの多言語同期" },
      desc: {
        zh: "游戏入口页的返回、存档工具、云存档、协议和状态文案会跟随当前语言显示",
        en: "Game entry pages now localize back links, save tools, cloud-save panels, license labels, and status text",
        ja: "ゲーム入口ページの戻るリンク、セーブツール、クラウド保存、ライセンス、状態表示が現在の言語に合わせて表示されます"
      }
    },
    {
      icon: "🌐",
      date: "2026.06.18",
      title: { zh: "游戏语言标记三语同步", en: "Game Language Labels", ja: "ゲーム言語ラベルの多言語同期" },
      desc: {
        zh: "游戏卡片里的中文、英文、日文支持标记会跟随当前站点语言显示名称和不支持提示",
        en: "Game language support tags now localize Chinese, English, Japanese, and unsupported labels",
        ja: "ゲームカードの対応言語タグが、中国語・英語・日本語・未対応表示を現在の言語に合わせます"
      }
    },
    {
      icon: "🎮",
      date: "2026.06.18",
      title: { zh: "游戏封面异步解码", en: "Async Game Cover Decoding", ja: "ゲームカバーの非同期デコード" },
      desc: {
        zh: "游戏区封面图在继续懒加载的基础上补充异步解码，减少打开游戏列表时的解码阻塞",
        en: "Game cover images now add async decoding on top of lazy loading to reduce decode pressure when opening the games list",
        ja: "ゲーム欄のカバー画像に遅延読み込みに加えて非同期デコードを追加し、一覧表示時の負荷を抑えます"
      }
    },
    {
      icon: "📝",
      date: "2026.06.18",
      title: { zh: "杂谈菜单三语同步", en: "Talk Menu Localization", ja: "雑談メニューの多言語同期" },
      desc: {
        zh: "杂谈区 Notepad 风格菜单从固定英文改为跟随中文、English、日本語 切换",
        en: "The Talk area Notepad-style menu now follows the Chinese, English, and Japanese language switch",
        ja: "雑談欄の Notepad 風メニューが中文、English、日本語 の切り替えに合わせて表示されます"
      }
    },
    {
      icon: "☁️",
      date: "2026.06.18",
      title: { zh: "账号弹窗三语同步", en: "Account Popover Localization", ja: "アカウント表示の多言語同期" },
      desc: {
        zh: "登录、注册、邮箱、密码、云存档说明和退出账号等账号弹窗文案会跟随当前语言显示",
        en: "Login, register, email, password, cloud-save notes, and sign-out copy now follow the active language",
        ja: "ログイン、登録、メール、パスワード、クラウドセーブ説明、ログアウト文言が現在の言語に合わせて表示されます"
      }
    },
    {
      icon: "♿",
      date: "2026.06.18",
      title: { zh: "无障碍标签三语同步", en: "Localized ARIA Labels", ja: "ARIAラベルの多言語同期" },
      desc: {
        zh: "品牌按钮、语言切换、桌面图标区和窗口关闭按钮的 aria-label 会跟随当前语言切换",
        en: "Brand, language switcher, desktop icon group, and close-button aria labels now follow the active language",
        ja: "ブランド、言語切り替え、デスクトップアイコン領域、閉じるボタンの aria-label が現在の言語に合わせて変わります"
      }
    },
    {
      icon: "💬",
      date: "2026.06.18",
      title: { zh: "聊天室标题三语同步", en: "Chat Title Localization", ja: "チャット題名の多言語同期" },
      desc: {
        zh: "聊天室窗口标题会跟随中文、English、日本語 切换，不再在英文和日文界面保留中文标题",
        en: "The chat room window title now follows the Chinese, English, and Japanese language switch",
        ja: "チャットルームのウィンドウ題名が中文、English、日本語 の切り替えに合わせて表示されます"
      }
    },
    {
      icon: "🖼️",
      date: "2026.06.18",
      title: { zh: "图片加载细节优化", en: "Image Loading Polish", ja: "画像読み込みの調整" },
      desc: {
        zh: "首屏外头像和文章配图补充懒加载与异步解码，继续保留本地图片白名单",
        en: "Off-screen avatars and article images now use lazy loading and async decoding while keeping the local image whitelist",
        ja: "初期表示外のアバターと記事画像に遅延読み込みと非同期デコードを加え、ローカル画像の許可リストは維持しました"
      }
    },
    {
      icon: "🏷️",
      date: "2026.06.18",
      title: { zh: "标签三语显示", en: "Trilingual Tag Labels", ja: "タグ三言語表示" },
      desc: {
        zh: "文章和杂谈卡片的常见标签会跟随中文、English、日本語 切换显示",
        en: "Common article and talk tags now follow the Chinese, English, and Japanese language switch",
        ja: "記事と雑談カードの主なタグが中文、English、日本語 の切り替えに合わせて表示されます"
      }
    },
    {
      icon: "📖",
      date: "2026.06.18",
      title: { zh: "文章详情搜索条隐藏修复", en: "Article Detail Search Hide", ja: "記事詳細の検索バー非表示" },
      desc: {
        zh: "阅读文章详情时隐藏知识库搜索条，避免搜索控件占用阅读区顶部空间",
        en: "Article detail pages now hide the knowledge search bar so reading space stays focused",
        ja: "記事詳細では知識庫検索バーを隠し、読書スペースをすっきり保ちます"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.18",
      title: { zh: "语言链接参数同步", en: "Language URL Sync", ja: "言語URL同期" },
      desc: {
        zh: "切换语言会同步地址栏 lang 参数，复制当前页面链接时不再带旧语言",
        en: "Language switching now updates the address bar lang parameter so copied links keep the current language",
        ja: "言語切り替え時に URL の lang パラメータを同期し、コピーしたリンクが現在の言語を保ちます"
      }
    },
    {
      icon: "📝",
      date: "2026.06.18",
      title: { zh: "杂谈区占位按钮修复", en: "Talk Placeholder Buttons", ja: "雑談の準備中ボタン" },
      desc: {
        zh: "杂谈区没有真实文章入口时显示整理中按钮，并改用安全 DOM 渲染",
        en: "Talk cards without article targets now show a drafting button and render through safe DOM nodes",
        ja: "実際の記事リンクがない雑談カードは準備中ボタンを表示し、安全な DOM 描画にしました"
      }
    },
    {
      icon: "🖱️",
      date: "2026.06.18",
      title: { zh: "导航当前态增强", en: "Active Navigation State", ja: "ナビ現在状態を強化" },
      desc: {
        zh: "底部任务栏和首页 Start 按钮会标记当前页面，并同步 aria-current",
        en: "The taskbar and Start button now mark the current page and keep aria-current in sync",
        ja: "タスクバーと Start ボタンが現在ページを示し、aria-current も同期します"
      }
    },
    {
      icon: "📦",
      date: "2026.06.18",
      title: { zh: "资源区占位按钮修复", en: "Resource Placeholder Buttons", ja: "リソース準備中ボタン" },
      desc: {
        zh: "资源区没有真实下载或外链时显示准备中按钮，不再使用无效 # 链接",
        en: "Resource cards without real download or external URLs now show a coming-soon button instead of a dead # link",
        ja: "実際のダウンロードや外部リンクがないリソースは、無効な # リンクではなく準備中ボタンを表示します"
      }
    },
    {
      icon: "🪟",
      date: "2026.06.17",
      title: { zh: "文章直链不再弹欢迎窗", en: "Cleaner Article Deep Links", ja: "記事直リンクを読みやすく" },
      desc: {
        zh: "首次打开文章或其他非首页直链时，不再自动弹出欢迎窗口遮挡内容",
        en: "Article and non-home deep links no longer auto-open the welcome modal over the content",
        ja: "記事やホーム以外の直リンクでは、歓迎ウィンドウが内容を隠さないようにしました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.17",
      title: { zh: "视频区空状态增强", en: "Video Empty State", ja: "動画欄の空状態を改善" },
      desc: {
        zh: "视频区没有公开视频时会显示 XP 风格提示，并提供查看网站更新记录的入口",
        en: "The videos area now shows an XP-style empty state with a shortcut to site updates when no videos are published",
        ja: "公開動画がない場合、動画欄に XP 風の空状態とサイト更新記録への入口を表示します"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.17",
      title: { zh: "文章详情复制链接", en: "Article Link Copy", ja: "記事リンクコピー" },
      desc: {
        zh: "知识库文章详情新增复制直链按钮，便于分享当前语言的文章页面",
        en: "Knowledge articles now have a copy-link button for sharing the current language view",
        ja: "知識庫の記事詳細に、現在の言語ページを共有しやすいリンクコピーを追加しました"
      }
    },
    {
      icon: "📚",
      date: "2026.06.17",
      title: { zh: "知识库本地搜索上线", en: "Knowledge Search Added", ja: "知識庫検索を追加" },
      desc: {
        zh: "知识库顶部新增本地搜索，可按标题、简介、分类和标签快速过滤文章，并适配三语和手机端布局",
        en: "The knowledge base now has local search across titles, summaries, categories, and tags, with trilingual and mobile layouts",
        ja: "知識庫にローカル検索を追加し、タイトル・概要・分類・タグを三言語とモバイル表示で絞り込めるようにしました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.16",
      title: { zh: "视频卡片与分类持久化修复", en: "Video Card and Category Persistence Fixes", ja: "動画カードとカテゴリ保持の修正" },
      desc: {
        zh: "视频卡片减少无用空白，视频分类默认 seed 不再补回已删除标签，聊天室桌面图标也与名称拉开距离",
        en: "Video cards use less empty space, default category seeds no longer restore deleted tags, and the chatroom icon has clearer label spacing",
        ja: "動画カードの余白を減らし、削除済みカテゴリを既定 seed が戻さないようにし、チャットアイコンとラベルの間隔も調整しました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.16",
      title: { zh: "视频区窗口自适应放大", en: "Responsive Video Window", ja: "動画欄ウィンドウの自動拡大" },
      desc: {
        zh: "视频区列表窗口会跟随屏幕可用高度放大，减少桌面底部空白并显示更多视频卡片",
        en: "The videos window now grows with available screen height, reducing empty desktop space and showing more cards",
        ja: "動画欄のウィンドウが画面の高さに合わせて広がり、下部の空白を減らしてより多くのカードを表示します"
      }
    },
    {
      icon: "📱",
      date: "2026.06.16",
      title: { zh: "移动端与后台视频维护修复", en: "Mobile and Admin Video Maintenance Fixes", ja: "モバイル表示と動画管理を修正" },
      desc: {
        zh: "修复视频分类标签回退、B 站元数据抓取提示，并补强视频/资源/登录弹窗的手机端适配",
        en: "Fixed video category rollback, Bilibili metadata handling, and mobile layouts for videos, resources, and login popovers",
        ja: "動画カテゴリ名の戻り、Bilibili メタ情報取得、動画・リソース・ログイン周りのモバイル表示を調整しました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.15",
      title: { zh: "视频管理排序与 B 站信息修复", en: "Video Sorting and Bilibili Metadata Fixes", ja: "動画管理の並び順と Bilibili 情報取得を修正" },
      desc: {
        zh: "修复 Bilibili 元数据兜底、视频排序、统一卡片尺寸和首页视频入口文案",
        en: "Improved Bilibili metadata fallback, video ordering, card sizing, and the home Videos label",
        ja: "Bilibili メタ情報の補完、動画の並び順、カードサイズ、ホームの動画ラベルを調整しました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.15",
      title: { zh: "视频播放器窗口交互修复", en: "Video Player Window Controls", ja: "動画プレイヤーのウィンドウ操作修正" },
      desc: {
        zh: "站内全屏改为 XP 窗口最大化/还原，原地址按钮恢复真实链接，并收紧 iframe 控制区热区",
        en: "Changed site fullscreen into an XP window maximize toggle, restored original video links, and tightened iframe control hit zones",
        ja: "サイト内全画面を XP 風ウィンドウの最大化/復元に変更し、元リンクと iframe 操作範囲を調整しました"
      }
    },
    {
      icon: "🖼️",
      date: "2026.06.15",
      title: { zh: "首页底部长条修复", en: "Home Bottom Strip Fix", ja: "ホーム下部ライン修正" },
      desc: {
        zh: "修复任务栏上方露出的绿色长条，四个时间段壁纸现在都会填满首页中间区域",
        en: "Fixed the green strip above the taskbar so every time-of-day wallpaper fills the home area",
        ja: "タスクバー上の緑の線を修正し、4時間帯の壁紙がホーム領域を埋めるようにしました"
      }
    },
    {
      icon: "🪟",
      date: "2026.06.15",
      title: { zh: "窗口图标与云层残影修复", en: "Window Icons and Cloud Cleanup", ja: "ウィンドウアイコンと雲の残影修正" },
      desc: {
        zh: "补发窗口与任务栏图标更新记录，并修复夜晚/黄昏动态壁纸 clean 底图里的云层残影",
        en: "Added the missing window/taskbar icon update record and cleaned residual clouds from Night and Dusk wallpaper plates",
        ja: "ウィンドウとタスクバーのアイコン更新記録を補い、夜と夕方の壁紙ベースに残った雲の跡を修正しました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.15",
      title: { zh: "视频区改造成可管理系统", en: "Managed Video System", ja: "動画欄を管理できる仕組みに変更" },
      desc: {
        zh: "后台现在可以管理 YouTube 和 Bilibili 链接，自动识别信息并在主站 XP 窗口内播放",
        en: "The admin can now manage YouTube and Bilibili links, fetch metadata, and play videos inline in the XP window",
        ja: "管理画面で YouTube と Bilibili のリンクを登録し、XP 風ウィンドウ内で再生できるようになりました"
      }
    },
    {
      icon: "☁️",
      date: "2026.06.15",
      title: { zh: "云层漂移提速与流畅度优化", en: "Smoother cloud drift", ja: "雲レイヤーの滑らかさ調整" },
      desc: { zh: "首页四时段云层漂移小幅加快，并优化合成层提示，减少卡顿和首帧跳动", en: "Slightly sped up the four time-of-day cloud drift and tuned compositor hints to reduce stutter and first-frame jumps", ja: "ホームの4時間帯の雲移動を少し速め、合成レイヤーの設定を整えてカクつきと初期フレームのずれを抑えました" }
    },
    {
      icon: "📝",
      date: "2026.06.15",
      title: { zh: "动态云层与维护记录补齐", en: "Clouds and maintenance log", ja: "雲と保守記録を補完" },
      desc: { zh: "补齐四时段动态云层上线记录、项目文档、Skill 规则和 site-updates 三语更新文章，让最近更新日期跟随真实记录", en: "Added the missing site-update article, project docs, Skill notes, and fallback update entry for the four-time cloud animation", ja: "4時間帯の雲アニメーションについて、更新記事、文書、Skill、fallback 最近更新を補完しました" }
    },
    {
      icon: "☁️",
      date: "2026.06.15",
      title: { zh: "四时段动态云层", en: "Four-time cloud animation", ja: "4時間帯の雲アニメーション" },
      desc: { zh: "首页 morning / day / dusk / night 都接入无云底图和独立云层，使用同一主风向的慢速错相漂移，并支持页面隐藏暂停和减少动态模式", en: "Morning, Day, Dusk, and Night wallpapers now use cloudless bases with independent slow-drifting cloud layers, pause-on-hidden, and reduced-motion support", ja: "朝・昼・夕方・夜の壁紙に無雲ベースと独立した低速雲レイヤーを追加し、非表示時の一時停止と低モーション設定に対応しました" }
    },
    {
      icon: "📖",
      date: "2026.06.15",
      title: { zh: "AI Agent 文章直链与阅读优化", en: "AI Agent article links and reading polish", ja: "AI Agent 記事リンクと閲覧体験を調整" },
      desc: { zh: "知识库长文窗口改为随浏览器扩展，文章支持域名直链、蓝色说明框和配图展示", en: "Long knowledge articles now use a larger responsive window with domain article links, blue callout boxes, and inline images", ja: "知識庫の長文ウィンドウを広くし、ドメイン直リンク、青い説明枠、本文画像に対応しました" }
    },
    {
      icon: "🌄",
      date: "2026.06.12",
      title: { zh: "首页壁纸高清替换", en: "Sharper home wallpapers", ja: "ホーム壁紙を高解像度化" },
      desc: { zh: "首页四时段壁纸改用 1672x941 原图，并调整裁切比例和缓存版本，减少全屏放大后的发糊", en: "The four home wallpapers now use the 1672x941 originals with an updated crop ratio and cache version to reduce fullscreen blur", ja: "ホームの4時間帯壁紙を1672x941の原寸画像に替え、裁切比率とキャッシュ版を更新して全画面時のぼやけを減らしました" }
    },
    {
      icon: "🎮",
      date: "2026.06.12",
      title: { zh: "人生重开模拟器本地接入", en: "Life Restart added locally", ja: "Life Restart をローカル追加" },
      desc: { zh: "Life Restart 已构建为本站静态游戏，接入统一游戏外壳、语言标记和云存档键", en: "Life Restart is now built as a local static game with the shared game shell, language tags, and cloud-save keys", ja: "Life Restart を本站内の静的ゲームとして追加し、共通シェル、言語表示、クラウド保存キーに対応しました" }
    },
    {
      icon: "🌅",
      date: "2026.06.12",
      title: { zh: "四时段静态像素壁纸接口", en: "Time-of-day wallpaper interface", ja: "時間帯別壁紙インターフェース" },
      desc: { zh: "首页新增 image2 重绘的四时段静态壁纸，并保留后续动画图层接口", en: "The home screen now uses redrawn static wallpapers across four local-time periods, with animation layer hooks kept for later", ja: "ホームに再描画した4時間帯の静的壁紙を追加し、今後のアニメーション層の入口を残しました" }
    },
    {
      icon: "🕒",
      date: "2026.06.11",
      title: { zh: "时间显示与窗口尺寸整理", en: "Time and window layout fixes", ja: "時刻表示とウィンドウ調整" },
      desc: { zh: "文章和聊天室时间改为按用户时区显示，知识库关闭后回首页，关于我窗口收紧", en: "Article and chat times now use the visitor timezone; knowledge resets on close and About is compact", ja: "記事とチャット時刻を閲覧者の時区に合わせ、知識庫とプロフィール表示を調整しました" }
    },
    {
      icon: "🎮",
      date: "2026.06.11",
      title: { zh: "游戏区改为本地直玩", en: "Games now play locally", ja: "ゲームをサイト内プレイに整理" },
      desc: { zh: "保留猫国建设者、小黑屋、2048 和 Hextris，2048 与 Hextris 已接入本站存档和三语界面", en: "Kept Kittens Game, A Dark Room, 2048, and Hextris; 2048 and Hextris now use site saves and trilingual UI", ja: "Kittens Game、A Dark Room、2048、Hextris を残し、2048 と Hextris は保存連携と三言語UIに対応しました" }
    },
    {
      icon: "🪟",
      date: "2026.06.11",
      title: { zh: "首页与知识库排版修复", en: "Home and knowledge layout fixes", ja: "ホームと知識庫の表示修正" },
      desc: { zh: "优化桌面图标、知识库阅读页、视频卡片和聊天室时间显示", en: "Refined desktop icons, article reading, video cards, and chat timestamps", ja: "デスクトップアイコン、記事閲覧、動画カード、チャット時刻を調整しました" }
    },
    {
      icon: "🎮",
      date: "2026.06.11",
      title: { zh: "游戏区扩展与发布时间精确到秒", en: "Game library and precise publish times", ja: "ゲーム欄拡張と秒単位の時刻" },
      desc: { zh: "新增多款开源游戏入口，并让知识库发布时间显示到秒", en: "Added open-source game entries and second-level article publish times", ja: "ゲーム入口を追加し、記事公開時刻を秒まで表示します" }
    },
    {
      icon: "📚",
      date: "2026.06.11",
      title: { zh: "数据库化三语文章系统", en: "Database-backed trilingual articles", ja: "DB対応三言語記事システム" },
      desc: { zh: "知识库文章改为从 Cloudflare D1 读取，支持中英日内容和 Markdown 详情", en: "Knowledge articles now load from Cloudflare D1 with zh/en/ja content and Markdown detail pages", ja: "知識庫の記事を Cloudflare D1 から読み込み、三言語本文と Markdown 詳細に対応しました" }
    },
    {
      icon: "🎮",
      date: "2026.06.11",
      title: { zh: "游戏区卡片整理", en: "Games section cards refined", ja: "ゲーム欄カードを整理" },
      desc: { zh: "删去临时说明和多余标签，游戏列表改为内容较多时内部滚动", en: "Temporary notes and extra tags were removed, with internal scrolling for longer game lists", ja: "一時説明と余分なタグを削除し、ゲーム一覧は多い時に内部スクロールします" }
    },
    {
      icon: "💬",
      date: "2026.06.10",
      title: { zh: "匿名聊天室 MVP 上线", en: "Anonymous chat MVP added", ja: "匿名チャットMVPを追加" },
      desc: { zh: "访客可用随机昵称直接发言，消息保存到 Cloudflare D1", en: "Visitors can chat with random nicknames, backed by Cloudflare D1", ja: "ランダム名で発言でき、Cloudflare D1に保存されます" }
    },
    {
      icon: "📺",
      date: "2026.06.10",
      title: { zh: "电视机头像与站点图标更新", en: "TV avatar and site icon updated", ja: "テレビ頭アバターとサイトアイコンを更新" },
      desc: { zh: "首页品牌、关于我入口和头像已换新", en: "Brand icon, About entry, and profile avatar are refreshed", ja: "ブランド、プロフィール入口、头像を差し替えました" }
    },
    {
      icon: "📱",
      date: "2026.06.10",
      title: { zh: "手机端显示重新适配", en: "Mobile layout retuned", ja: "スマホ表示を再調整" },
      desc: { zh: "顶部、登录窗口、公告窗口、视频区和资源区更省空间", en: "Top bar, login, announcements, videos, and resources now use space better", ja: "上部栏、ログイン、告知、動画、リソース欄を省スペース化" }
    },
    {
      icon: "🎮",
      date: "2026.06.10",
      title: { zh: "内置游戏窗口适配小屏幕", en: "Embedded games fit small screens better", ja: "内蔵ゲームを小画面向けに調整" },
      desc: { zh: "游戏工具栏和 iframe 高度会跟随屏幕调整", en: "Game tools and iframe height now respond to the viewport", ja: "ゲームツールと iframe 高さが画面に合わせて変化します" }
    }
  ],
  knowledge: [
    {
      category: 0,
      tags: ["AI", "Local Model"],
      updated: "2026.06.09",
      title: { zh: "LM Studio 入门记录", en: "LM Studio Starter Notes", ja: "LM Studio 入門メモ" },
      desc: {
        zh: "记录本地模型工具的安装、加载模型和基础聊天流程。",
        en: "Notes on installing a local model tool, loading models, and starting basic chats.",
        ja: "ローカルモデルツールの導入、モデル読み込み、基本チャットの記録。"
      }
    },
    {
      category: 0,
      tags: ["Bot", "Translate"],
      updated: "2026.06.09",
      title: { zh: "Discord 翻译机器人搭建笔记", en: "Discord Translation Bot Notes", ja: "Discord 翻訳ボット構築メモ" },
      desc: {
        zh: "整理频道翻译、权限配置和常见报错的处理方式。",
        en: "Channel translation setup, permission notes, and common error handling.",
        ja: "チャンネル翻訳、権限設定、よくあるエラー対応のまとめ。"
      }
    },
    {
      category: 2,
      tags: ["VRChat", "Unity"],
      updated: "2026.06.08",
      title: { zh: "VRChat 世界制作踩坑", en: "VRChat World Building Pitfalls", ja: "VRChat ワールド制作の失敗メモ" },
      desc: {
        zh: "记录 Unity 场景、材质、碰撞体和上传流程里遇到的问题。",
        en: "Issues found in Unity scenes, materials, colliders, and upload flow.",
        ja: "Unityシーン、マテリアル、コライダー、アップロード手順の問題記録。"
      }
    },
    {
      category: 3,
      tags: ["JP", "Phrase"],
      updated: "2026.06.06",
      title: { zh: "日语常用表达整理", en: "Common Japanese Expressions", ja: "日本語のよく使う表現整理" },
      desc: {
        zh: "收集日常沟通、游戏聊天和视频评论中常见的说法。",
        en: "Everyday phrases for chat, games, and video comments.",
        ja: "日常会話、ゲームチャット、動画コメントで使う表現集。"
      }
    }
  ],
  videos: [
    {
      category: 0,
      platform: "Bilibili",
      color: "linear-gradient(135deg, #9fe7ff, #1d8bd1)",
      url: "https://www.bilibili.com/",
      title: { zh: "VRChat 小世界展示", en: "VRChat Small World Showcase", ja: "VRChat 小さなワールド紹介" },
      desc: { zh: "示例视频卡片，后续替换为真实 B站链接。", en: "A sample card to be replaced with a real Bilibili link.", ja: "あとで実際のBilibiliリンクに置き換えるサンプルカード。" }
    },
    {
      category: 1,
      platform: "YouTube",
      color: "linear-gradient(135deg, #ff9b9b, #d71818)",
      url: "https://www.youtube.com/",
      title: { zh: "AI 工具实验记录", en: "AI Tool Experiment Log", ja: "AIツール実験記録" },
      desc: { zh: "用于展示 AI 测试、模型对比或工作流演示。", en: "For AI tests, model comparisons, or workflow demos.", ja: "AIテスト、モデル比較、ワークフローデモ用。" }
    },
    {
      category: 2,
      platform: "Bilibili",
      color: "linear-gradient(135deg, #ffe680, #73c957)",
      url: "https://www.bilibili.com/",
      title: { zh: "游戏录像片段", en: "Gameplay Clip", ja: "ゲーム録画クリップ" },
      desc: { zh: "放一些游戏体验和高光时刻。", en: "Game moments and highlight clips.", ja: "ゲーム体験やハイライトを置く場所。" }
    },
    {
      category: 4,
      platform: "YouTube",
      color: "linear-gradient(135deg, #b5a8ff, #245edc)",
      url: "https://www.youtube.com/",
      title: { zh: "网站更新记录 001", en: "Site Update Log 001", ja: "サイト更新記録 001" },
      desc: { zh: "记录个人站的版本变化和施工进度。", en: "Version changes and build progress for the site.", ja: "個人サイトのバージョン変更と制作進捗。" }
    }
  ],
  resources: [
    {
      category: 0,
      action: "quick-transfer",
      iconSrc: "assets/images/generated-icons/quick-transfer.png?v=20260719-content-experience-fixes-r1",
      version: "v1.0.0",
      size: "24 HOURS",
      updated: "2026.07.16",
      external: false,
      title: { zh: "临时互传", en: "Quick Transfer", ja: "一時転送" },
      desc: {
        zh: "登录后可在口令房间中发送浏览器端 AES-GCM 加密文字，以及通过 HTTPS、私有 R2 和服务端鉴权保护的图片、视频与文件；内容在发布完成 24 小时后失效。",
        en: "After signing in, share text encrypted in the browser with AES-GCM, plus images, videos, and files protected by HTTPS, private R2 storage, and server-side authorization. Items expire 24 hours after publishing completes.",
        ja: "ログイン後、合言葉の部屋でブラウザー側で AES-GCM 暗号化したテキストと、HTTPS・非公開 R2・サーバー認可で保護される画像／動画／ファイルを共有できます。内容は公開完了から24時間後に失効します。"
      },
      actionLabel: { zh: "打开", en: "Open", ja: "開く" },
      tags: [
        { zh: "登录限定", en: "Sign-in required", ja: "ログイン限定" },
        { zh: "24小时", en: "24 hours", ja: "24時間" },
        { zh: "管理员大文件", en: "Admin large files", ja: "管理者の大容量送信" }
      ]
    },
    {
      category: 0,
      iconSrc: "tools/japanese-subtext/assets/icons/tool-icon-64.webp",
      version: "v1.0.3",
      updated: "2026.07.14",
      external: false,
      showReadyStatus: false,
      url: "/tools/japanese-subtext/",
      title: { zh: "日语的言外之意", en: "Behind the Japanese", ja: "日本語の裏側" },
      desc: {
        zh: "通过语气、上下文和人物关系，判断日语对话中真正想表达的意思。",
        en: "Infer what Japanese speakers really mean through tone, context, and relationships.",
        ja: "口調、文脈、人間関係から、日本語の会話で本当に伝えたいことを読み取ります。"
      },
      actionLabel: { zh: "开始", en: "Start", ja: "開始" },
      tags: [
        { zh: "听力训练", en: "Listening", ja: "聴解" },
        { zh: "潜台词", en: "Subtext", ja: "含意" },
        { zh: "支持（云存档）", en: "Cloud Save Supported", ja: "クラウドセーブ対応" }
      ]
    },
    {
      category: 0,
      icon: "🧰",
      version: "v1.0.0",
      size: "12MB",
      updated: "2026.06.09",
      external: false,
      title: { zh: "示例工具包", en: "Sample Toolkit", ja: "サンプルツールキット" },
      desc: { zh: "用于整理本地 AI 工具的小工具占位。", en: "A placeholder utility for organizing local AI tools.", ja: "ローカルAIツール整理用のサンプル。" }
    },
    {
      category: 2,
      icon: "📦",
      version: "v0.2.1",
      size: "128MB",
      updated: "2026.06.08",
      external: true,
      title: { zh: "VRChat 素材包", en: "VRChat Asset Pack", ja: "VRChat 素材パック" },
      desc: { zh: "较大的素材包建议放网盘、R2 或 GitHub Release。", en: "Large packs can live on cloud drive, R2, or GitHub Releases.", ja: "大きい素材はクラウド、R2、GitHub Releaseに置く想定。" }
    },
    {
      category: 1,
      icon: "⚙️",
      version: "v1.3",
      size: "24KB",
      updated: "2026.06.07",
      external: false,
      title: { zh: "本地模型配置模板", en: "Local Model Config Template", ja: "ローカルモデル設定テンプレート" },
      desc: { zh: "保存常用参数和启动配置的示例文件。", en: "Sample file for common parameters and launch settings.", ja: "よく使うパラメータと起動設定のサンプル。" }
    }
  ],
  games: [],
  blog: [
    {
      tags: ["网站", "日常", "记录"],
      date: "2026.06.09",
      title: { zh: "网站更新日志 001", en: "Site Update Log 001", ja: "サイト更新ログ 001" },
      desc: { zh: "第一版个人站原型开始施工，目标是打开像进入 XP 桌面。", en: "The first prototype begins, aiming to feel like entering an XP desktop.", ja: "初版プロトタイプ制作開始。XPデスクトップに入る感覚を目指す。" }
    },
    {
      tags: ["AI", "观察"],
      date: "2026.06.08",
      title: { zh: "最近对 AI 工具的一点观察", en: "Recent Notes on AI Tools", ja: "最近のAIツール観察" },
      desc: { zh: "把零散体验写在这里，不追求严肃但保留有用细节。", en: "Loose impressions live here, casual but still useful.", ja: "ゆるい感想をここに残す。気軽だけど役に立つ細部も残す。" }
    },
    {
      tags: ["游戏", "碎碎念"],
      date: "2026.06.06",
      title: { zh: "游戏体验临时记录", en: "Temporary Game Notes", ja: "ゲーム体験の一時メモ" },
      desc: { zh: "适合放游戏里的想法、截图说明和短记录。", en: "For game thoughts, screenshot notes, and short records.", ja: "ゲームの感想、スクショ説明、短い記録用。" }
    }
  ]
};
