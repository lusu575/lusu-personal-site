// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
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
    },
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
    }
  ]
});
