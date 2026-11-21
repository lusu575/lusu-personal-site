// Active migration bundle. Keep the immediately preceding insert-only release here so
// databases upgrading across either release retain both public update records.
export function articleReleaseSeedStatements(env, { articleTranslationsStatements }) {
  return [
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos-explicit-h', '2026-11-22-pond-videos-explicit-h', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:36:00+08:00', '2026-11-22T04:36:00+08:00', '2026-11-22T04:36:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos-explicit-h", {
  "zh": {
    "summary": "为 3 列视频卡片指定 174px 显式 16:9 封面高度与 320px 最小卡片高度，彻底解决 Chromium 网格自动行高下 aspect-ratio 折叠为 0 引发的封面重叠问题。",
    "title": "明确视频区 3 列封面 174px 显式高度以根治行间叠压",
    "content_markdown": "本次更新彻底解决了视频区 3 列网格中行间重叠的浏览器排版特性：\n\n1. 在 3 列布局（单列约 308px）下，为视频缩略图指定与 16:9 精确对应的 174px 显式高度及 flex-basis，同时为卡片设定 320px 最小高度，确保每行卡片完整撑开，封面文字零裁切且标题、简介与底部播放按钮清晰呈现。\n2. 保持全站其余窗口居中尺寸、暗色点阵加载态、登录浮层正居中及全部游戏与工具内页视觉一致性。"
  },
  "en": {
    "summary": "Set explicit 174px 16:9 thumbnail height and 320px minimum card height in the 3-column Videos grid so Chromium never collapses auto-sized rows.",
    "title": "Explicit 174px 16:9 Thumbnail Height to Eliminate 3-Column Video Row Overlap",
    "content_markdown": "This fix resolves a Chromium flex-inside-grid intrinsic sizing issue on Videos:\n\n1. Assigned an explicit 174px height and flex-basis (exact 16:9 for 308px columns) to video thumbnails and a 320px minimum card height so every row expands cleanly with uncropped thumbnails, bright titles, and aligned Play buttons.\n2. Preserved all other Midnight Pond window geometries, dark loading states, and inner page themes."
  },
  "ja": {
    "summary": "3 列動画グリッドのサムネイルに 16:9 対応の 174px 明示高さとカード最小高さ 320px を指定し、Chromium の自動行高計算による縦重なりを完全に解消しました。",
    "title": "動画区 3 列サムネイルの 174px 明示高さ指定で縦重なりを解消",
    "content_markdown": "動画区 3 列レイアウトで発生していた Chromium の行高折りたたみ問題を修正しました：\n\n1. 列幅 308px に対する厳密な 16:9 となる 174px をサムネイルの高さおよび flex-basis に明示指定し、カード最小高さを 320px とすることで、表紙文字の切り抜きゼロかつタイトル・概要・下部再生ボタンが重ならず整然と表示されます。\n2. 他の全ウィンドウ中央配置や暗色ロード表示・ログイン窓・ゲーム内ページの統一デザインもそのまま維持しています。"
  }
}, "2026-11-22T04:36:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos-row-height', '2026-11-22-pond-videos-row-height', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:32:00+08:00', '2026-11-22T04:32:00+08:00', '2026-11-22T04:32:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos-row-height", {
  "zh": {
    "summary": "将 3 列视频网格中视频卡片高度由 100% 改为 auto，彻底消除行间重叠，完整呈现 16:9 无裁切封面、标题、简介与齐平播放按钮。",
    "title": "修复视频区 3 列卡片高度塌陷重叠问题",
    "content_markdown": "本次微调修复了视频区 3 列网格在自动行高下子项设置 100% 高度导致的纵向行重叠问题：\n\n1. 将视频卡片高度恢复为自动自适应，同时保留行内等高对齐与底部播放按钮自动贴底，确保每张视频卡片的 16:9 完整封面、高亮标题、简介、作者日期及底部播放按钮清晰分离、绝不重叠。\n2. 同步保留桌面与移动端全窗口统一居中尺寸、暗色点阵加载态、登录浮层正居中及全部游戏与工具内页的深夜池塘视觉风格。"
  },
  "en": {
    "summary": "Changed video card height from 100% to auto inside the auto-sized 3-column grid so 16:9 thumbnails, titles, descriptions, and aligned Play buttons never overlap vertically.",
    "title": "Fixed 3-Column Video Card Row Collapse in CSS Grid",
    "content_markdown": "This one-line layout fix resolves the CSS Grid row collapse on Videos:\n\n1. Switched video cards to natural auto height while retaining stretch alignment, ensuring every card's uncropped 16:9 thumbnail, title, summary, and bottom Play button render cleanly without vertical overlap.\n2. Preserved all unified Midnight Pond window dimensions, dark CRT loading states, and inner tool/game page styling."
  },
  "ja": {
    "summary": "CSS Grid の自動行高における動画カードの height を 100% から auto へ修正し、16:9 表紙・タイトル・概要・再生ボタンの縦重なりを完全に解消しました。",
    "title": "動画区 3 列カードの縦重なりを修正",
    "content_markdown": "動画区 3 列グリッドの行高計算と表示崩れを修正しました：\n\n1. 動画カードの高さを自動調整へ戻し、行内の高さ揃えと下部再生ボタンの配置を維持することで、16:9 の無裁切サムネイル・高コントラストなタイトル・概要・作者日時・下部再生ボタンが重ならず整然と表示されるようにしました。\n2. 全ウィンドウの中央配置統一・暗色 CRT ロード表示・ログイン窓の中央表示およびツール・ゲーム内ページの深夜の池スタイルもあわせて維持しています。"
  }
}, "2026-11-22T04:32:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos-16x9', '2026-11-22-pond-videos-16x9', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:23:00+08:00', '2026-11-22T04:23:00+08:00', '2026-11-22T04:23:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos-16x9", {
  "zh": {
    "summary": "将视频区恢复为 3 列网格并保持标准 16:9 封面比例，消除 2 列高封面挤出文字区的问题，实现封面无裁切且标题、简介与播放按钮完整对齐。",
    "title": "恢复视频区 3 列标准 16:9 封面排布并确保标题与播放按钮完整呈现",
    "content_markdown": "本次更新针对视频区实测结果完成最终排布校正：\n\n1. 将视频列表恢复为 3 列网格（每张封面自然呈 16:9 比例，约 308×173px），16:9 的 Bilibili 与 YouTube 封面满框显示不裁字也不留黑边。\n2. 放开 .video-card 与 .video-body 的 overflow: visible 与自适应高度，确保标题、简介、作者时间与底部「播放」按钮全部清晰完整且每行齐平。"
  },
  "en": {
    "summary": "Switched Videos back to a 3-column grid with true 16:9 thumbnails and unclipped card bodies so covers, titles, descriptions, and Play buttons all render cleanly.",
    "title": "Restored 3-Column True 16:9 Video Grid with Unclipped Titles & Aligned Play Buttons",
    "content_markdown": "This quick layout correction resolves the Videos card overflow seen in live verification:\n\n1. Restored the 3-column grid so 16:9 thumbnails render at natural proportions without cropping cover text.\n2. Set .video-card and .video-body to natural unclipped height with aligned bottom Play buttons."
  },
  "ja": {
    "summary": "動画区を 3 列グリッドの標準 16:9 サムネイルへ戻し、カードの切り抜きを解除して表紙・タイトル・概要・再生ボタンをすべて見切れなく整列させました。",
    "title": "動画区 3 列 16:9 レイアウト復元・タイトルと再生ボタン完全表示",
    "content_markdown": "動画区の実機確認に基づき、レイアウトを最終調整しました：\n\n1. 3 列グリッド＋標準 16:9 比率に戻すことで、Bilibili・YouTube サムネイルが文字切れや余白なしで自然に収まるようにしました。\n2. .video-card と .video-body の高さ制約を解除し、タイトル・概要・下部再生ボタンを全カード揃えて表示します。"
  }
}, "2026-11-22T04:23:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-final-finish', '2026-11-22-pond-final-finish', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:15:00+08:00', '2026-11-22T04:15:00+08:00', '2026-11-22T04:15:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-final-finish", {
  "zh": {
    "summary": "恢复视频 16:9 完整封面比例消除裁切、消除聊天室右上房间标签叠字、提亮猫国封面并升级 Hextris 霓虹六边形封面、优化知识库 3 排显示与手机端 Dock 底部留白。",
    "title": "深夜池塘最终细节收尾：视频 16:9 完整封面、聊天室防叠字、游戏封面与手机端留白",
    "content_markdown": "本次收尾完成了最后一轮线上实拍图逐项细化：\n\n1. 视频区：将缩略图容器恢复为完整 16:9 比例并采用 object-fit: contain，封面文字与人像零裁切。\n2. 聊天室：修复右上「普通房间」胶囊与「每 5 秒自动刷新」文案叠字，并加宽顶沿渐隐遮罩消除残影轮廓。\n3. 游戏区：提亮猫国建设者等暗色封面使猫咪轮廓清晰可见，升级 Hextris 封面为六色霓虹六边形点阵，收紧语言胶囊间距防止断行。\n4. 知识库与手机端：微调桌面卡片内边距并加底部渐隐使 3 排文章完整落框；手机端列表底部增加 96px 内边距，避让悬浮 Dock。"
  },
  "en": {
    "summary": "Restored 16:9 uncropped video thumbnails, fixed the chatroom room-label overlap, brightened Kittens Game cover and upgraded Hextris art, and refined Knowledge & mobile Dock bottom spacing.",
    "title": "Midnight Pond Final Visual Finish: 16:9 Uncropped Video Covers, Chatroom Spacing, Bright Game Art & Mobile Dock Clearance",
    "content_markdown": "This final visual polish pass resolves the last fine details from live review:\n\n1. Videos: restored natural 16:9 thumbnail aspect ratio with object-fit: contain so cover text and portraits are never cropped.\n2. Chatroom: eliminated overlap between #chat-room-label and #chat-sync-status and refined the top scroll fade.\n3. Games: brightened dark art covers (Kittens Game), upgraded the Hextris neon hexagon SVG cover, and tightened language tag spacing.\n4. Knowledge & Mobile: tuned 3-row card spacing with a soft bottom fade and added 96px bottom padding on mobile Knowledge for Dock clearance."
  },
  "ja": {
    "summary": "動画サムネイルを 16:9 比率へ戻して見切れを解消し、チャット右上の文字重なり修正、猫国表紙の明度向上と Hextris 表紙刷新、知識庫とモバイル Dock 下部余白を整えました。",
    "title": "深夜の池最終ディテール仕上げ：動画 16:9 表紙・チャット重なり解消・ゲーム表紙・モバイル余白",
    "content_markdown": "本番スクリーンショットの最終確認に基づき、残りの細部を仕上げました：\n\n1. 動画区：サムネイルを 16:9 比率＋object-fit: contain へ調整し、表紙の文字や人物の見切れを解消しました。\n2. チャット：右上の部屋ラベルと更新表示の重なりを修正し、上端フェードを整えました。\n3. ゲーム区：猫国建設者の表紙を明るく調整し、Hextris を多色ネオン六角形 SVG へ刷新、言語タグの間隔を整えました。\n4. 知識庫・モバイル：3行がすっきり収まる余白と下端フェードを加え、モバイル下部 Dock 用の 96px 余白を確保しました。"
  }
}, "2026-11-22T04:15:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-cascade-root', '2026-11-22-pond-cascade-root', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T04:01:00+08:00', '2026-11-22T04:01:00+08:00', '2026-11-22T04:01:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-cascade-root", {
  "zh": {
    "summary": "在桥接层监听 document.head 并将 pond-windows.css 固定维持为最后一个样式表，从根源解决 main.js 懒加载 routes/*.css 与 transfer.css 覆盖新视觉层的问题，并直接删除视频封面中央播放覆盖层规则。",
    "title": "根治路由样式后插层叠顺序问题并彻底移除视频封面中央播放覆盖层",
    "content_markdown": "本次从架构根源解决了生产环境中懒加载路由样式反向覆盖新视觉层的问题：\n\n1. js/main.js 会在切换路由时向 document.head 尾部动态追加 /css/routes/knowledge.css、/css/routes/videos.css、/css/routes/games.css、/css/routes/chatroom.css 与 /css/transfer.css，导致其层叠顺序排在 pond-windows.css 之后。现于 pond-site-bridge.mjs 增加 MutationObserver，确保 pond-windows.css 始终稳居 <head> 最末位。\n2. 直接从 pond-windows.css 源头删除旧版 .video-thumb::after 封面中央播放框，不再靠二次覆盖压制，确保视频封面文字零遮挡且标题与简介高对比完整呈现。"
  },
  "en": {
    "summary": "Pinned pond-windows.css as the final stylesheet in document.head whenever main.js lazily injects route CSS or transfer.css, and deleted the source center video-thumb play overlay.",
    "title": "Root Fix for Lazy Route CSS Cascade Order & Removed Center Video Play Overlay",
    "content_markdown": "This release eliminates the root CSS cascade race between Midnight Pond and lazily injected route stylesheets:\n\n1. Added a document.head MutationObserver in pond-site-bridge.mjs that keeps pond-windows.css as the last stylesheet whenever main.js appends /css/routes/*.css or /css/transfer.css, guaranteeing deterministic visual precedence in production.\n2. Deleted the legacy .video-thumb::after center play overlay directly at its source so video thumbnails stay unobstructed."
  },
  "ja": {
    "summary": "main.js がルート専用 CSS や transfer.css を後から <head> 末尾へ追加しても pond-windows.css が常に最後尾に維持されるよう修正し、動画サムネイル中央の再生枠定義を元から削除しました。",
    "title": "遅延読み込みルート CSS のカスケード順を根本修正・動画中央再生枠を削除",
    "content_markdown": "本番環境で遅延読み込みされるルート CSS が新テーマを上書きする根本原因を解消しました：\n\n1. js/main.js が遷移時に /css/routes/*.css や /css/transfer.css を document.head 末尾へ挿入する際、pond-site-bridge.mjs の MutationObserver が pond-windows.css を常に最後尾へ維持することで、カスケード優先順を完全に保証します。\n2. 動画サムネイル中央に重なっていた .video-thumb::after を元定義から削除し、タイトル・概要の視認性と表紙文字の見やすさを確保しました。"
  }
}, "2026-11-22T04:01:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-eager-covers', '2026-11-22-pond-eager-covers', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:59:00+08:00', '2026-11-22T03:59:00+08:00', '2026-11-22T03:59:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-eager-covers", {
  "zh": {
    "summary": "在游戏区封面换装、工具区图标与关于页激活时强制切换图片为 eager 即时加载，彻底解决切换路由后封面与头像偶发黑框未解码的问题。",
    "title": "修复游戏区封面与关于页头像在窗口切换时懒加载停滞的问题",
    "content_markdown": "本次修复了线上实测中发现的图片懒加载停滞问题：\n\n1. 在游戏区应用 GPT 封面与 SVG 封面时，先移除 loading='lazy' 并设为 eager 同步解码，确保猫国建设者、小黑屋、人生重开模拟器等 5 张封面即时显示不留黑框。\n2. 工具区图标与关于页头像及社交图标同步改为立即加载，切换窗口后立即可见。"
  },
  "en": {
    "summary": "Forced eager loading on game covers, tool icons, and the About avatar when activating those windows so covers and avatars never stall as blank frames.",
    "title": "Fixed Lazy-Image Stall on Game Covers & About Avatar After Route Switch",
    "content_markdown": "This fix resolves a Chromium lazy-loading stall discovered during live verification:\n\n1. Removed loading='lazy' and enforced loading='eager' before applying game covers so Kittens Game, A Dark Room, Life Restart, 2048, and Hextris render immediately.\n2. Applied the same eager-load guard to tool icons and the About avatar/social icons on window activation."
  },
  "ja": {
    "summary": "ゲーム表紙・ツールアイコン・概要アバターのウィンドウ表示時に即時読み込み（eager）を強制し、黒い空枠のまま止まる現象を解消しました。",
    "title": "ゲーム表紙・概要アバターのルート切替時遅延読み込み停滞を修正",
    "content_markdown": "本番検証で見つかった画像遅延読み込みの停滞を修正しました：\n\n1. ゲーム表紙（猫国建設者・小黑屋・人生重開シミュレーター等）に loading='eager' を強制し、黒い空枠にならず即座に表示されるようにしました。\n2. ツールアイコンおよび概要ページのアバター画像も表示時に即時読み込みへ統一しました。"
  }
}, "2026-11-22T03:59:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-icons-close-sync', '2026-11-22-pond-icons-close-sync', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:54:00+08:00', '2026-11-22T03:54:00+08:00', '2026-11-22T03:54:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-icons-close-sync", {
  "zh": {
    "summary": "将登录浮层右上角关闭按钮统一为圆形虚线 × 控件、重绘知识库与文章标题栏翻书图标消除方块观感，并为聊天室滚动区增加顶沿渐隐过渡。",
    "title": "统一登录窗关闭按钮、优化知识库翻书图标与聊天室顶沿柔化",
    "content_markdown": "本次更新完成了复审提出的最后三处界面细节统一：\n\n1. 将登录浮层 .account-close-button 由旧红底实心方块改为与其他窗口一致的圆形虚线 × 按钮。\n2. 重绘知识库与文章页标题栏 .title-icon-knowledge 为清晰的翻开书本与点阵页纹 SVG，彻底消除小字号下的方块错觉。\n3. 为聊天室消息滚动区顶部增加 22px 柔和渐隐遮罩，滚动时顶沿消息自然过渡不生硬裁切。"
  },
  "en": {
    "summary": "Matched the login modal close button to the circular dashed x style, redrew the Knowledge/Article open-book title icon for crispness, and added a soft top-edge scroll fade to the Chatroom log.",
    "title": "Unified Login Close Button, Crisp Open-Book Title Icon & Chatroom Top Fade",
    "content_markdown": "This quick polish closes the final three visual details from review:\n\n1. Restyled .account-close-button in the login popover into the circular dashed x button used by all other windows.\n2. Redrew .title-icon-knowledge as a crisp open-book SVG with dotted page lines so it never looks like two empty squares.\n3. Added a soft 22px top-edge fade mask to .chatroom-log so scrolled-past messages dissolve cleanly."
  },
  "ja": {
    "summary": "ログイン窓右上の閉じるボタンを他窓と同じ点線丸 × へ統一し、知識庫と記事タイトルの本アイコンを鮮明な見開き SVG へ刷新、チャット上端に自然なフェードマスクを追加しました。",
    "title": "ログイン閉じるボタン統一・知識庫アイコン刷新・チャット上端フェード追加",
    "content_markdown": "最終レビューに基づく 3 点の細部調整を反映しました：\n\n1. ログイン窓の .account-close-button を赤い四角ボタンから他ウィンドウと共通の点線丸 × ボタンへ統一しました。\n2. 知識庫・記事タイトルの .title-icon-knowledge を鮮明な見開き本 SVG へ差し替えました。\n3. チャットログ上端に 22px のフェードマスクを加え、スクロール時の見切れを和らげました。"
  }
}, "2026-11-22T03:54:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-home-shell-clear', '2026-11-22-pond-home-shell-clear', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:42:00+08:00', '2026-11-22T03:42:00+08:00', '2026-11-22T03:42:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-home-shell-clear", {
  "zh": {
    "summary": "将首页 .site-shell 及其伪元素背景设为完全透明，确保首页 WebGL2 深夜池塘画布与登录浮层同时完整呈现，并同步将「显示密码」按钮统一为暗色点阵胶囊。",
    "title": "修复首页容器背景透明透出池塘画布并统一显示密码按钮",
    "content_markdown": "本次微调完成了首页池塘与登录浮层的最终融合：\n\n1. 将 html[data-pond-mode='home'] 下的 .site-shell、伪元素及 .page-home 背景全部设为透明，使 WebGL2 池塘桌面完整透出，同时登录窗稳居最顶层正中央。\n2. 将登录框内的「显示密码」按钮同步改为深色 CRT 点阵虚线胶囊样式，消除最后的浅色按钮残留。"
  },
  "en": {
    "summary": "Made .site-shell and its pseudo-elements transparent on Home so the WebGL2 pond canvas renders beneath the centered login modal, and styled the Show Password button in dark CRT glass.",
    "title": "Transparent Home Shell Pass-Through for Pond Canvas & Dark Password Toggle",
    "content_markdown": "This quick polish completes the Home pond and login overlay composition:\n\n1. Cleared .site-shell, its pseudo-elements, and .page-home backgrounds on Home so the live WebGL2 pond canvas shows cleanly behind the centered login popover.\n2. Styled the Show Password button inside the login popover as a matching dark CRT dotted pill."
  },
  "ja": {
    "summary": "ホーム画面の .site-shell と疑似要素の背景を完全透過にして WebGL2 の池キャンバスがログイン窓の背後にそのまま表示されるよう修正し、パスワード表示ボタンも暗色点陣スタイルへ統一しました。",
    "title": "ホーム画面の透過調整（池キャンバス表示維持）とパスワード表示ボタン暗色化",
    "content_markdown": "ホーム画面とログイン窓の重なり表示を最終仕上げしました：\n\n1. ホーム画面における .site-shell および疑似要素・.page-home の背景を透明化し、WebGL2 池キャンバスを隠さず中央のログイン窓を最前面に表示できるようにしました。\n2. ログイン窓内の「パスワードを表示」ボタンも暗色 CRT 点陣カプセルへ統一しました。"
  }
}, "2026-11-22T03:42:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-home-login-z', '2026-11-22-pond-home-login-z', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:38:00+08:00', '2026-11-22T03:38:00+08:00', '2026-11-22T03:38:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-home-login-z", {
  "zh": {
    "summary": "调整首页 .site-shell 与池塘背景画布的层级顺序，确保点击左下角 ID 后登录窗直接浮在首页最顶层，同时将登录框内标签页、密码框与底部提示盒统一为暗色 CRT 风格。",
    "title": "修复首页登录浮层被画布压住的问题并统一登录框暗色点阵控件",
    "content_markdown": "本次紧急修复彻底解决了首页点击左下角 ID 按钮后登录浮层不可见的问题：\n\n1. 将首页 #pond-visual-backdrop 层级置于 .site-shell（pointer-events: none）之下，使点击仍可直达池塘画布，而打开的 #account-popover 直接浮现在首页池塘最顶层正中央。\n2. 将登录框内的登录/注册切换条、密码输入框、显示密码按钮、关闭按钮及底部说明条全部统一为深夜池塘暗色玻璃与点阵虚线样式，彻底消除浅色残留。"
  },
  "en": {
    "summary": "Placed .site-shell above the Home pond canvas while preserving pointer passthrough so the login modal renders cleanly on top of Home, and themed the login tabs, password input, and footer note.",
    "title": "Fixed Home Login Popover Z-Index Stacking & Darkened Inner Login Controls",
    "content_markdown": "This targeted fix resolves the Home-route login popover stacking order:\n\n1. Lowered #pond-visual-backdrop below .site-shell (pointer-events: none) on Home so canvas clicks still pass through while #account-popover renders cleanly on top of the Home pond.\n2. Styled the login/register mode tabs, password field, close button, and footer note box in matching Midnight Pond CRT dark glass."
  },
  "ja": {
    "summary": "ホーム画面で池キャンバスがログイン窓を覆っていた重なり順を修正し、左下 ID クリック時に画面最前面中央へ確実に表示されるようにしました。タブ・パスワード欄・注記も暗色化しています。",
    "title": "ホーム画面ログイン窓の重なり順修正と内部コントロール暗色統一",
    "content_markdown": "ホーム画面で左下 ID ボタンからログイン窓を開いた際の重なり順を修正しました：\n\n1. ホーム画面の #pond-visual-backdrop を .site-shell（pointer-events: none）の下層へ配置し、池キャンバスの操作性を保ちつつ #account-popover が画面中央最前面に正しく描画されるようにしました。\n2. ログイン窓内部のタブ切替・パスワード入力欄・閉じるボタン・下部注記ボックスも深夜の池 CRT 暗色ガラスへ統一しました。"
  }
}, "2026-11-22T03:38:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-qa-sweep', '2026-11-22-pond-qa-sweep', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:31:00+08:00', '2026-11-22T03:31:00+08:00', '2026-11-22T03:31:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-qa-sweep", {
  "zh": {
    "summary": "按全站桌面端逐窗验收清单完成精修：视频高对比标题简介与去遮挡播放徽标、工具/游戏去空白、知识库同行等高齐平、聊天室单行顶栏、关于点阵标题图标、左下语言提亮与临时互传暗色换装。",
    "title": "深夜池塘全站桌面端细节精修：视频高对比文字、工具/游戏卡片紧致、聊天室与临时互传换装",
    "content_markdown": "本次更新针对线上桌面端全窗口逐项验收清单完成集中精修：\n\n1. 视频区：全面提亮卡片标题与简介对比度，移除遮挡封面的中央播放覆盖层，保持每行底部播放按钮齐平，并统一暗色点阵加载态。\n2. 工具与游戏区：取消卡片内容区被窗高拉开的空白空洞，恢复自然紧致排布与底部留白，优化游戏区语言胶囊间距避免拥挤。\n3. 知识库与文章页：同行文章卡片统一等高并对齐右侧点阵「阅读」按钮；放宽文章阅读进度字号与右侧边距，保证左侧目录底部提示完整不裁切并清除残留 emoji 图标。\n4. 聊天室、关于页与首页：聊天室顶栏改为单行不换行、修复首条消息顶沿裁切；关于页标题替换为点阵人像图标；首页左下角 ID 与中/EN/日切换文字显著提亮。\n5. 临时互传子面板（#transfer-app）：全量适配深夜池塘 CRT 深色玻璃风格与暗青加载条。"
  },
  "en": {
    "summary": "Resolved every desktop QA checklist item across Videos, Tools, Games, Knowledge, Article Reader, Chatroom, About, Home corner contrast, and the Quick Transfer sub-panel.",
    "title": "Midnight Pond Full Desktop QA Sweep: Bright Video Copy, Compact Tool/Game Cards, Chatroom & Quick Transfer Skin",
    "content_markdown": "This release closes the full desktop live-QA sweep across every window:\n\n1. Videos: enforced high-contrast cyan-white titles and descriptions, removed center thumbnail play overlays, aligned row Play buttons, and unified dark CRT loading states.\n2. Tools & Games: eliminated vertical stretching gaps inside cards, restored comfortable bottom padding, and prevented crowded language tags.\n3. Knowledge & Article Reader: equalized row card heights so Read buttons align across columns, enlarged reading progress labels, prevented TOC tip bottom clipping, and stripped legacy emoji prefixes.\n4. Chatroom, About & Home: kept the Chatroom header on one row and unclipped the first message, replaced the About title badge with a dotted CRT person icon, and boosted bottom-left ID/language contrast.\n5. Quick Transfer (#transfer-app): applied full Midnight Pond CRT dark glass styling."
  },
  "ja": {
    "summary": "デスクトップ全窓の実機チェック項目を一括修正：動画カード文字の高コントラスト化とサムネイル中央アイコン除去、ツール／ゲーム余白整理、知識庫行揃え、チャット単行ヘッダ、一時転送の暗色対応を完了しました。",
    "title": "深夜の池デスクトップ全窓品質総仕上げ：動画文字視認性・ツール／ゲーム配置・チャット・一時転送対応",
    "content_markdown": "本番デスクトップ全窓の総点検に基づき、以下の項目を一括で仕上げました：\n\n1. 動画区：カードタイトルと概要のコントラストを大幅に引き上げ、サムネイル中央の再生オーバーレイを非表示にして下部再生ボタンを揃えました。\n2. ツール・ゲーム区：カード内部の不自然な縦余白を解消し、タグの詰まりと下部余白を整えました。\n3. 知識庫・記事閲覧：同行カードの高さを統一して閲覧ボタン位置を揃え、進捗表示と目次下部の見切れおよび残存絵文字を整理しました。\n4. チャット・概要・ホーム：チャット上部を1行に収め先頭メッセージの見切れを解消、概要タイトルを点陣アイコン化し、左下 ID／言語表示のコントラストを高めました。\n5. 一時転送サブパネル（#transfer-app）も深夜の池 CRT 暗色ガラスへ統一しました。"
  }
}, "2026-11-22T03:31:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-final-fit', '2026-11-22-pond-final-fit', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:28:00+08:00', '2026-11-22T03:28:00+08:00', '2026-11-22T03:28:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-final-fit", {
  "zh": {
    "summary": "解除顶栏层叠上下文使登录浮层正居中于视口、恢复视频卡片标题与简介完整高度，并将知识库加载骨架条切换为柔和深青点阵色。",
    "title": "深夜池塘最终实测收尾：登录窗正居中、视频卡片完整展示与暗色骨架屏",
    "content_markdown": "基于线上真机实测结果完成最后三处细节收尾：\n\n1. 清除顶栏容器的滤镜与变换层叠上下文，确保点击左下角 ID 后登录浮层精确居中显示在屏幕正中央。\n2. 放开视频卡片自然高度并保留每行底部播放按钮齐平，确保标题与简介完整清晰不被压缩。\n3. 覆盖知识库骨架屏的多层浅色背景渐变，改为低对比度深青荧光骨架条。"
  },
  "en": {
    "summary": "Removed header containing-block traps so the login modal centers in the viewport, restored full video card title/description height, and switched Knowledge loading skeletons to soft dark cyan bars.",
    "title": "Midnight Pond Final Live-QA Polish: Viewport-Centered Login, Full Video Cards & Dark Skeletons",
    "content_markdown": "This final polish pass closes the last three live-QA visual details:\n\n1. Cleared ancestor backdrop/transform containing blocks on the hidden topbar so clicking bottom-left ID centers the login popover squarely in the viewport.\n2. Restored natural video card height while keeping row Play buttons aligned at the bottom.\n3. Replaced the multi-layer light Knowledge skeleton gradients with subtle dark-cyan CRT skeleton bars."
  },
  "ja": {
    "summary": "隠しヘッダーの包含ブロックを解除してログイン窓を画面中央へ配置し、動画カードのタイトルと概要の高さを復元、知識庫ロード時の白スケルトンを暗色シアンへ統一しました。",
    "title": "深夜の池最終実機調整：ログイン窓中央配置・動画カード全文表示・暗色スケルトン",
    "content_markdown": "本番環境の実機スクリーンショット検証に基づき、最後の 3 点を仕上げました：\n\n1. 非表示ヘッダー側のフィルタ・変換指定を解除し、左下 ID クリック時にログイン窓が画面中央へ正しく表示されるようにしました。\n2. 動画カードの自然な高さを確保し、タイトルと概要が潰れずに表示され、再生ボタンが各行下部で揃うようにしました。\n3. 知識庫読み込み中の白いスケルトン帯を、深緑背景になじむ低コントラストな暗色シアン帯へ置き換えました。"
  }
}, "2026-11-22T03:28:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-geometry-sync', '2026-11-22-pond-geometry-sync', 'site-updates', '["site-update","ui"]', '', 'published', 0, 0, '2026-11-22T03:22:00+08:00', '2026-11-22T03:22:00+08:00', '2026-11-22T03:22:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-geometry-sync", {
  "zh": {
    "summary": "将全部桌面窗口像素级对齐至文章阅读窗居中位置（避开顶部时钟）、扩大左下角 ID 按钮热区并彻底替换所有加载态深蓝字与旧图标。",
    "title": "深夜池塘全窗像素级对齐、左下角 ID 点击热区扩大与加载态图标统一",
    "content_markdown": "本次更新完成了线上实测后的最后一轮微调：\n\n1. 将知识库、文章阅读、视频、工具、游戏、聊天室、关于与欢迎窗统一至完全一致的居中宽高与顶距，切窗零跳位且不遮挡顶部时钟。\n2. 扩大左下角 ID（登录）与语言按钮在 CRT 曲面下的点击热区，点击更稳。\n3. 提高全站加载态文字与图标覆盖优先级，视频区等加载提示全部切换为高对比度青白字与点阵发光图标。"
  },
  "en": {
    "summary": "Aligned every desktop window to the exact Article Reader centered frame below the top clock, widened the bottom-left ID hitbox for CRT curvature, and enforced high-contrast loading text and dotted icons.",
    "title": "Midnight Pond Pixel-Identical Window Geometry, Wider ID Hitbox & Loading State Icon Sync",
    "content_markdown": "This follow-up polish pass resolves the final live-QA items:\n\n1. Aligned Knowledge, Article Reader, Videos, Tools, Games, Chatroom, About, and Welcome to the exact same centered box below the top clock.\n2. Widened the bottom-left ID and language hitboxes to account for CRT barrel curvature.\n3. Enforced high-contrast cyan-white text and dotted phosphor emblems across all loading/empty/error states."
  },
  "ja": {
    "summary": "全デスクトップ窓を記事閲覧窓と完全同一の中央サイズへ統一し、CRT曲率に合わせて左下IDボタンのクリック判定を拡大、ロード文言とアイコンを点陣スタイルへ統一しました。",
    "title": "深夜の池ウィンドウ寸法完全統一・左下ID判定拡大・ロード表示アイコン統一",
    "content_markdown": "本番環境での実機検証に基づき、以下の最終微調整を行いました：\n\n1. 知識庫・記事閲覧・動画・ツール・ゲーム・チャット・概要・ようこそ窓のすべてを記事閲覧窓と完全に同一の中央サイズおよび配置へ統一し、切り替え時の位置ズレや上部時計との重なりを解消しました。\n2. CRT 曲率による端のズレを考慮し、左下 ID（ログイン）ボタンと言語切り替えボタンのクリック判定領域を広げ、確実に開けるよう改善しました。\n3. 動画区を含む全ウィンドウの読み込み中・空状態・エラー表示の文字色とアイコンを、高コントラストな青白文字および点陣発光アイコンへ統一しました。"
  }
}, "2026-11-22T03:22:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-visual-polish', '2026-11-22-pond-visual-polish', 'site-updates', '["site-update","ui","games"]', '', 'published', 0, 0, '2026-11-22T03:10:00+08:00', '2026-11-22T03:10:00+08:00', '2026-11-22T03:10:00+08:00') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-visual-polish", {
  "zh": {
    "summary": "修复左下角 ID 登录窗触发、重构两段式可打断季节粒子汇聚过渡、首屏直出零闪烁、统一全站居中窗口几何与加载态，并同步适配五个小游戏内页。",
    "title": "深夜池塘视觉与交互综合修复：登录触发、季节粒子汇聚过渡、全窗统一与游戏内页换装",
    "content_markdown": "本次更新完成了全站深夜池塘 CRT 视觉与交互的集中修复：\n\n1. 修复桌面左下角 ID（登录）按钮点击无反应与浮层被隐藏的问题，点击可正常打开居中登录窗并输入登录。\n2. 重构四季/时段切换过渡：先起明亮星尘汇聚动效，到位后水面与植物平滑切入，且支持中途随时打断无缝接续。\n3. 在首屏同步写入主题与关键保护样式，冷加载不再闪现旧桌面，并移除桌面端旧壁纸预加载。\n4. 统一全部桌面窗口到文章阅读窗的居中尺寸与位置，修复文章左侧目录重叠、知识库与各窗口点阵幽灵按钮、视频卡片对齐、全站暗色加载骨架与点阵状态图标，以及移动端知识库横向溢出。\n5. 五个小游戏内页（猫国建设者、小黑屋、2048、Hextris、人生重开模拟器）同步换装深夜池塘 CRT 风格，存档与 AI 接管逻辑保持原样。"
  },
  "en": {
    "summary": "Fixed the bottom-left ID login popover trigger, rebuilt interruptible two-stage season particle transitions, eliminated cold-load legacy flash, unified centered window geometry and dark loading states, and themed all five game inner pages.",
    "title": "Midnight Pond Visual & Interaction Polish: Login Popover, Staged Season Vortex, Unified Windows & Game Inner Pages",
    "content_markdown": "This release delivers a comprehensive Midnight Pond CRT polish pass:\n\n1. Fixed the bottom-left ID button trigger and popover visibility so the login modal opens reliably and accepts input.\n2. Rebuilt season transitions into a two-stage interruptible particle vortex: stardust gathers first while holding the current scene, then smoothly reveals the target season without snapping or queueing on rapid clicks.\n3. Added synchronous first-paint mode detection and removed legacy desktop wallpaper preloading to prevent any legacy desktop flash on cold load.\n4. Unified all desktop windows to the Article Reader centered geometry, fixed TOC item overlap, restyled primary CTA buttons as compact dotted CRT ghost pills, aligned video card layouts, unified dark CRT loading/skeleton states, and fixed mobile Knowledge overflow.\n5. Applied the Midnight Pond CRT theme to all five game inner pages while keeping game logic, saves, and AI takeover untouched."
  },
  "ja": {
    "summary": "左下のIDログイン窓修正、割り込み可能な二段階季節粒子演出、初回描画の旧画面チラつき解消、全ウィンドウ中央サイズ統一と暗色ロード状態、5つのゲーム内ページ刷新を実施しました。",
    "title": "深夜の池ビジュアル＆操作総合修正：ログイン窓・季節粒子演出・全窓統一・ゲーム内ページ刷新",
    "content_markdown": "今回のアップデートでは深夜の池 CRT スタイルの総合修正を行いました：\n\n1. 左下のIDボタンからログイン窓が確実に開き入力できるよう修正しました。\n2. 季節切替を「粒子収束→背景遷移」の二段階かつ途中割り込み可能な演出へ再構築しました。\n3. 初期描画ガードを追加し、初回読み込み時の旧デスクトップ一瞬表示を解消しました。\n4. 全ウィンドウを記事閲覧窓の中央サイズへ統一し、目次重なり・ボタン・動画カード整列・暗色ローディング表示・モバイル知識庫の横溢れを修正しました。\n5. 5つのゲーム内ページも深夜の池 CRT テーマへ統一しました。"
  }
}, "2026-11-22T03:10:00+08:00"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-chat-mobile-polish', '2026-11-22-pond-chat-mobile-polish', 'site-updates', '["网站更新","修复记录","聊天室","移动端","界面"]', '', 'published', 0, 0, '2026-11-21T18:51:00.000Z', '2026-11-21T18:51:00.000Z', '2026-11-21T18:51:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-chat-mobile-polish", {
  "zh": {
    "title": "聊天室紧凑气泡、移动端防溢出与同日 D1 迁移收尾",
    "summary": "补齐 02:31 线上收尾记录并同步完成精修：聊天室消息改为紧凑点阵气泡并放大提亮 6 枚点阵圆形 SVG 头像；移动端知识库全链路钳制宽度消除横向溢出并统一深色标签与阅读按钮；同步登记同日 D1 种子迁移前序版本。",
    "content_markdown": "# 聊天室紧凑气泡、移动端防溢出与同日 D1 迁移收尾\n\n本次更新补齐 02:31 线上收尾热修记录，并完成聊天室与移动端实机复审发现的细节修复。\n\n- 聊天室移除外层整行虚线框，改为紧贴文字的紧凑 CRT 玻璃气泡，隐藏重复旧头像，将 6 枚点阵圆形 SVG 默认头像放大至 42px 并提亮。\n- 移动端知识库对 `html / body / .site-shell / .page / .xp-window / .article-card` 全面钳制最大宽度并开启自然断行，消除右侧截断，同时将卡片标签与「阅读」按钮换装深色 CRT 风格。\n- 登记同日 D1 迁移前序版本，保障 `/api/articles` 稳定 `HTTP 200`。"
  },
  "en": {
    "title": "Compact CRT Chat Bubbles, Mobile Overflow Fix, and Same-Day D1 Migration Record",
    "summary": "Completes the release record and final polish: compact fit-content CRT chat bubbles with larger brighter dot-matrix SVG avatars, full mobile width clamping with dark tag/button styling to eliminate horizontal overflow, and same-day D1 migration compatibility.",
    "content_markdown": "# Compact CRT Chat Bubbles, Mobile Overflow Fix, and Same-Day D1 Migration Record\n\nThis release records the 02:31 live hotfix and resolves the remaining chatroom and mobile visual findings.\n\n- Switched chatroom rows to compact fit-content CRT glass bubbles and enlarged/brightened the 6 circular dot-matrix SVG avatars to 42px.\n- Clamped mobile shell, page, window, and card widths with word-wrapping and dark CRT tags/buttons to eliminate horizontal clipping.\n- Registered same-day D1 seed predecessors to keep `/api/articles` returning `HTTP 200`."
  },
  "ja": {
    "title": "チャット吹き出し最適化・モバイル横はみ出し解消・D1移行記録",
    "summary": "02:31修正の更新記録と最終調整を反映しました。チャットのコンパクト吹き出し化と42pxドットアバター発光、モバイル知識庫の横はみ出し解消と濃色タグ/ボタン化、同日D1移行互換を完了しています。",
    "content_markdown": "# チャット吹き出し最適化・モバイル横はみ出し解消・D1移行記録\n\n02:31の本番修正記録とチャット・モバイルの最終調整を反映しました。\n\n- チャット行をテキスト幅に沿うコンパクトなCRTガラス吹き出しへ変更し、6種の円形ドットSVGアバターを42pxで明るく表示しました。\n- モバイル知識庫の全階層幅を制御して横はみ出しを解消し、タグと「読む」ボタンも濃色CRTへ統一しました。"
  }
}, "2026-11-21T18:51:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-live-fix', '2026-11-22-pond-live-fix', 'site-updates', '["网站更新","修复记录","移动端","界面"]', '', 'published', 0, 0, '2026-11-21T18:22:00.000Z', '2026-11-21T18:22:00.000Z', '2026-11-21T18:22:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-live-fix", {
  "zh": {
    "title": "修复生产环境池塘视觉桥接加载与手机端/欢迎窗/关于页样式",
    "summary": "修复线上 dist 生产构建中 season-schedule.mjs 引用未单独导出的 /js/core/wallpaper-time.mjs 导致桥接脚本未执行的问题，并同步修复手机端知识库白底与横向溢出、欢迎窗文字对比度与 Esc 提示、关于页暗色社交图标。",
    "content_markdown": "# 修复生产环境池塘视觉桥接加载与手机端/欢迎窗/关于页样式\n\n本次热修解决线上实测发现的视觉层未生效及 4 处细节问题，全部功能与数据保持原样。\n\n- 将时段切换纯函数内联进 `js/pond-crt/season-schedule.mjs`，彻底消除生产环境对 `/js/core/wallpaper-time.mjs` 的跨目录导入失败。\n- 补全手机端内层搜索栏、分类行、列表、空状态与按钮的深色 CRT 玻璃换装并修复横向溢出。\n- 提升欢迎窗左栏文字与更新列表对比度，补充底部三语 `Esc 关闭此窗口` 提示。\n- 反色提亮关于页深色 X / GitHub 图标与状态提示框。"
  },
  "en": {
    "title": "Fix Production Pond Bridge Module Import and Mobile / Welcome / About Visual Polish",
    "summary": "Inlined the time-based wallpaper schedule helpers into season-schedule.mjs so production dist/ loads the Pond CRT bridge cleanly, and fixed mobile inner dark-glass surfaces & overflow, Welcome text contrast & Esc hint, and About social icon contrast.",
    "content_markdown": "# Fix Production Pond Bridge Module Import and Mobile / Welcome / About Visual Polish\n\nThis hotfix resolves the production ES module import issue and four visual polish items while keeping all live functionality unchanged.\n\n- Inlined the time-of-day boundary helpers directly into `js/pond-crt/season-schedule.mjs` so production builds never request unbundled `/js/core/wallpaper-time.mjs`.\n- Completed mobile dark CRT glass styling across inner search bars, filter chips, lists, empty states, and buttons with zero horizontal overflow.\n- Improved Welcome modal text contrast and added the bottom `Esc` hint; brightened dark social icons on About."
  },
  "ja": {
    "title": "本番環境の池塘ブリッジ読み込み修正とモバイル・歓迎窓・概要の表示改善",
    "summary": "本番distで未出力の/js/core/wallpaper-time.mjs参照によるブリッジ停止を解消し、モバイル内層のダークガラス化と横はみ出し修正、歓迎窓の文字コントラストとEsc案内、概要ページのSNSアイコン視認性を改善しました。",
    "content_markdown": "# 本番環境の池塘ブリッジ読み込み修正とモバイル・歓迎窓・概要の表示改善\n\n本番環境でのモジュール読み込み不良と4点の表示不具合を修正しました。既存機能・データは変更していません。\n\n- 時刻切り替えロジックを `js/pond-crt/season-schedule.mjs` 内に統合し、本番環境での確実な起動を保証しました。\n- モバイル版の内層UIダークガラス化・横はみ出し解消・歓迎窓コントラスト改善・概要SNSアイコン視認性向上を反映しました。"
  }
}, "2026-11-21T18:22:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-mobile-polish', '2026-11-22-pond-mobile-polish', 'site-updates', '["网站更新","移动端","界面"]', '', 'published', 0, 0, '2026-11-21T18:05:00.000Z', '2026-11-21T18:05:00.000Z', '2026-11-21T18:05:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-mobile-polish", {
  "zh": {
    "title": "手机端深夜池塘视觉统一与全站 CRT 细节收尾",
    "summary": "逐步视觉替换第 8 批（收官批）上线：手机端统一换装深夜池塘深色玻璃配色，保留 44px 触控区、六入口 Dock 与原有排版；同步完成文章阅读进度条加粗、黄虚线摘要框与工具卡图标放大提亮收尾。",
    "content_markdown": "# 手机端深夜池塘视觉统一与全站 CRT 细节收尾\n\n本次为全站视觉逐步替换的第 8 批（收官批）上线，实现桌面全栏目、三个工具子页面与手机端的深夜终端池塘视觉全站统一，全部业务功能、数据与接口保持原样。\n\n- 手机端窗口、卡片、顶部栏与底部六入口 Dock 统一套用深夜池塘深色磨砂玻璃与青色点阵边框，不改变 44px 触控尺寸与既有手势。\n- 收尾优化：文章阅读页进度条加粗为彩虹发光渐变条并放大百分比字号，摘要框增加黄虚线边与三语「摘要：」前缀，工具卡三枚点阵 SVG 图标放大并提亮。"
  },
  "en": {
    "title": "Mobile Shell Visual Unification and Site-Wide CRT Final Polish",
    "summary": "Batch 8 (final batch) of the visual refresh is live: the mobile shell adopts the Midnight Pond dark glass palette while preserving 44px touch targets and the 6-route Dock, alongside final desktop polish for the Article progress bar, yellow-dotted summary box, and larger brighter Tool SVG icons.",
    "content_markdown": "# Mobile Shell Visual Unification and Site-Wide CRT Final Polish\n\nBatch 8 completes the Midnight Pond CRT visual refresh across desktop routes, all three tool sub-pages, and mobile without modifying any live logic or data.\n\n- Applies dark frosted pond glass and dotted mint accents to mobile windows, cards, and the 6-route Dock while preserving all 44px touch targets and gestures.\n- Final desktop polish: thicker rainbow reading progress bar with larger `%` readout, yellow-dotted localized summary box, and larger brighter Tool card SVG icons."
  },
  "ja": {
    "title": "モバイル版ビジュアル統一と全サイトCRT最終仕上げ",
    "summary": "段階的ビジュアル刷新の第8弾（最終回）を公開しました。モバイル版を深夜池塘ダークガラス配色へ統一し、44pxタッチ領域と6入口Dockを維持。記事進捗バー・黄点線要約枠・ツールアイコン拡大発光も仕上げました。",
    "content_markdown": "# モバイル版ビジュアル統一と全サイトCRT最終仕上げ\n\n段階的ビジュアル刷新の最終回として、モバイル版の配色統一と全サイトの細部仕上げを完了しました。機能・データ・APIは一切変更していません。\n\n- モバイル版のウィンドウ・カード・6入口Dockに深夜池塘ダークガラス配色を適用し、44px操作領域を維持しました。\n- 記事の読書進捗バーの強調、黄点線要約枠、ツールSVGアイコンの拡大発光を反映しています。"
  }
}, "2026-11-21T18:05:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-about-login-welcome', '2026-11-22-pond-about-login-welcome', 'site-updates', '["网站更新","欢迎窗","账号","界面"]', '', 'published', 0, 0, '2026-11-21T18:02:00.000Z', '2026-11-21T18:02:00.000Z', '2026-11-21T18:02:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-about-login-welcome", {
  "zh": {
    "title": "关于、登录浮层与欢迎窗换装深夜终端 CRT 视觉",
    "summary": "逐步视觉替换第 7 批上线：桌面端关于页（#about）、账号登录/注册浮层（#account-popover）与欢迎/最近更新窗（#welcome-modal）全部换装半透明 CRT 玻璃视觉；头像、RSS 订阅、社交链接、会话登录与默认不自动弹窗规则保持原样。",
    "content_markdown": "# 关于、登录浮层与欢迎窗换装深夜终端 CRT 视觉\n\n本次为全站视觉逐步替换的第 7 批上线，桌面端 9 个核心窗口与弹层至此全部完成深夜终端 CRT 玻璃视觉统一，零功能与数据改动。\n\n- 关于页保留现站鲁肃头像、个人介绍、独立每日 AI 新闻 RSS 订阅行与社交链接。\n- 账号登录/注册浮层居中呈现为 CRT 发光玻璃卡片，保留现站 HttpOnly Cookie 会话与表单校验。\n- 欢迎窗保持默认不自动弹出规则，主动打开或 `?welcome=1` 时以 CRT 玻璃窗展示最近更新。\n- 下一批将完成手机端视觉统一与全站细节收尾。"
  },
  "en": {
    "title": "About, Account Login, and Welcome Modal Refreshed with Midnight Pond CRT Visuals",
    "summary": "Batch 7 of the visual refresh is live: About (#about), the Account login/register popover (#account-popover), and the Welcome modal (#welcome-modal) adopt the translucent CRT glass skin while keeping all existing profile links, RSS feed, auth sessions, and non-auto-popup rules intact.",
    "content_markdown": "# About, Account Login, and Welcome Modal Refreshed with Midnight Pond CRT Visuals\n\nBatch 7 completes the Midnight Pond CRT visual refresh across all 9 desktop windows and dialogs without modifying any live logic or data.\n\n- About retains the existing avatar, profile info, standalone Daily AI News RSS row, and social links.\n- Account login/register renders as a centered CRT glass card over live HttpOnly cookie sessions.\n- Welcome keeps its opt-in display rule and renders recent updates in CRT glass.\n- Mobile shell visual unification and final polish follow next."
  },
  "ja": {
    "title": "概要・ログイン・歓迎ウィンドウを深夜端末CRTビジュアルへ刷新",
    "summary": "段階的ビジュアル刷新の第7弾を公開しました。デスクトップの概要（#about）・ログイン/登録ポップオーバー・歓迎ウィンドウ（#welcome-modal）を半透明CRTガラスへ統一し、RSS・認証・自動非表示ルールはそのまま維持しています。",
    "content_markdown": "# 概要・ログイン・歓迎ウィンドウを深夜端末CRTビジュアルへ刷新\n\n段階的ビジュアル刷新の第7弾として、概要・ログイン・歓迎ウィンドウの表示レイヤーを更新し、デスクトップ全9ウィンドウのCRTガラス統一が完了しました。\n\n- 概要ページは既存アバター・毎日AIニュースRSS・SNSリンクを維持しています。\n- ログインと歓迎ウィンドウも既存機能のまま半透明CRTガラスへ刷新しました。\n- 続いてモバイル版のビジュアル統一と最終仕上げへ進みます。"
  }
}, "2026-11-21T18:02:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-chatroom', '2026-11-22-pond-chatroom', 'site-updates', '["网站更新","聊天室","界面"]', '', 'published', 0, 0, '2026-11-21T17:59:00.000Z', '2026-11-21T17:59:00.000Z', '2026-11-21T17:59:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-chatroom", {
  "zh": {
    "title": "聊天室换装深夜终端 CRT 玻璃窗与点阵默认头像",
    "summary": "逐步视觉替换第 6 批上线：桌面端匿名聊天室（#chatroom）换装半透明 CRT 玻璃聊天窗并接入 6 枚点阵圆形 SVG 默认头像；匿名昵称、普通房/密码房、5 秒同步、300 字计数与发送节流均保持原样。",
    "content_markdown": "# 聊天室换装深夜终端 CRT 玻璃窗与点阵默认头像\n\n本次为全站视觉逐步替换的第 6 批上线，仅替换桌面端聊天室（`#chatroom`）的视觉呈现层，不改动任何消息接口、密码房端到端加密、轮询或节流逻辑。\n\n- 悬浮于四季池塘 CRT 背景之上，消息气泡采用点阵虚线圆角边框，并按昵称确定性映射 6 枚点阵圆形 SVG 头像。\n- 保留现站匿名昵称切换、密码房说明浮层、300 字计数、自动滚动与重试功能。\n- 关于、登录、欢迎窗及手机端继续按顺序逐批推进。"
  },
  "en": {
    "title": "Chatroom Refreshed with Midnight Pond CRT Glass UI and Dot-Matrix Avatars",
    "summary": "Batch 6 of the visual refresh is live: the desktop anonymous Chatroom (#chatroom) adopts translucent CRT glass bubbles and 6 circular dot-matrix SVG avatars while keeping anonymous identity, password rooms, 5s polling, 300-char limit, and cooldown untouched.",
    "content_markdown": "# Chatroom Refreshed with Midnight Pond CRT Glass UI and Dot-Matrix Avatars\n\nBatch 6 updates only the presentation layer for the desktop Chatroom (`#chatroom`), preserving all `/api/chat/messages` calls, password-room encryption, polling, and rate-limit behavior.\n\n- Renders dotted CRT glass message bubbles with 6 deterministic circular dot-matrix SVG avatars over the live Pond canvas.\n- About, Login, Welcome, and mobile roll out next."
  },
  "ja": {
    "title": "チャットルームを深夜端末CRTガラス窓とドットアバターへ刷新",
    "summary": "段階的ビジュアル刷新の第6弾を公開しました。デスクトップの匿名チャット（#chatroom）を半透明CRTガラス窓と6種の円形ドットSVGアバターへ換装し、合言葉ルーム・5秒同期・300文字制限は従来のまま維持しています。",
    "content_markdown": "# チャットルームを深夜端末CRTガラス窓とドットアバターへ刷新\n\n段階的ビジュアル刷新の第6弾として、デスクトップのチャットルーム（`#chatroom`）の表示レイヤーのみを更新しました。メッセージ送受信・パスワード部屋暗号化・クールダウンは一切変更していません。\n\n- 6種の円形ドットSVGアバターと点線枠バブル、丸型入力バーを適用しました。\n- 概要・ログイン・歓迎窓・モバイル版へ順次進みます。"
  }
}, "2026-11-21T17:59:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-games', '2026-11-22-pond-games', 'site-updates', '["网站更新","游戏区","界面"]', '', 'published', 0, 0, '2026-11-21T17:56:00.000Z', '2026-11-21T17:56:00.000Z', '2026-11-21T17:56:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-games", {
  "zh": {
    "title": "游戏区换装深夜终端 CRT 游戏货架与点阵封面",
    "summary": "逐步视觉替换第 5 批上线：桌面端游戏区（#games）换装半透明 CRT 玻璃货架，接入 3 张点阵插图封面（猫国建设者、小黑屋、人生重开模拟器）及 2048、Hextris 点阵封面；游戏启动、三语参数与云存档同步保持原样。",
    "content_markdown": "# 游戏区换装深夜终端 CRT 游戏货架与点阵封面\n\n本次为全站视觉逐步替换的第 5 批上线，仅替换桌面端游戏区（`#games`）的视觉呈现层，不改动任何游戏目录数据、启动参数或云存档同步逻辑。\n\n- 上三下二货架排布直接作用在现站 `games/catalog.json` 渲染结果之上。\n- 猫国建设者、小黑屋、人生重开模拟器接入点阵风插图封面，2048 与 Hextris 采用点阵几何 SVG 封面。\n- 聊天室、关于、登录、欢迎窗及手机端继续按顺序逐批推进。"
  },
  "en": {
    "title": "Games Shelf Refreshed with Midnight Pond CRT Layout and Dot-Matrix Covers",
    "summary": "Batch 5 of the visual refresh is live: the desktop Games shelf (#games) adopts the translucent CRT glass 3+2 shelf layout with 3 dot-matrix illustrated covers and 2 geometric SVG covers while keeping catalog loading, launch links, and cloud saves untouched.",
    "content_markdown": "# Games Shelf Refreshed with Midnight Pond CRT Layout and Dot-Matrix Covers\n\nBatch 5 updates only the presentation layer for the desktop Games shelf (`#games`), preserving all `games/catalog.json` data, language launch links, and cloud-save behavior.\n\n- Applies the 3-over-2 CRT glass card shelf over the existing `#game-list` DOM.\n- Uses dot-matrix covers for Kittens Game, A Dark Room, and Life Restart, plus crisp geometric SVG covers for 2048 and Hextris.\n- Chatroom, About, Login, Welcome, and mobile roll out next."
  },
  "ja": {
    "title": "ゲーム棚を深夜端末CRTレイアウトとドット風カバーへ刷新",
    "summary": "段階的ビジュアル刷新の第5弾を公開しました。デスクトップのゲーム欄（#games）を半透明CRTガラス棚と3種のドット風イラストカバー＋2種の幾何SVGカバーへ換装し、起動・クラウドセーブ機能は従来のまま維持しています。",
    "content_markdown": "# ゲーム棚を深夜端末CRTレイアウトとドット風カバーへ刷新\n\n段階的ビジュアル刷新の第5弾として、デスクトップのゲーム欄（`#games`）の表示レイヤーのみを更新しました。`games/catalog.json`・起動パラメータ・クラウドセーブ同期は一切変更していません。\n\n- 上段3件＋下段2件のCRTガラス棚レイアウトを既存DOMへ適用しました。\n- 子猫ゲーム・暗い部屋・人生やり直しシミュレーターにドット風カバー、2048・Hextrisに幾何SVGカバーを適用しています。\n- チャット・概要・ログイン・歓迎窓・モバイル版へ順次進みます。"
  }
}, "2026-11-21T17:56:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-tools', '2026-11-22-pond-tools', 'site-updates', '["网站更新","工具区","在线画板","界面"]', '', 'published', 0, 0, '2026-11-21T17:52:00.000Z', '2026-11-21T17:52:00.000Z', '2026-11-21T17:52:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-tools", {
  "zh": {
    "title": "工具区与三个工具子页面换装深夜终端 CRT 视觉",
    "summary": "逐步视觉替换第 4 批上线：桌面端工具区（#resources）换装提亮版 CRT 玻璃卡片并接入 6 枚点阵虚线 SVG 图标，同时为临时互传弹窗、在线画板与日语的言外之意统一套用深夜池塘 CRT 视觉主题；全部功能与交互逻辑保持原样。",
    "content_markdown": "# 工具区与三个工具子页面换装深夜终端 CRT 视觉\n\n本次为全站视觉逐步替换的第 4 批上线，仅替换工具区与三个工具子页面的视觉呈现层，不改动任何工具逻辑、协作协议或子项目数据。\n\n- 整体提亮了 CRT 玻璃窗的通透度与边框辉光，工具区三列卡片接入点阵虚线风调色盘、电脑⇄手机、鸟居及下载行 SVG 图标。\n- 临时互传弹窗、在线画板（`/tools/whiteboard/`）与日语的言外之意（`/tools/japanese-subtext/`）统一挂接深夜池塘 CRT 视觉层，画布与答题逻辑零改动。\n- 游戏、聊天室、关于、登录、欢迎窗及手机端继续按顺序逐批推进。"
  },
  "en": {
    "title": "Tools Window and Three Tool Sub-Pages Refreshed with Midnight Pond CRT Visuals",
    "summary": "Batch 4 of the visual refresh is live: the desktop Tools window (#resources) adopts the brightened CRT glass skin with 6 dotted SVG icons, and Quick Transfer, Online Whiteboard, and Behind the Japanese share the Midnight Pond CRT visual theme without changing any tool logic.",
    "content_markdown": "# Tools Window and Three Tool Sub-Pages Refreshed with Midnight Pond CRT Visuals\n\nBatch 4 updates only the visual presentation layer for Tools (`#resources`) and all three public tool sub-pages while keeping every tool feature and protocol intact.\n\n- Lifted CRT glass translucency and luminous border glow across windows, integrating the 6 dotted SVG icons for tools and download cards.\n- Applied the Midnight Pond CRT visual theme to the Quick Transfer modal, Online Whiteboard (`/tools/whiteboard/`), and Behind the Japanese (`/tools/japanese-subtext/`).\n- Games, Chatroom, About, Login, Welcome, and mobile continue rolling out next."
  },
  "ja": {
    "title": "ツール欄と3つのツール子ページを深夜端末CRTビジュアルへ刷新",
    "summary": "段階的ビジュアル刷新の第4弾を公開しました。デスクトップのツール欄（#resources）を明るく透過感のあるCRTガラス窓と6種の点線SVGアイコンへ換装し、一時転送・ホワイトボード・日本語の裏側にも共通CRTテーマを適用しました。",
    "content_markdown": "# ツール欄と3つのツール子ページを深夜端末CRTビジュアルへ刷新\n\n段階的ビジュアル刷新の第4弾として、ツール欄（`#resources`）と3つのツール子ページの表示レイヤーのみを更新しました。既存機能・通信・データは一切変更していません。\n\n- CRTガラス窓の透過感と枠線発光を底上げし、パレット・転送・鳥居など6種の点線SVGアイコンを適用しました。\n- 一時転送モーダル・オンラインホワイトボード・日本語の裏側にも深夜池塘CRTテーマを統一適用しています。\n- ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版へ順次進みます。"
  }
}, "2026-11-21T17:52:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos', '2026-11-22-pond-videos', 'site-updates', '["网站更新","视频区","界面"]', '', 'published', 0, 0, '2026-11-21T17:46:00.000Z', '2026-11-21T17:46:00.000Z', '2026-11-21T17:46:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos", {
  "zh": {
    "title": "视频区换装深夜终端 CRT 玻璃卡片窗",
    "summary": "逐步视觉替换第 3 批上线：桌面端视频区（#videos）与播放弹窗换装半透明 CRT 玻璃窗，保留现站 /api/videos 接口、分类筛选、平台徽标与外链播放逻辑；工具、游戏、聊天室、关于、登录、欢迎窗及手机端保持原样。",
    "content_markdown": "# 视频区换装深夜终端 CRT 玻璃卡片窗\n\n本次为全站视觉逐步替换的第 3 批上线，仅替换桌面端视频区（`#videos`）与视频弹窗的视觉呈现层，不改动任何视频数据接口、分类逻辑或外链播放行为。\n\n- 悬浮于四季池塘 CRT 背景之上，采用三列 16:9 卡片网格、点阵虚线播放徽标与分类胶囊筛选。\n- 保留现站 `/api/videos` 实时拉取、平台标识（Bilibili / YouTube）与外链播放能力。\n- 工具、游戏、聊天室、关于、登录、欢迎窗及手机端均保持原样，继续按顺序逐批替换。"
  },
  "en": {
    "title": "Videos Section Refreshed with Midnight Pond CRT Cards",
    "summary": "Batch 3 of the visual refresh is live: the desktop Videos window (#videos) and player modal adopt translucent CRT glass styling with 3-column 16:9 cards and dotted play badges while keeping live /api/videos data and playback links untouched.",
    "content_markdown": "# Videos Section Refreshed with Midnight Pond CRT Cards\n\nBatch 3 updates only the presentation layer for the desktop Videos section (`#videos`) and player modal, keeping all `/api/videos` requests, category filters, platform badges, and external links intact.\n\n- Renders a 3-column 16:9 CRT glass card grid over the live Pond background with dotted play overlays and glowing category pills.\n- Tools, Games, Chatroom, About, Login, Welcome, and mobile remain untouched and continue rolling out next."
  },
  "ja": {
    "title": "動画セクションを深夜端末・CRTガラスカードへ刷新",
    "summary": "段階的ビジュアル刷新の第3弾を公開しました。デスクトップの動画欄（#videos）と再生モーダルを半透明CRTガラス窓へ換装し、既存の/api/videos連携・カテゴリ絞り込み・外部リンク再生はそのまま維持しています。",
    "content_markdown": "# 動画セクションを深夜端末・CRTガラスカードへ刷新\n\n段階的ビジュアル刷新の第3弾として、デスクトップの動画セクション（`#videos`）と再生モーダルの表示レイヤーのみを更新しました。`/api/videos` 取得・分類フィルタ・外部再生リンクは一切変更していません。\n\n- 四季池塘CRT背景の上に3列16:9カードグリッドと点線再生アイコン、カテゴリピルを配置しました。\n- ツール・ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T17:46:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-article-reader', '2026-11-22-pond-article-reader', 'site-updates', '["网站更新","知识库","文章详情","阅读体验","界面"]', '', 'published', 0, 0, '2026-11-21T17:38:00.000Z', '2026-11-21T17:38:00.000Z', '2026-11-21T17:38:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-article-reader", {
  "zh": {
    "title": "文章阅读页换装深夜终端 CRT 玻璃阅读窗",
    "summary": "逐步视觉替换第 2 批上线：桌面端文章阅读页（#article-detail）换装半透明 CRT 玻璃阅读窗，保留现站目录 TOC、顶部阅读进度条、摘要框、复制链接与正文排版逻辑；其余未替换栏目与手机端保持原样。",
    "content_markdown": "# 文章阅读页换装深夜终端 CRT 玻璃阅读窗\n\n本次为全站视觉逐步替换的第 2 批上线，仅替换桌面端文章阅读页（`#article-detail`）的视觉呈现层，不改动现站文章拉取接口、目录生成、进度计算或任何交互逻辑。\n\n- 阅读窗直接悬浮于四季池塘 CRT 背景之上，顶部阅读进度条升级为青→紫→粉荧光点阵渐变条。\n- 左侧目录区采用点阵竖线与荧光高亮当前章节，右侧正文区配点阵虚线摘要框与深色高对比 Markdown 排版。\n- 视频、工具、游戏、聊天室、关于、登录、欢迎窗及手机端 iOS Shell 均保持原样，继续按顺序逐批替换。"
  },
  "en": {
    "title": "Article Reader Refreshed with Midnight Pond CRT Glass Styling",
    "summary": "Batch 2 of the visual refresh is live: the desktop Article Reader (#article-detail) adopts the translucent CRT glass layout over the live Pond background while keeping TOC, reading progress, summary toggle, link copying, and markdown rendering untouched.",
    "content_markdown": "# Article Reader Refreshed with Midnight Pond CRT Glass Styling\n\nBatch 2 of the gradual visual replacement updates only the presentation layer of the desktop Article Reader (`#article-detail`), leaving all article APIs, TOC generation, scroll progress math, and interactions untouched.\n\n- The reader floats cleanly over the four-season Pond CRT background with a cyan-to-pink glowing reading progress bar.\n- The left TOC sidebar uses dotted guides and phosphor active states, paired with a dotted summary callout and high-contrast dark CRT markdown typography.\n- Videos, Tools, Games, Chatroom, About, Login, Welcome, and mobile remain unchanged and will roll out next."
  },
  "ja": {
    "title": "記事リーダーを深夜端末・CRTガラス表示へ刷新",
    "summary": "段階的ビジュアル刷新の第2弾を公開しました。デスクトップの記事閲覧ページ（#article-detail）を池塘背景上の半透明CRTガラス窓へ換装し、目次・読書進捗・要約・リンクコピー等の機能はすべて従来のまま維持しています。",
    "content_markdown": "# 記事リーダーを深夜端末・CRTガラス表示へ刷新\n\n段階的ビジュアル刷新の第2弾として、デスクトップの記事閲覧ページ（`#article-detail`）の表示レイヤーのみを更新しました。記事取得API・目次生成・進捗計算・各種操作は一切変更していません。\n\n- 四季池塘CRT背景の上に半透明ガラス窓を重ね、上部の読書進捗バーを青〜ピンクの発光グラデーションへ統一しました。\n- 左側の目次サイドバーと右側の点線要約枠・高コントラストMarkdown本文をCRT端末風に整えています。\n- 動画・ツール・ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T17:38:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-21-pond-home-knowledge', '2026-11-21-pond-home-knowledge', 'site-updates', '["网站更新","首页","知识库","界面"]', '', 'published', 0, 0, '2026-11-21T15:30:00.000Z', '2026-11-21T15:30:00.000Z', '2026-11-21T15:30:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-21-pond-home-knowledge", {
  "zh": {
    "title": "桌面首页与知识库列表换装深夜终端池塘视觉",
    "summary": "逐步视觉替换第 1 批上线：桌面端首页替换为四季池塘 CRT 点阵桌面（接入按时段自动切换与手动滑块），桌面端知识库列表换装半透明 CRT 玻璃窗口；全部数据、接口、分类、排序、搜索、分页及未替换栏目与移动端均保持原样。",
    "content_markdown": "# 桌面首页与知识库列表换装深夜终端池塘视觉\n\n本次为全站视觉逐步替换的第 1 批上线，仅替换桌面端首页与知识库列表的视觉呈现层，不改动任何线上数据、后端接口或既有交互逻辑。\n\n- 桌面端首页替换为 WebGL2 四季池塘 CRT 桌面，接入现站时段壁纸规则（早/昼/暮/夜自动对应春/夏/秋/冬），右上角保留手动滑块切换。\n- 桌面端知识库列表在现站真实 DOM 与 `/api/articles` 接口之上换装半透明发光 CRT 玻璃窗口，沿用现站分类顺序、计数、置顶、搜索与分页逻辑。\n- 文章阅读页、视频、工具、游戏、聊天室、关于、账号浮层、欢迎窗及移动端 iOS Shell 均保持现状，后续按窗口逐一替换。"
  },
  "en": {
    "title": "Desktop Home and Knowledge List Refresh with Midnight Pond CRT Visuals",
    "summary": "Batch 1 of the visual refresh is live: desktop Home adopts the four-season WebGL2 Pond CRT desktop (synced with the time-of-day schedule and manual slider), and the desktop Knowledge list uses the translucent CRT glass skin. All data, APIs, sorting, search, pagination, other sections, and mobile remain unchanged.",
    "content_markdown": "# Desktop Home and Knowledge List Refresh with Midnight Pond CRT Visuals\n\nThis is Batch 1 of the gradual visual replacement, updating only the presentation layer for desktop Home and the Knowledge list while keeping all live data, backend APIs, and existing logic untouched.\n\n- Desktop Home now renders the four-season WebGL2 Pond CRT scene connected to the site's time-of-day wallpaper schedule (morning/day/dusk/night -> spring/summer/autumn/winter) with a manual top-right slider.\n- Desktop Knowledge list applies the translucent CRT glass window skin directly over the existing DOM and live `/api/articles` flow, preserving category order, counts, pinning, search, and pagination.\n- Article Reader, Videos, Tools, Games, Chatroom, About, Account popover, Welcome modal, and the mobile shell remain unchanged and will be updated incrementally."
  },
  "ja": {
    "title": "デスクトップのホームと知識庫一覧を深夜端末・池塘CRTビジュアルへ刷新",
    "summary": "段階的ビジュアル刷新の第1弾を公開しました。デスクトップのホームを時間帯連動の四季池塘CRTへ、知識庫一覧を半透明CRTガラス窓へ切り替えました。データ・API・並び順・検索・ページングおよび他ページとモバイルは従来のままです。",
    "content_markdown": "# デスクトップのホームと知識庫一覧を深夜端末・池塘CRTビジュアルへ刷新\n\n全サイト段階的ビジュアル刷新の第1弾として、デスクトップのホーム画面と知識庫一覧の表示レイヤーのみを更新しました。既存データ・API・機能ロジックは一切変更していません。\n\n- デスクトップのホームに WebGL2 四季池塘 CRT を導入し、既存の時刻壁紙ルール（朝・昼・夕・夜→春・夏・秋・冬）と右上の手動スライダーを接続しました。\n- デスクトップの知識庫一覧は既存 DOM と `/api/articles` のまま半透明 CRT ガラス窓へスキン適用し、カテゴリ順・件数・固定表示・検索・ページングを維持しています。\n- 記事本文、動画、ツール、ゲーム、チャット、概要、アカウント、歓迎ウィンドウ、モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T15:30:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-10-29-tool-maintenance', '2026-10-29-tool-maintenance', 'site-updates', '["网站更新","工具"]', '', 'published',0,0,'2026-10-29T15:00:00.000Z', '2026-10-29T15:00:00.000Z', '2026-10-29T15:00:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-10-29-tool-maintenance", {
  "zh": {
    "title": "工具维护与完整画板导出准备",
    "summary": "本地候选在现有画板和互传基础上完善完整图片导出与管理适配，保留现有大厅、帮助、上传和草稿保护；尚未部署。",
    "content_markdown": "# 工具维护与完整画板导出准备\n\n本地候选在现有画板和互传基础上完善完整图片导出与管理适配，保留现有大厅、帮助、上传和草稿保护；尚未部署。\n\n画板导出覆盖当前场景全部未删除元素和已加载的图片，包括屏幕视口外的内容。素材尚未加载时明确失败，不把只有文字或元数据的结果当作完整图片。\n\n继续保留主线已经验证的紧凑大厅、键盘与触屏帮助、三语界面以及密码房生命周期。互传继续保留切换标签页时的上传、离房草稿清理、失败重试和安全删除语义。本条是本地候选维护记录，线上功能与版本以正式部署为准；没有在测试中发布文章、发送真实消息或覆盖个人游戏存档。"
  },
  "en": {
    "title": "Tool Maintenance and Full Whiteboard Export Preparation",
    "summary": "The local candidate adds full whiteboard image export and administration integration while retaining the existing lobby, help, uploads and draft protection. It has not been deployed.",
    "content_markdown": "# Tool Maintenance and Full Whiteboard Export Preparation\n\nThe local candidate adds full whiteboard image export and administration integration while retaining the existing lobby, help, uploads and draft protection. It has not been deployed.\n\nWhiteboard export includes all undeleted scene elements and loaded image assets, including content beyond the viewport. Missing image assets produce an explicit failure. The existing lobby, keyboard and touch help, room lifecycle, background uploads and draft cleanup remain intact. This is a local candidate maintenance record, not a production release announcement."
  },
  "ja": {
    "title": "ツール保守とホワイトボード全体画像の準備",
    "summary": "ローカル候補版で全体画像の書き出しと管理連携を整備しました。既存のロビー、ヘルプ、アップロード、下書き保護を維持しています。まだ公開していません。",
    "content_markdown": "# ツール保守とホワイトボード全体画像の準備\n\nローカル候補版で全体画像の書き出しと管理連携を整備しました。既存のロビー、ヘルプ、アップロード、下書き保護を維持しています。まだ公開していません。\n\n書き出しには、画面の表示範囲外も含め、削除されていない全要素と読み込み済み画像が含まれます。画像素材が不足している場合は明確に失敗を返します。既存のロビー、キーボードやタッチでのヘルプ、部屋の有効期限、バックグラウンドでのアップロードと下書き消去を維持します。これはローカル候補の保守記録であり、本番公開の告知ではありません。実際のサイトの状態は正式なデプロイに従います。"
  }
}, "2026-10-29T15:00:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-09-28-mobile-layout', '2026-09-28-mobile-layout', 'site-updates', '["网站更新","移动端","聊天室","界面"]', '', 'published', 0, 0, '2026-09-28T02:00:00.000Z', '2026-09-28T02:00:00.000Z', '2026-09-28T02:00:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-09-28-mobile-layout", {
  "zh": {
    "title": "手机界面重新排版",
    "summary": "首页入口、栏目卡片和底部导航统一调整；聊天室重新划分身份、房间、消息与输入区，改善短屏和横屏下的阅读与操作。",
    "content_markdown": "# 手机界面重新排版\n\n首页入口、栏目卡片和底部导航统一调整；聊天室重新划分身份、房间、消息与输入区，改善短屏和横屏下的阅读与操作。\n\n- 首页竖屏采用三列入口，横屏采用一排入口，保留像素图标和时段壁纸。\n- 栏目窗口和卡片使用更简洁的边框、统一的字号和自然换行。\n- 视频卡保留完整的 16:9 大封面，下方排列标题和简介，作者日期与播放按钮并排。\n- 聊天室采用固定语义分区，消息列表独立滚动；短屏计数与发送按钮并排，横屏使用左侧房间栏。\n- 底部 Dock 提高文字对比，继续支持横滑与收起。\n- 保留中文、英文和日文界面。"
  },
  "en": {
    "title": "A Reworked Mobile Layout",
    "summary": "Home shortcuts, content cards, and navigation now share a clearer layout. Chat separates identity, room controls, messages, and composition for easier use on short and landscape screens.",
    "content_markdown": "# A Reworked Mobile Layout\n\nHome shortcuts, content cards, and navigation now share a clearer layout. Chat separates identity, room controls, messages, and composition for easier use on short and landscape screens.\n\n- Home uses three columns in portrait and one row in landscape, with pixel icons and time-based wallpapers.\n- Windows and cards use simpler borders, consistent type sizes, and natural wrapping.\n- Video cards retain a full-width 16:9 cover, followed by the title and description, with author and date beside the play button.\n- Chat has explicit layout areas and a separately scrolling conversation. Compact screens place the counter beside Send; landscape uses a room sidebar.\n- Dock labels have higher contrast, with scrolling and collapse controls retained.\n- Chinese, English, and Japanese remain available."
  },
  "ja": {
    "title": "モバイル画面のレイアウトを刷新",
    "summary": "ホームの入口、各ページのカード、下部ナビゲーションを整理。チャットの名前・部屋・メッセージ・入力欄を分け、小さな画面や横向きでも使いやすくしました。",
    "content_markdown": "# モバイル画面のレイアウトを刷新\n\nホームの入口、各ページのカード、下部ナビゲーションを整理。チャットの名前・部屋・メッセージ・入力欄を分け、小さな画面や横向きでも使いやすくしました。\n\n- ホームは縦向きで3列、横向きで1行に配置。ピクセルアイコンと時間帯の壁紙を維持しました。\n- ウィンドウとカードの枠線、文字サイズ、折り返しを統一しました。\n- 動画カードは横幅いっぱいの16:9カバーを表示し、下にタイトルと説明、作者・日時と再生ボタンを配置します。\n- チャットを明確な領域に分け、メッセージだけをスクロールできます。小画面では文字数と送信ボタンを横に配置し、横向きでは部屋操作を左側に表示します。\n- Dockの文字のコントラストを改善し、横スクロールと折りたたみを維持しました。\n- 中国語・英語・日本語に対応しています。"
  }
}, "2026-09-28T02:00:00.000Z"),
    env.DB.prepare(`
    insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values (
      'seed-update-2026-09-08-site-review-optimization',
      '2026-09-08-site-review-optimization',
      'site-updates',
      '["网站更新","界面","移动端","工具","可靠性"]',
      '',
      'published',
      0,
      0,
      '2026-09-07T23:00:00.000Z',
      '2026-09-07T23:00:00.000Z',
      '2026-09-07T23:00:00.000Z'
    ) on conflict(article_id) do nothing
    `),
    ...articleTranslationsStatements(env, "seed-update-2026-09-08-site-review-optimization", {
      zh: {
        title: "全站体验与可靠性优化",
        summary: "欢迎窗改为主动查看，工具与画板入口更清晰，手机手势和动效更稳定；知识库支持完整分页搜索，临时互传修复跨房草稿与后台上传，发布增加精确版本校验。",
        content_markdown: "# 全站体验与可靠性优化\n\n这次根据全站审查，集中改善适配、界面、交互和代码可靠性。继续保留桌面的 XP／像素风格与手机端独立布局。\n\n## 阅读与导航\n\n- 欢迎窗改为主动打开，可通过首页的欢迎与更新入口查看；文章直链不会被自动弹窗打断。\n- 知识库增加分页与服务端搜索，分类数量覆盖全部已发布文章；相同标签只显示一次。\n- 文章链接支持 Ctrl／Command 点击和浏览器的新标签页操作。\n\n## 工具与移动端\n\n- 工具卡片先说明用途，版本和技术说明按需展开；视频缩略图去掉内框，标题、简介、时间与播放按钮重新对齐。\n- 在线画板 1.0.10 整理身份、公共房、密码房和最近使用；帮助支持鼠标、键盘与触控，展开时不遮挡输入。\n- 临时互传 1.0.14 离房清空未发送草稿，切后台不主动取消上传，暂停与继续能正确衔接；启动失败可直接重试。\n- 手机返回首页手势仅从 Home 指示条触发，输入、键盘或弹层开启时不会误退出；快速切换时取消过期动效。\n\n## 可靠性与维护\n\n- 注册、登录不再被非关键访问统计写入失败阻断。\n- 后端拆出会话、清理和内容迁移服务；清理分批继续，失败允许重试。\n- 第一方代码统一静态检查，发布核对实际提交与资源哈希，避免把旧站点当作本次上线。\n"
      },
      en: {
        title: "A Clearer, More Reliable Personal Site",
        summary: "Welcome is now optional, tool and whiteboard entries are clearer, and mobile gestures are more predictable. Knowledge gains complete pagination and search; Transfer fixes room drafts and background uploads, with exact release checks.",
        content_markdown: "# A Clearer, More Reliable Personal Site\n\nThis release follows a site-wide review of responsive layout, visual design, interaction, and reliability. The desktop keeps its XP and pixel style, with a separate layout for phones.\n\n## Reading and navigation\n\n- Welcome opens on request from the Home welcome and updates entry. Direct article links are no longer interrupted by an automatic dialog.\n- Knowledge now has pagination and server-side search across published articles, complete category counts, and deduplicated tags.\n- Article links preserve Control/Command-click and the browser's native new-tab behavior.\n\n## Tools and mobile\n\n- Tool cards explain their purpose first, with version and technical details available on demand. Video thumbnails lose the inner frame, and card titles, summaries, dates, and playback actions align more consistently.\n- Whiteboard 1.0.10 organizes identity, public rooms, password rooms, and recent boards. Help works with mouse, keyboard, and touch without covering inputs.\n- Transfer 1.0.14 clears unsent drafts when leaving a room, keeps uploads running when the page becomes hidden, and handles pause and resume consistently. A failed startup can be retried.\n- The mobile Home gesture starts only on its indicator and stays disabled during typing or dialogs. Fast navigation cancels outdated motion.\n\n## Reliability and maintenance\n\n- Nonessential analytics failures no longer block registration or login.\n- Session, cleanup, and content migration services are separated. Cleanup proceeds in bounded batches and remains retryable after failure.\n- First-party code receives consistent static checks. Release validation compares the deployed commit and asset hashes so an old deployment cannot pass as the new release.\n"
      },
      ja: {
        title: "サイト全体の使いやすさと信頼性を改善",
        summary: "歓迎画面を任意表示にし、ツールと画板の入口を整理しました。モバイル操作を安定させ、Knowledgeの全件ページングと検索、転送の下書き・バックグラウンド送信、公開バージョン確認を改善しています。",
        content_markdown: "# サイト全体の使いやすさと信頼性を改善\n\nレスポンシブ表示、見た目、操作、コードの信頼性を全体的に見直しました。デスクトップの XP・ピクセル調と、スマホ専用のレイアウトは維持しています。\n\n## 読む・移動する\n\n- 歓迎画面はホームの「ようこそ・最近の更新」から任意で開けます。記事への直リンクを自動ダイアログで遮りません。\n- Knowledge にページングと公開記事全体を対象としたサーバー検索を追加しました。カテゴリ件数を全件で集計し、同じタグの重複表示をなくしました。\n- 記事リンクで Control／Command クリックなどの標準的な新規タブ操作が使えます。\n\n## ツールとモバイル\n\n- ツールカードは用途を先に説明し、バージョンと技術説明を折りたたみました。動画の内枠をなくし、見出し・概要・日時・再生操作の配置を整えました。\n- 画板 1.0.10 は名前、公開ルーム、合言葉ルーム、最近のボードを整理しました。ヘルプはマウス・キーボード・タッチで利用でき、入力を覆いません。\n- 一時転送 1.0.14 は退室時に未送信の下書きを消去し、ページが隠れてもアップロードを自動中断しません。一時停止と再開、起動失敗後の再試行も改善しました。\n- ホームへ戻るジェスチャーは専用インジケーターからのみ開始します。入力中やダイアログ表示中は無効になり、素早い移動で古いアニメーションが残りません。\n\n## 信頼性と保守\n\n- 補助的なアクセス集計の失敗が登録・ログインを妨げないようにしました。\n- セッション、削除処理、コンテンツ移行を独立したサービスへ分離しました。削除は制限付きのバッチで継続し、失敗時も再試行できます。\n- 自作コードの静的検査を統一し、公開されたコミットと資産ハッシュを照合して古い公開版の誤認を防ぎます。\n"
      },
    }, "2026-09-07T23:00:00.000Z", "2026-09-07T23:00:00.000Z", { insertOnly: true }),
    env.DB.prepare(`
    insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values (
      'seed-update-2026-09-22-cloud-save-10min',
      '2026-09-22-cloud-save-10min',
      'site-updates',
      '["网站更新","游戏区","云存档","可靠性"]',
      '',
      'published',
      0,
      0,
      '2026-09-21T16:24:26.443Z',
      '2026-09-21T16:24:26.443Z',
      '2026-09-21T16:24:26.443Z'
    ) on conflict(article_id) do nothing
    `),
    ...articleTranslationsStatements(env, "seed-update-2026-09-22-cloud-save-10min", {
      zh: {
        title: "游戏云存档调整为每10分钟同步",
        summary: "登录后的游戏自动云同步由30秒调整为10分钟，减少长时间挂机产生的 Cloudflare 请求和 D1 写入；手动“立即同步”和切出页面时的补同步保持不变。",
        content_markdown: "# 游戏云存档调整为每10分钟同步\n\n游戏本地存档仍由浏览器和游戏本体持续保存，只有上传到账号云端的自动同步频率发生变化。\n\n## 本次调整\n\n- 登录后的自动云同步由每30秒一次改为每10分钟一次。\n- 点击“立即同步”仍会立刻尝试上传，不需要等待下一轮计时。\n- 页面切到后台时仍会刷新游戏本地存档并尝试补同步。\n- 云端版本冲突检测、JSON导入导出和本地存档均保持不变。\n\n这项调整主要减少长时间挂机产生的 Pages Functions 请求与 D1 写入，同时继续保留手动同步和离开页面时的保护。"
      },
      en: {
        title: "Game Cloud Saves Now Sync Every 10 Minutes",
        summary: "Signed-in games now auto-sync to the cloud every 10 minutes instead of every 30 seconds, reducing Cloudflare requests and D1 writes during long sessions. Manual Sync Now and the page-hide sync remain immediate.",
        content_markdown: "# Game Cloud Saves Now Sync Every 10 Minutes\n\nGames continue to save locally through the browser and their own save logic. Only the automatic upload cadence for account cloud saves has changed.\n\n## What changed\n\n- Signed-in automatic cloud sync now runs every 10 minutes instead of every 30 seconds.\n- Selecting Sync Now still attempts an upload immediately without waiting for the timer.\n- Moving the page to the background still flushes the local game save and attempts an extra sync.\n- Cloud-version conflict handling, JSON import/export, and local saves are unchanged.\n\nThis reduces Pages Functions requests and D1 writes during long-running sessions while retaining manual and page-exit protection."
      },
      ja: {
        title: "ゲームのクラウド保存を10分間隔に変更",
        summary: "ログイン中のゲームの自動クラウド同期を30秒から10分間隔へ変更し、長時間プレイ時のCloudflareリクエストとD1書き込みを削減しました。手動同期とページを離れる際の補助同期は従来どおり即時です。",
        content_markdown: "# ゲームのクラウド保存を10分間隔に変更\n\nゲーム本体とブラウザーによるローカル保存はこれまでどおり継続します。変更したのは、アカウントのクラウド保存へ自動アップロードする間隔だけです。\n\n## 変更内容\n\n- ログイン中の自動クラウド同期を30秒ごとから10分ごとへ変更しました。\n- 「今すぐ同期」はタイマーを待たず、引き続き即座にアップロードを試みます。\n- ページがバックグラウンドへ移る際も、ローカル保存を更新して補助同期を試みます。\n- クラウド版の競合処理、JSONの入出力、ローカル保存は変更していません。\n\n長時間プレイ時のPages FunctionsリクエストとD1書き込みを減らしながら、手動同期とページ離脱時の保護を維持します。"
      }
    }, "2026-09-21T16:24:26.443Z", "2026-09-21T16:24:26.443Z", { insertOnly: true })
  ];
}
