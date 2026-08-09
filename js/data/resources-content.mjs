// Tools catalog fallback data, loaded with the internal resources route.
export const resourcesContent = Object.freeze({
  "resources": [
    {
      "category": 0,
      "toolId": "whiteboard",
      "capabilityDomain": "whiteboard",
      "iconSrc": "assets/images/generated-icons/whiteboard.png?v=20260730-online-whiteboard-r1",
      "version": "v1.0.7",
      "updated": "2026.08.06",
      "external": false,
      "showReadyStatus": false,
      "url": "/tools/whiteboard/",
      "title": {
        "zh": "在线画板",
        "en": "Online Whiteboard",
        "ja": "オンラインホワイトボード"
      },
      "desc": {
        "zh": "无需登录即可进入公共画板或密码房，与其他访客实时绘画；授权后的本地 CLI／MCP Agent 也可安全读取场景、追加图形并导出作品。",
        "en": "Join public or password rooms without signing in and draw together in real time. Authorized local CLI/MCP agents can also read scenes, append shapes, and export work safely.",
        "ja": "ログインせずに公開ボードや合言葉の部屋で共同描画できます。認可済みのローカル CLI／MCP Agent は、場面の読取・図形追加・安全な書き出しにも対応します。"
      },
      "actionLabel": {
        "zh": "打开",
        "en": "Open",
        "ja": "開く"
      },
      "tags": [
        {
          "zh": "无需登录",
          "en": "No sign-in",
          "ja": "ログイン不要"
        },
        {
          "zh": "实时协作",
          "en": "Real-time",
          "ja": "リアルタイム"
        },
        {
          "zh": "手机与电脑",
          "en": "Mobile + desktop",
          "ja": "スマホ・PC"
        }
      ]
    },
    {
      "category": 0,
      "toolId": "quick-transfer",
      "capabilityDomain": "transfer",
      "action": "quick-transfer",
      "iconSrc": "assets/images/generated-icons/quick-transfer.png?v=20260719-content-experience-fixes-r1",
      "version": "v1.0.9",
      "retention": {
        "zh": "24 小时",
        "en": "24 hours",
        "ja": "24時間"
      },
      "updated": "2026.08.09",
      "external": false,
      "title": {
        "zh": "临时互传",
        "en": "Quick Transfer",
        "ja": "一時転送"
      },
      "desc": {
        "zh": "登录后可在口令房间中发送浏览器端 AES-GCM 加密文字，以及通过 HTTPS、私有 R2 和服务端鉴权保护的图片、视频与文件；内容在发布完成 24 小时后失效。",
        "en": "After signing in, share text encrypted in the browser with AES-GCM, plus images, videos, and files protected by HTTPS, private R2 storage, and server-side authorization. Items expire 24 hours after publishing completes.",
        "ja": "ログイン後、合言葉の部屋でブラウザー側で AES-GCM 暗号化したテキストと、HTTPS・非公開 R2・サーバー認可で保護される画像／動画／ファイルを共有できます。内容は公開完了から24時間後に失効します。"
      },
      "actionLabel": {
        "zh": "打开",
        "en": "Open",
        "ja": "開く"
      },
      "tags": [
        {
          "zh": "登录限定",
          "en": "Sign-in required",
          "ja": "ログイン限定"
        },
        {
          "zh": "24小时",
          "en": "24 hours",
          "ja": "24時間"
        },
        {
          "zh": "管理员大文件",
          "en": "Admin large files",
          "ja": "管理者の大容量送信"
        }
      ]
    },
    {
      "category": 0,
      "toolId": "japanese-subtext",
      "capabilityDomain": "japanese-subtext",
      "iconSrc": "tools/japanese-subtext/assets/icons/tool-icon-64.webp",
      "version": "v1.0.3",
      "updated": "2026.07.14",
      "external": false,
      "showReadyStatus": false,
      "url": "/tools/japanese-subtext/",
      "title": {
        "zh": "日语的言外之意",
        "en": "Behind the Japanese",
        "ja": "日本語の裏側"
      },
      "desc": {
        "zh": "通过语气、上下文和人物关系，判断日语对话中真正想表达的意思。",
        "en": "Infer what Japanese speakers really mean through tone, context, and relationships.",
        "ja": "口調、文脈、人間関係から、日本語の会話で本当に伝えたいことを読み取ります。"
      },
      "actionLabel": {
        "zh": "开始",
        "en": "Start",
        "ja": "開始"
      },
      "tags": [
        {
          "zh": "听力训练",
          "en": "Listening",
          "ja": "聴解"
        },
        {
          "zh": "潜台词",
          "en": "Subtext",
          "ja": "含意"
        },
        {
          "zh": "支持（云存档）",
          "en": "Cloud Save Supported",
          "ja": "クラウドセーブ対応"
        }
      ]
    },
    {
      "category": 0,
      "icon": "🧰",
      "version": "v1.0.0",
      "size": "12MB",
      "updated": "2026.06.09",
      "external": false,
      "title": {
        "zh": "示例工具包",
        "en": "Sample Toolkit",
        "ja": "サンプルツールキット"
      },
      "desc": {
        "zh": "用于整理本地 AI 工具的小工具占位。",
        "en": "A placeholder utility for organizing local AI tools.",
        "ja": "ローカルAIツール整理用のサンプル。"
      }
    },
    {
      "category": 2,
      "icon": "📦",
      "version": "v0.2.1",
      "size": "128MB",
      "updated": "2026.06.08",
      "external": true,
      "title": {
        "zh": "VRChat 素材包",
        "en": "VRChat Asset Pack",
        "ja": "VRChat 素材パック"
      },
      "desc": {
        "zh": "较大的素材包建议放网盘、R2 或 GitHub Release。",
        "en": "Large packs can live on cloud drive, R2, or GitHub Releases.",
        "ja": "大きい素材はクラウド、R2、GitHub Releaseに置く想定。"
      }
    },
    {
      "category": 1,
      "icon": "⚙️",
      "version": "v1.3",
      "size": "24KB",
      "updated": "2026.06.07",
      "external": false,
      "title": {
        "zh": "本地模型配置模板",
        "en": "Local Model Config Template",
        "ja": "ローカルモデル設定テンプレート"
      },
      "desc": {
        "zh": "保存常用参数和启动配置的示例文件。",
        "en": "Sample file for common parameters and launch settings.",
        "ja": "よく使うパラメータと起動設定のサンプル。"
      }
    }
  ]
});
