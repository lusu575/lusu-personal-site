// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-08-12-wallpaper-game-display-fix",
      "slug": "2026-08-12-wallpaper-game-display-fix",
      "category": "site-updates",
      "tags": ["网站更新", "视频壁纸", "游戏区", "响应式", "流畅度"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-12T07:30:00.000Z",
      "updated_at": "2026-08-12T07:30:00.000Z",
      "published_at": "2026-08-12T07:30:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.12",
      "title": {
        "zh": "视频壁纸叠层、返回闪烁与游戏显示修复",
        "en": "Wallpaper Layering, Return Flash, and Game Display Fixes",
        "ja": "動画壁紙の重なり・復帰時のちらつき・ゲーム表示を修正"
      },
      "summary": {
        "zh": "视频壁纸启用时不再创建或预热额外的 CSS 动态云，避免出现两层云；离开 Home 只暂停当前视频并保留解码器，返回后直接续播。游戏外壳移除 1280px 固定宽度上限，短屏默认收起存档与 AI 工具并可通过 44px 按钮展开，让人生重开等游戏在浏览器缩放、横屏和窄屏下获得更大的可玩区域。",
        "en": "When video wallpaper is eligible, the page no longer creates or warms the separate CSS cloud layer, preventing duplicate clouds. Leaving Home now pauses the current video in place and resumes it on return without rebuilding the decoder. The game shell also removes its fixed 1280px cap and collapses save/AI tools by default on short screens behind a 44px toggle, giving Life Restart and other games more usable space under browser zoom, landscape, and narrow layouts.",
        "ja": "動画壁紙を利用できる場合は別の CSS 雲レイヤーを生成・先読みせず、雲の二重表示を防ぎます。Home を離れると現在の動画をその場で一時停止し、戻った際はデコーダーを作り直さず再開します。ゲーム枠の固定 1280px 上限も削除し、短い画面ではセーブ／AI ツールを 44px ボタンの後ろへ初期収納して、人生重開などをブラウザー拡大縮小・横画面・狭い画面で広く表示します。"
      }
    },
    {
      "article_id": "seed-update-2026-08-11-h3-first-version-video-sr-48fps",
      "slug": "2026-08-11-h3-first-version-video-sr-48fps",
      "category": "site-updates",
      "tags": ["网站更新", "壁纸", "MiniMax H3", "4K", "超分", "补帧"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-11T10:40:00.000Z",
      "updated_at": "2026-08-11T10:40:00.000Z",
      "published_at": "2026-08-11T10:40:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.11",
      "title": {
        "zh": "第一版 H3 动态壁纸升级至 48fps 与 4K",
        "en": "First-Version H3 Wallpapers at 48fps and 4K",
        "ja": "初版 H3 動画壁紙を48fps・4Kへ更新"
      },
      "summary": {
        "zh": "桌面 Home 的 morning／day／dusk／night 已改用用户确认的第一版 MiniMax H3 整帧动态，不再使用第二版局部 mask／gain 合成。每段整理为整屏往返循环，先用双向光流补至 48fps、共 248 帧，再用 RealESRGAN_x4plus_anime_6B 逐帧超分，交付 1080p／2160p；没有小女孩或电视 cameo，手机、Save-Data 与 reduced／off 降级边界不变。",
        "en": "The morning, day, dusk, and night wallpapers on desktop Home now use the user-approved first-version full-frame MiniMax H3 motion instead of the second version's local mask/gain composite. Each clip is arranged as a full-frame ping-pong loop, bidirectionally optical-flow interpolated to 48fps and 248 frames, then super-resolved frame by frame with RealESRGAN_x4plus_anime_6B for 1080p/2160p delivery. No girl or TV cameo is included, and the mobile, Save-Data, and reduced/off fallback boundaries are unchanged.",
        "ja": "デスクトップ Home の朝・昼・夕方・夜の壁紙を、ユーザーが確認した初版 MiniMax H3 の全画面モーションへ切り替え、第二版の局所 mask／gain 合成を廃止しました。各動画を全画面の往復ループに整え、双方向オプティカルフローで 48fps・全248フレームへ補間してから、RealESRGAN_x4plus_anime_6B でフレームごとに超解像し、1080p／2160p を用意しています。少女やテレビの cameo は含まず、モバイル、Save-Data、reduced／off のフォールバック条件も変わりません。"
      }
    },
    {
      "article_id": "seed-update-2026-08-11-ambient-wallpaper-bfcache-fix",
      "slug": "2026-08-11-ambient-wallpaper-bfcache-fix",
      "category": "site-updates",
      "tags": ["网站更新", "壁纸", "可靠性", "BFCache", "无障碍"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-11T03:35:00.000Z",
      "updated_at": "2026-08-11T03:35:00.000Z",
      "published_at": "2026-08-11T03:35:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.11",
      "title": {
        "zh": "修复动态壁纸的历史返回恢复",
        "en": "Ambient Wallpaper Recovery After History Navigation",
        "ja": "履歴移動後の動画壁紙復帰を修正"
      },
      "summary": {
        "zh": "修复桌面 Home 动态壁纸在浏览器历史返回或 BFCache 恢复后可能停留在静态图的问题。恢复页面时，旧的 off 状态曾先被主模块读取，随后 ui-motion 写回 full 却没有触发壁纸重同步；现在 motion mode、运行时 ready 与 pageshow 都会重新协调视频状态。手机、low performance、Save-Data、reduced／off 的零视频请求策略保持不变。",
        "en": "Fixes a case where the desktop Home ambient wallpaper could remain static after browser history navigation or a BFCache restore. The main module could read a stale off state before ui-motion wrote full back without notifying the wallpaper controller; motion-mode, runtime-ready, and pageshow signals now resynchronize video state. The zero-video-request policy for mobile, low-performance, Save-Data, and reduced/off modes is unchanged.",
        "ja": "ブラウザー履歴の移動や BFCache 復帰後に、デスクトップ Home の動画壁紙が静止画のままになる場合を修正しました。主モジュールが古い off 状態を先に読み、その後 ui-motion が full を書き戻しても壁紙側へ再同期されないことが原因でした。motion mode、runtime ready、pageshow の各タイミングで動画状態を再調整します。モバイル、low performance、Save-Data、reduced／off の動画リクエストを行わない方針は変わりません。"
      }
    },
    {
      "article_id": "seed-update-2026-08-11-video-link-autofill",
      "slug": "2026-08-11-video-link-autofill",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "视频区", "MCP", "安全"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-11T00:20:00.000Z",
      "updated_at": "2026-08-11T00:20:00.000Z",
      "published_at": "2026-08-11T00:20:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.11",
      "title": {
        "zh": "一条视频链接即可交给 AI 发布",
        "en": "Publish a Video with AI from One Link",
        "ja": "動画リンク1本だけでAIから公開"
      },
      "summary": {
        "zh": "既有 video_publish 的 0.4.0 候选把必填输入缩到 operationId 和 YouTube／Bilibili／b23.tv 链接；标题、简介、作者、发布时间与官方封面可由服务端有界补全，调用仍直接公开且不传输视频文件。精确生产版本与真实 OAuth 验收仍待部署后确认。",
        "en": "The 0.4.0 candidate narrows the existing video_publish tool to an operationId and a YouTube, Bilibili, or b23.tv link. The server can fill bounded title, description, author, publication time, and official cover metadata while the call still publishes directly and never transfers the video file. The exact production version and real OAuth acceptance remain pending deployment.",
        "ja": "既存の video_publish を拡張する 0.4.0 候補では、必須入力が operationId と YouTube／Bilibili／b23.tv リンクだけになります。タイトル、説明、作者、公開日時、公式サムネイルはサーバーが限定的に補完でき、呼び出しは従来どおり直接公開し、動画ファイルは転送しません。正確な本番版と実 OAuth 検証はデプロイ後に確認します。"
      }
    },
    {
      "article_id": "seed-update-2026-08-10-h3-ambient-wallpapers-4k",
      "slug": "2026-08-10-h3-ambient-wallpapers-4k",
      "category": "site-updates",
      "tags": ["网站更新", "壁纸", "MiniMax H3", "4K", "超分", "无障碍"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-10T08:10:00.000Z",
      "updated_at": "2026-08-10T08:10:00.000Z",
      "published_at": "2026-08-10T08:10:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.10",
      "title": {
        "zh": "四时段轻动态壁纸与 4K 超分",
        "en": "Four Ambient Wallpapers with 4K Super-Resolution",
        "ja": "4時間帯の微動壁紙と4K超解像"
      },
      "summary": {
        "zh": "桌面 Home 的 morning／day／dusk／night 壁纸加入本地 MiniMax H3 生成的约 5 秒无缝轻动态，只让树冠和真实水面克制变化，并保留慢漂云层与夜间微弱星光。当前主题按物理尺寸只请求 1080p 或 2160p；4K 静态底图先用官方 RealESRGAN 动漫模型一次超分，再叠局部动态，避免逐帧超分闪烁。手机、低性能、Save-Data 与 reduced／off 不请求视频，静态图永久兜底。",
        "en": "The morning, day, dusk, and night wallpapers on desktop Home now have subtle seamless loops of about five seconds generated locally with MiniMax H3. Motion is limited to restrained tree-canopy and real-water changes, alongside the existing slow clouds and faint night stars. Only the current theme requests a 1080p or 2160p file based on physical display size. For 4K, each static base is super-resolved once with the official RealESRGAN anime model before local motion is composited, avoiding per-frame upscaling flicker. Mobile, low-performance, Save-Data, and reduced/off modes make no video requests and always keep the static wallpaper fallback.",
        "ja": "デスクトップ Home の朝・昼・夕方・夜の壁紙に、ローカル MiniMax H3 で生成した約5秒の穏やかなシームレス動画を追加しました。動きは樹冠と実際の水面の小さな変化に限定し、既存のゆっくり流れる雲と夜の弱い星光も保ちます。現在のテーマだけが物理表示サイズに応じて 1080p または 2160p を要求します。4K は静止背景を公式 RealESRGAN アニメモデルで1回だけ超解像化してから局所動画を合成し、フレームごとの超解像によるちらつきを防ぎます。モバイル、low、Save-Data、reduced／off は動画を要求せず、常に静止壁紙へフォールバックします。"
      }
    }
  ]
});
