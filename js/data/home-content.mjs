// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-08-10-wallpaper-switch-slim-dawn",
      "slug": "2026-08-10-wallpaper-switch-slim-dawn",
      "category": "site-updates",
      "tags": ["网站更新", "壁纸", "动效", "Image2", "无障碍"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-10T02:30:00.000Z",
      "updated_at": "2026-08-10T04:10:00.000Z",
      "published_at": "2026-08-10T04:10:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.10",
      "title": {
        "zh": "四段壁纸开关的细框晨曦精修",
        "en": "Slim-Rim Dawn Polish for the Four-Stage Wallpaper Switch",
        "ja": "壁紙4段スイッチの細枠・朝焼け調整"
      },
      "summary": {
        "zh": "四段壁纸开关采用更轻薄清晰的陶瓷细框、滚轮环和低位暖橙半日晨雾，让清晨区别于白天。滚轮、场景、天体与四主题 accent 在所有可见桌面公共路由共享同一套可中断动画；整页壁纸 crossfade 与动态云仍由 Home 独占。",
        "en": "The four-stage wallpaper switch now pairs a slimmer, crisper ceramic rim and roller ring with a low warm-orange half sun and dawn mist, clearly separating morning from day. Its roller, scene, celestial body, and four theme accents share one interruptible animation system across every visible desktop public route; full-page wallpaper crossfades and dynamic clouds remain exclusive to Home.",
        "ja": "壁紙4段スイッチは、より薄く鮮明なセラミック細枠とローラーリング、低い暖色の半円日と朝霧で朝を昼から明確に分けます。ローラー、シーン、天体、4テーマの accent は表示中の全デスクトップ公開ルートで同じ中断可能なアニメーションを共有し、ページ全体の壁紙 crossfade と動く雲は Home 専用です。"
      }
    },
    {
      "article_id": "seed-update-2026-08-10-wallpaper-switch-ceramic-roll",
      "slug": "2026-08-10-wallpaper-switch-ceramic-roll",
      "category": "site-updates",
      "tags": ["网站更新", "壁纸", "动效", "Image2", "无障碍"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-10T00:20:00.000Z",
      "updated_at": "2026-08-10T00:20:00.000Z",
      "published_at": "2026-08-10T00:20:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.10",
      "title": {
        "zh": "四段壁纸开关的陶瓷滚动重制",
        "en": "Ceramic Rolling Redesign for the Four-Stage Wallpaper Switch",
        "ja": "壁紙4段スイッチをセラミック調ローリング仕様に再設計"
      },
      "summary": {
        "zh": "四段壁纸开关按参考图重制为暖象牙陶瓷椭圆壳与统一内沿，并换上四个高辨识时段节点。36px 选中轮以可中断 transform 平移，独立外圈按物理距离滚转而内部天体保持正向；晨光上展、两朵白云横移、余晖横向展开、星群上升。键盘／motion-off 即时完成，reduced-motion 不做位置移动，low／Save-Data 跳过 accent。",
        "en": "The four-stage wallpaper switch now follows the reference's warm ivory ceramic oval shell and aligned inner rim, with four more recognizable time stops. A 36px selector travels with an interruptible transform while its independent outer ring rolls by physical distance and the celestial center stays upright. Morning light rises and opens, two white clouds cross during the day, dusk glow spreads sideways, and night stars rise. Keyboard/motion-off changes are immediate, reduced motion removes position travel, and low/Save-Data skips accents.",
        "ja": "壁紙4段スイッチを、参考画像に合わせた暖かなアイボリーのセラミック楕円シェルと揃った内周へ作り直し、4時間帯のノードも識別しやすくしました。36px の選択輪は中断可能な transform で移動し、独立した外周だけが物理距離に応じて回転して中央の天体は正立を保ちます。朝の光は上へ開き、昼には2つの雲が横切り、夕方の残光は横へ広がり、夜の星群は上昇します。keyboard／motion-off は即時、reduced-motion は位置移動なし、low／Save-Data は accent を省略します。"
      }
    }
  ]
});
