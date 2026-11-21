import { content } from '../data/content.mjs';
import { articleCategoryLabels, tagLabels } from '../data/article-labels.mjs';

const PROGRESS_STORAGE_KEY = 'pond_kb_reading_progress_v1';

// Rich trilingual fallback articles used when /api/articles is unavailable (local static preview)
const LOCAL_SEED_ARTICLES = [
  {
    article_id: 'seed-kb-ai-workflow',
    slug: 'ai-workflow-from-idea-to-prototype',
    category: 'ai',
    tags: ['AI', 'Agent', '经验'],
    is_pinned: 1,
    published_at: '2026-11-18T10:00:00.000Z',
    title: {
      zh: '我的 AI 工作流：从想法到可用原型的完整流程',
      en: 'My AI Workflow: From Idea to Working Prototype',
      ja: '私のAIワークフロー：アイデアから動く試作まで'
    },
    summary: {
      zh: '记录如何把需求拆解、上下文文档、多 Agent 协作与自动化回归检查串成可复用的开发流。',
      en: 'How I chain spec decomposition, context docs, multi-agent collaboration, and automated regression checks.',
      ja: '要件分解・コンテキスト文書・複数エージェント連携・自動回帰チェックを一連の流れにまとめた記録。'
    }
  },
  {
    article_id: 'seed-kb-crt-pixel-ui',
    slug: 'retro-crt-pixel-ui-notes',
    category: 'note',
    tags: ['界面', 'UI', '性能'],
    is_pinned: 0,
    published_at: '2026-11-20T14:30:00.000Z',
    title: {
      zh: '复古 CRT 像素风 UI 的实现笔记',
      en: 'Implementation Notes on Retro CRT Phosphor-Dot UI',
      ja: 'レトロCRT蛍光ドット風UIの実装メモ'
    },
    summary: {
      zh: '探讨 WebGL2 荧光点阵量化、扫描线、边缘色散与 120 FPS 零回读管线的工程实践。',
      en: 'Engineering notes on WebGL2 phosphor-dot quantization, scanlines, edge chromatic aberration, and 120 FPS pipelines.',
      ja: 'WebGL2蛍光ドット量子化・走査線・周辺色収差と120 FPSパイプラインの設計メモ。'
    }
  },
  {
    article_id: 'seed-kb-ollama-guide',
    slug: 'local-llm-ollama-getting-started',
    category: 'ai',
    tags: ['AI', '工具', '经验'],
    is_pinned: 0,
    published_at: '2026-11-14T14:20:00.000Z',
    title: {
      zh: '本地运行大语言模型（Ollama）入门指南',
      en: 'Getting Started with Local LLMs Using Ollama',
      ja: 'ローカルLLM（Ollama）入門ガイド'
    },
    summary: {
      zh: '从量化档位选择、显存估算到本地 OpenAI 兼容接口接入的一站式速查笔记。',
      en: 'A practical quickstart covering quantization levels, VRAM budgets, and local OpenAI-compatible endpoints.',
      ja: '量子化レベルの選び方、VRAM見積もり、ローカル互換API接続までの実践ガイド。'
    }
  },
  {
    article_id: 'seed-kb-indie-games',
    slug: 'indie-games-currently-playing',
    category: 'note',
    tags: ['游戏', '观察', '体验'],
    is_pinned: 0,
    published_at: '2026-11-12T12:00:00.000Z',
    title: {
      zh: '我最近在玩的几款独立游戏推荐',
      en: 'A Few Indie Games I Have Been Enjoying Lately',
      ja: '最近遊んでいるおすすめインディーゲーム数本'
    },
    summary: {
      zh: '聊一聊猫国建设者、小黑屋等文字增量与极简机制游戏为何让人停不下来。',
      en: 'Why text-driven incremental classics like Kittens Game and A Dark Room remain timeless.',
      ja: 'Kittens GameやA Dark Roomなどの放置・テキスト系名作の魅力を振り返ります。'
    }
  },
  {
    article_id: 'seed-kb-daily-news-1120',
    slug: 'daily-ai-news-2026-11-20',
    category: 'daily-ai-news',
    tags: ['AI', '夜间汇总'],
    is_pinned: 0,
    published_at: '2026-11-20T08:00:00.000Z',
    title: {
      zh: '每日 AI 新闻 · 2026-11-20：端侧推理与多模态工具链更新',
      en: 'Daily AI News · 2026-11-20: Edge Inference & Multimodal Tooling',
      ja: '毎日AIニュース · 2026-11-20：エッジ推論とマルチモーダル基盤'
    },
    summary: {
      zh: '汇总过去 24 小时内模型发布、开源推理引擎优化与开发者工具动态。',
      en: 'A curated 24-hour digest of model releases, inference engine gains, and developer tooling.',
      ja: '過去24時間のモデル公開・推論エンジン最適化・開発者ツール動向をまとめました。'
    }
  },
  {
    article_id: 'seed-kb-daily-news-1119',
    slug: 'daily-ai-news-2026-11-19',
    category: 'daily-ai-news',
    tags: ['AI', 'Agent', '夜间汇总'],
    is_pinned: 0,
    published_at: '2026-11-19T08:00:00.000Z',
    title: {
      zh: '每日 AI 新闻 · 2026-11-19：代码 Agent 基准与 MCP 生态进展',
      en: 'Daily AI News · 2026-11-19: Coding Agent Benchmarks & MCP Ecosystem',
      ja: '毎日AIニュース · 2026-11-19：コードAgent評価とMCPエコシステム'
    },
    summary: {
      zh: '聚焦长上下文代码评审基准、MCP 远程 OAuth 规范实践与开源小模型更新。',
      en: 'Covering long-context code review benchmarks, remote MCP OAuth practices, and compact open models.',
      ja: '長文脈コードレビュー基準、MCPリモートOAuth運用、小型オープンモデルの最新動向。'
    }
  },
  {
    article_id: 'seed-kb-daily-news-1118',
    slug: 'daily-ai-news-2026-11-18',
    category: 'daily-ai-news',
    tags: ['AI', '夜间汇总'],
    is_pinned: 0,
    published_at: '2026-11-18T08:00:00.000Z',
    title: {
      zh: '每日 AI 新闻 · 2026-11-18：WebGPU 浏览器推理与图像生成提速',
      en: 'Daily AI News · 2026-11-18: WebGPU Browser Inference & Faster Diffusion',
      ja: '毎日AIニュース · 2026-11-18：WebGPU推論と画像生成の高速化'
    },
    summary: {
      zh: '梳理浏览器端 WebGPU 推理框架新版本与轻量图像模型蒸馏方案。',
      en: 'Tracking new browser WebGPU inference runtimes and lightweight distilled image models.',
      ja: 'ブラウザWebGPU推論ランタイムの更新と軽量画像モデル蒸留手法のまとめ。'
    }
  },
  {
    article_id: 'seed-kb-tool-radar-1',
    slug: 'tool-radar-mcp-cli-stack',
    category: 'tool-radar',
    tags: ['工具', 'CLI', 'MCP'],
    is_pinned: 0,
    published_at: '2026-11-15T16:00:00.000Z',
    title: {
      zh: '工具雷达：值得放进日常终端的 6 个 MCP 与 CLI 助手',
      en: 'Tool Radar: 6 MCP & CLI Helpers Worth Keeping in Your Terminal',
      ja: 'ツールレーダー：日常の端末に入れたいMCP・CLIツール6選'
    },
    summary: {
      zh: '精选代码打包、文档检索、本地自动化与跨端同步工具，附实测适用场景。',
      en: 'Curated picks for repo packing, doc retrieval, local automation, and cross-device sync.',
      ja: 'リポジトリ梱包・ドキュメント検索・自動化・端末間同期の実用ツールを厳選。'
    }
  },
  {
    article_id: 'seed-kb-tool-radar-2',
    slug: 'tool-radar-webgl-shaders',
    category: 'tool-radar',
    tags: ['工具', '渲染', '性能'],
    is_pinned: 0,
    published_at: '2026-11-10T11:00:00.000Z',
    title: {
      zh: '工具雷达：WebGL2 着色器调试与帧率剖析工具合集',
      en: 'Tool Radar: WebGL2 Shader Debugging & Frame Profiling Toolkit',
      ja: 'ツールレーダー：WebGL2シェーダ検証とフレーム計測ツール集'
    },
    summary: {
      zh: '对比 Spector.js、Chrome GPU 面板与轻量自定义计时器的定位效率。',
      en: 'Comparing Spector.js, Chrome GPU trace panels, and lightweight frame timers.',
      ja: 'Spector.jsやChrome GPUトレース、軽量フレームタイマーの使い分けを比較。'
    }
  },
  {
    article_id: 'seed-kb-guide-password-room',
    slug: 'site-guide-password-room',
    category: 'site-guides',
    tags: ['网站使用指南', '密码房', '匿名聊天室', '在线画板'],
    is_pinned: 0,
    published_at: '2026-11-08T13:00:00.000Z',
    title: {
      zh: '网站使用指南：聊天室与在线画板的密码房怎么用',
      en: 'Website Guide: Using Password Rooms in Chat & Whiteboard',
      ja: 'サイト利用ガイド：チャットとホワイトボードのパスワード部屋'
    },
    summary: {
      zh: '一步步说明双方如何用同一口令进入私密协作房间，以及 24 小时自动清理规则。',
      en: 'Step-by-step guide to joining shared password rooms and understanding the 24-hour auto-expiry rule.',
      ja: '同じ合言葉で非公開ルームに入る手順と24時間自動削除ルールを解説。'
    }
  },
  {
    article_id: 'seed-kb-guide-cloud-save',
    slug: 'site-guide-game-cloud-save',
    category: 'site-guides',
    tags: ['网站使用指南', '游戏区', '云存档', '账号'],
    is_pinned: 0,
    published_at: '2026-11-05T10:30:00.000Z',
    title: {
      zh: '网站使用指南：五款站内小游戏的云存档与跨设备同步',
      en: 'Website Guide: Cloud Saves Across All Five Built-In Games',
      ja: 'サイト利用ガイド：5つの内蔵ゲームのクラウドセーブ同期'
    },
    summary: {
      zh: '介绍登录后每 10 分钟自动同步、手动立即同步与切出页面补同步机制。',
      en: 'How 10-minute auto-sync, manual sync, and page-hide backup keep your progress safe.',
      ja: '10分自動同期・手動同期・ページ離脱時バックアップの仕組みを紹介します。'
    }
  },
  {
    article_id: 'seed-kb-ai-codex-notes',
    slug: 'codex-agent-context-hygiene',
    category: 'ai',
    tags: ['AI', 'Codex', 'Agent', '可靠性'],
    is_pinned: 0,
    published_at: '2026-11-02T17:45:00.000Z',
    title: {
      zh: '给长期维护项目写 AGENTS.md 的几条实用经验',
      en: 'Practical Lessons for Writing AGENTS.md in Long-Lived Repos',
      ja: '長期保守リポジトリ向けAGENTS.md設計の実践メモ'
    },
    summary: {
      zh: '把规则按任务路由拆短、把历史记录移出指令文件，减少上下文噪音并提升稳定性。',
      en: 'Routing rules by task and keeping history out of instruction files to reduce context drift.',
      ja: 'タスク別ルーティングと履歴分離でコンテキストノイズを抑える工夫。'
    }
  },
  {
    article_id: 'seed-kb-note-trilingual',
    slug: 'trilingual-search-nfkc-notes',
    category: 'note',
    tags: ['多语言', '搜索', '标签'],
    is_pinned: 0,
    published_at: '2026-10-28T15:00:00.000Z',
    title: {
      zh: '中英日三语知识库搜索与 NFKC 归一化实践',
      en: 'Trilingual Knowledge Search & NFKC Normalization in Practice',
      ja: '日中英三言語検索とNFKC正規化の実践メモ'
    },
    summary: {
      zh: '解决全角半角符号、跨语言标签检索与多词 AND 过滤的边界情况。',
      en: 'Handling full-width/half-width characters, cross-language tag matching, and multi-token AND queries.',
      ja: '全角半角揺れ、三言語タグ一致、複数語AND検索のエッジケース対策。'
    }
  },
  {
    article_id: 'seed-kb-daily-news-1117',
    slug: 'daily-ai-news-2026-11-17',
    category: 'daily-ai-news',
    tags: ['AI', '夜间汇总'],
    is_pinned: 0,
    published_at: '2026-11-17T08:00:00.000Z',
    title: {
      zh: '每日 AI 新闻 · 2026-11-17：结构化输出与评测自动化趋势',
      en: 'Daily AI News · 2026-11-17: Structured Outputs & Eval Automation',
      ja: '毎日AIニュース · 2026-11-17：構造化出力と評価自動化の動向'
    },
    summary: {
      zh: '汇总 JSON Schema 约束解码更新与持续评测流水线实践案例。',
      en: 'Digest of schema-constrained decoding updates and continuous evaluation pipelines.',
      ja: 'スキーマ制約デコーディングの更新と継続的評価パイプライン事例を整理。'
    }
  },
  {
    article_id: 'seed-kb-tool-radar-3',
    slug: 'tool-radar-static-edge-d1',
    category: 'tool-radar',
    tags: ['工具', '网站', '可靠性'],
    is_pinned: 0,
    published_at: '2026-10-22T11:30:00.000Z',
    title: {
      zh: '工具雷达：Cloudflare Pages + D1 个人站轻量架构复盘',
      en: 'Tool Radar: Lightweight Personal Site Stack on Cloudflare Pages + D1',
      ja: 'ツールレーダー：Cloudflare Pages + D1 軽量個人サイト構成'
    },
    summary: {
      zh: '回顾无构建前端、Pages Functions 接口与 D1 静态种子兜底的维护体验。',
      en: 'Lessons from zero-build static frontend, Pages Functions APIs, and D1 fallback seeds.',
      ja: 'ビルドレス構成・Pages Functions・D1シードフォールバックの運用振り返り。'
    }
  }
];

