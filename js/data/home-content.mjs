// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-08-02-traffic-discovery-monitoring",
      "slug": "2026-08-02-traffic-discovery-monitoring",
      "category": "site-updates",
      "tags": ["网站更新", "流量保护", "SEO", "线上监控", "D1"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-02T08:20:00.000Z",
      "updated_at": "2026-08-02T08:20:00.000Z",
      "published_at": "2026-08-02T08:20:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.08.02",
      "title": {
        "zh": "流量发现与线上监控优化",
        "en": "Traffic Discovery and Production Monitoring",
        "ja": "流入発見性と本番監視の改善"
      },
      "summary": {
        "zh": "减少重复遥测请求并提前收紧 D1 免费额度保护，补齐文章访问留存、三语 sitemap 与文章结构化数据，同时加入低频生产冒烟检查。",
        "en": "Reduces duplicate telemetry requests, reserves more of the D1 free tier, completes article-view retention and multilingual SEO signals, and adds a low-frequency production smoke check.",
        "ja": "重複テレメトリ要求を減らして D1 無料枠の余裕を広げ、記事閲覧の保存期限、多言語 SEO、本番の低頻度スモーク監視を追加しました。"
      }
    },
    {
      "article_id": "seed-update-2026-08-01-whiteboard-calm-efficient-sync",
      "slug": "2026-08-01-whiteboard-calm-efficient-sync",
      "category": "site-updates",
      "tags": ["网站更新", "在线画板", "节省资源", "连接体验", "铅笔草图"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-01T12:50:00.000Z",
      "updated_at": "2026-08-01T12:50:00.000Z",
      "published_at": "2026-08-01T12:50:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.01",
      "title": {
        "zh": "在线画板安静同步与空房休眠",
        "en": "Calmer Whiteboard Sync and Idle-Room Hibernation",
        "ja": "ホワイトボードの静かな同期と空室休止"
      },
      "summary": {
        "zh": "画板 v1.0.2 统一所有房间的铅笔草图默认值，并用边缘自动心跳、后台停放、按变化批处理和空房无周期轮询降低 Cloudflare 用量；短暂重连不再弹大错误。",
        "en": "Whiteboard v1.0.2 gives every room the same pencil-sketch defaults and lowers Cloudflare usage through edge auto-responses, hidden-tab parking, change-only batching, and no recurring empty-room polling; brief reconnects no longer show large errors.",
        "ja": "ホワイトボード v1.0.2 は全ルームで鉛筆スケッチの既定値を統一し、エッジ自動応答、非表示タブの休止、変更時だけの一括同期、空室の定期巡回停止で Cloudflare 使用量を抑えます。短い再接続では大きなエラーを表示しません。"
      }
    },
    {
      "article_id": "seed-update-2026-08-01-whiteboard-reliable-sketch",
      "slug": "2026-08-01-whiteboard-reliable-sketch",
      "category": "site-updates",
      "tags": ["网站更新", "在线画板", "可靠保存", "铅笔草图", "版本治理"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-01T09:55:00.000Z",
      "updated_at": "2026-08-01T09:55:00.000Z",
      "published_at": "2026-08-01T09:55:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.01",
      "title": {
        "zh": "在线画板可靠保存与铅笔草图风",
        "en": "Reliable Whiteboard Saving and Pencil Sketch Style",
        "ja": "ホワイトボードの確実な保存と鉛筆スケッチ風"
      },
      "summary": {
        "zh": "快速绘制现在会合并发送、等待服务端持久化确认并在断线后重传；公共画布持续保留，密码房空置24小时后整房清理，同时加入铅笔草图默认风格和画板、临时互传的独立版本记录。",
        "en": "Rapid drawing is now batched, acknowledged only after durable storage, and retried after disconnects; the public canvas persists, empty password rooms are deleted after 24 hours, and Whiteboard plus Quick Transfer now have independent versions.",
        "ja": "高速描画をまとめて送信し、永続化後の確認と切断時の再送に対応しました。公開キャンバスは保持し、パスワードルームは空室24時間後に全削除します。鉛筆風の既定値と独立版管理も追加しました。"
      }
    },
    {
      "article_id": "seed-update-2026-08-01-service-reliability",
      "slug": "2026-08-01-service-reliability",
      "category": "site-updates",
      "tags": ["网站更新", "账号", "登录", "D1", "稳定性"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-01T07:10:00.000Z",
      "updated_at": "2026-08-01T07:10:00.000Z",
      "published_at": "2026-08-01T07:10:00.000Z",
      "fallbackOnly": true,
      "icon": "games",
      "date": "2026.08.01",
      "title": {
        "zh": "账号与实时工具稳定性修复",
        "en": "Account and Real-Time Tool Reliability Fixes",
        "ja": "アカウントとリアルタイムツールの安定性を修正"
      },
      "summary": {
        "zh": "修复 Cloudflare 密码派生兼容性导致的登录失败，并停止文章种子在冷启动时重复写入 D1，降低账号、匿名身份和在线画板共用数据库时的写入压力。",
        "en": "Fixes sign-in failures caused by a Cloudflare password-derivation incompatibility and stops article seeds from rewriting D1 on cold starts, reducing shared write pressure for accounts, anonymous identity, and Whiteboard.",
        "ja": "Cloudflare のパスワード導出互換性によるログイン失敗を修正し、コールドスタート時の記事 seed による D1 の反復書き込みを止め、アカウント・匿名ID・ホワイトボード共通DBの負荷を下げました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-30-multiplayer-whiteboard",
      "slug": "2026-07-30-multiplayer-whiteboard",
      "category": "site-updates",
      "tags": ["网站更新", "工具区", "在线画板", "实时协作", "匿名身份"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-30T08:30:00.000Z",
      "updated_at": "2026-07-30T08:30:00.000Z",
      "published_at": "2026-07-30T08:30:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.07.30",
      "title": {
        "zh": "工具区多人在线画板上线",
        "en": "Multiplayer Whiteboard Is Live in Tools",
        "ja": "ツールに共同オンラインホワイトボードを追加"
      },
      "summary": {
        "zh": "工具区新增免登录多人在线画板，支持公共与密码房、实时鼠标和临时名字、统一匿名身份、图片、PNG/SVG 导出，以及密码房无人后24小时保留。",
        "en": "Tools now includes a sign-in-free multiplayer whiteboard with public and password rooms, live cursors and temporary names, one shared anonymous identity, images, PNG/SVG export, and 24-hour retention for empty password rooms.",
        "ja": "ツールにログイン不要の共同ホワイトボードを追加しました。公開・パスワードルーム、リアルタイムカーソルと一時名、共通匿名ID、画像、PNG/SVG出力、空室後24時間の保持に対応します。"
      }
    }
  ]
});