function getSiteUpdateSeedArticles() {
  const list = Array.isArray(content?.updates) ? content.updates : [];
  return list
    .filter((item) => item && item.slug && item.category === 'site-updates')
    .slice(0, 12)
    .map((item) => ({
      ...item,
      is_pinned: 0
    }));
}

export function getCategoryLabel(category, lang = 'zh') {
  if (category === 'all') {
    return lang === 'en' ? 'All' : lang === 'ja' ? 'すべて' : '全部';
  }
  const entry = articleCategoryLabels[category];
  if (entry) return entry[lang] || entry.zh || category;
  return String(category || '');
}

export function getTagLabel(tag, lang = 'zh') {
  const entry = tagLabels[tag];
  if (entry) return entry[lang] || entry.zh || String(tag);
  return String(tag || '');
}

export function getAllTagVariants(tag) {
  const entry = tagLabels[tag];
  if (!entry) return [String(tag || '')];
  return [String(tag || ''), entry.zh, entry.en, entry.ja].filter(Boolean);
}

export function getLocalizedField(field, lang = 'zh') {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.zh || field.en || field.ja || '';
}

export function formatDateISO(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadReadingProgressMap() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  // Seed one realistic progress item so the progress bar matches the finalized mockup immediately
  return {
    'retro-crt-pixel-ui-notes': 72
  };
}

export function saveReadingProgress(slug, percent) {
  if (!slug) return;
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const map = loadReadingProgressMap();
  map[slug] = clamped;
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage write errors
  }
}

let cachedArticlesPromise = null;

export function loadKnowledgeArticles() {
  if (cachedArticlesPromise) return cachedArticlesPromise;
  cachedArticlesPromise = (async () => {
    // Try live Cloudflare Pages API first when available
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1400);
      const res = await fetch('/api/articles?limit=100', {
        headers: { Accept: 'application/json' },
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (items.length > 0) return items;
      }
    } catch {
      // Static preview server fallback
    }
    return [...LOCAL_SEED_ARTICLES, ...getSiteUpdateSeedArticles()];
  })();
  return cachedArticlesPromise;
}
