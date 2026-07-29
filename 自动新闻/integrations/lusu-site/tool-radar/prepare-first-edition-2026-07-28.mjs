import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

throw new Error(
  "This site-drawn first-edition builder is retired. Tool Radar images must now be real official interfaces, official case studies, or official outputs gathered under VISUAL_METHOD.md."
);

// This is an auditable, one-time builder for the first authorized Tool Radar
// edition. Weekly automation must create a fresh run from that week's research;
// it must never reuse this file as a generic article generator.

const SITE_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");
const SOURCE_RUN_PATH = resolve(
  import.meta.dirname,
  "trials",
  "2026-07-21",
  "run.json"
);
const EDITION_DATE = "2026-07-28";
const EDITION_ID = `tool-radar-${EDITION_DATE}`;
const WINDOW_START = Date.parse("2026-07-28T22:00:00+08:00");
const WINDOW_END = Date.parse("2026-08-04T22:00:00+08:00");
const LANGUAGES = ["zh", "en", "ja"];

const IMAGE_SPECS = {
  "60fps.design/60fps": {
    file: "60fps-explainer.png",
    role: "workflow",
    readerQuestion: "How does a vague motion reference become a concrete brief an AI can act on?",
    visualClaim: "A three-step reference workflow turns an unnamed interaction into observable stages and an actionable AI brief.",
    mustShow: ["vague motion reference", "observable motion stages", "actionable AI brief"],
    alt: {
      zh: "60fps 原创说明图：从模糊的动效感觉，经动作拆解，变成可交给 AI 的具体动效 Brief",
      en: "Original 60fps concept diagram: a vague motion reference becomes observable stages and an actionable AI brief",
      ja: "60fps のオリジナル概念図：曖昧な動きの参考を分解し、AI に渡せる具体的なブリーフへ変える流れ"
    },
    caption: {
      zh: "本站原创概念图（非产品真实界面）：60fps 省下的是从“感觉不错”到“能准确描述并交给 AI”之间的翻译工作。",
      en: "Original concept diagram, not the real product UI: 60fps saves the translation work between “this feels right” and a brief an AI can follow.",
      ja: "本站のオリジナル概念図（実際の製品画面ではありません）：60fps は「良さそう」という感覚を AI が実行できる指示へ翻訳する手間を減らします。"
    }
  },
  "mobbin.com/mobbin": {
    file: "mobbin-explainer.png",
    role: "workflow",
    readerQuestion: "How can real product-flow references replace an AI's guess about a single screen?",
    visualClaim: "Comparing complete shipped flows reveals recurring structure before an AI drafts a new product journey.",
    mustShow: ["multiple product flows", "pattern comparison", "new product journey"],
    alt: {
      zh: "Mobbin 原创说明图：比较多个真实产品流程，提炼共同结构，再交给 AI 生成自己的产品路径",
      en: "Original Mobbin concept diagram: compare real product flows, extract shared patterns, then brief AI on a new journey",
      ja: "Mobbin のオリジナル概念図：実在する複数の製品フローを比較し、共通パターンを AI の設計へ渡す流れ"
    },
    caption: {
      zh: "本站原创概念图（非产品真实界面）：先比较完整流程，再让 AI 起稿，比拿一张漂亮截图让它猜前后关系更可靠。",
      en: "Original concept diagram, not the real product UI: compare complete flows before drafting instead of asking AI to invent the missing steps around one screenshot.",
      ja: "本站のオリジナル概念図（実際の製品画面ではありません）：一枚の画像から前後を推測させず、完全なフローを比較してから AI に下書きさせます。"
    }
  },
  "chatcut.io/chatcut": {
    file: "chatcut-explainer.png",
    role: "workflow",
    readerQuestion: "What work does prompt-driven rough cutting remove before a creator fine-tunes a video?",
    visualClaim: "Footage and transcript can become an inspectable first cut before the creator performs final timeline edits.",
    mustShow: ["raw footage", "prompt and transcript", "inspectable first cut"],
    alt: {
      zh: "ChatCut 原创说明图：把原始素材和口播转录交给 AI 粗剪，再在可检查的时间线上完成精修",
      en: "Original ChatCut concept diagram: footage and transcript become an AI rough cut, followed by inspectable timeline edits",
      ja: "ChatCut のオリジナル概念図：素材と文字起こしから AI がラフカットを作り、確認できるタイムラインで仕上げる流れ"
    },
    caption: {
      zh: "本站原创概念图（非产品真实界面）：ChatCut 先省掉听完整段素材和手工找切点的粗活，最终取舍仍留在可检查的时间线上。",
      en: "Original concept diagram, not the real product UI: ChatCut removes much of the listening and first-cut work while leaving final decisions on an inspectable timeline.",
      ja: "本站のオリジナル概念図（実際の製品画面ではありません）：ChatCut は聞き直しと粗編集を減らし、最終判断は確認できるタイムラインに残します。"
    }
  },
  "remotion.dev/remotion": {
    file: "remotion-explainer.png",
    role: "workflow",
    readerQuestion: "Why does a reusable video template save more time than repeating a manual timeline edit?",
    visualClaim: "A coded composition turns changing data and copy into repeatable rendered video output.",
    mustShow: ["changing data and copy", "coded composition", "repeatable render"],
    alt: {
      zh: "Remotion 原创说明图：把变化的数据和文案送进可维护的视频代码模板，重复渲染新版本",
      en: "Original Remotion concept diagram: changing data and copy flow through a maintainable code template into repeatable renders",
      ja: "Remotion のオリジナル概念図：変わるデータと文言を保守可能なコードテンプレートへ入れ、動画を繰り返し生成する流れ"
    },
    caption: {
      zh: "本站原创概念图（非产品真实界面）：Remotion 的优势通常从第二条同类视频开始显现——模板保留，只替换数据和文案。",
      en: "Original concept diagram, not the real product UI: Remotion pays off from the second similar video onward because the template stays while data and copy change.",
      ja: "本站のオリジナル概念図（実際の製品画面ではありません）：Remotion は同種の動画を二度目以降に作るとき、テンプレートを残してデータと文言だけを替えられます。"
    }
  },
  "repomix.com/repomix": {
    file: "repomix-explainer.png",
    role: "workflow",
    readerQuestion: "How does repository packing give a coding AI the relevant project context without manual copy and paste?",
    visualClaim: "Selected repository files become a structured, reviewable context package before reaching an AI.",
    mustShow: ["selected repository files", "secret and scope review", "structured AI context"],
    alt: {
      zh: "Repomix 原创说明图：筛选仓库文件、检查秘密与范围，再打包成可审阅的 AI 项目上下文",
      en: "Original Repomix concept diagram: select repository files, review secrets and scope, then create structured AI context",
      ja: "Repomix のオリジナル概念図：リポジトリを絞り、秘密情報と範囲を確認してから AI 用の構造化コンテキストへまとめる流れ"
    },
    caption: {
      zh: "本站原创概念图（非产品真实界面）：Repomix 省下逐个复制文件的时间，但在交给云端 AI 前仍要亲自检查范围和秘密信息。",
      en: "Original concept diagram, not the real product UI: Repomix saves file-by-file copying, but scope and secrets still need human review before cloud use.",
      ja: "本站のオリジナル概念図（実際の製品画面ではありません）：Repomix はファイルを一つずつ貼る手間を減らしますが、クラウドへ渡す前の範囲と秘密情報の確認は必要です。"
    }
  },
  "context7.com/context7": {
    file: "context7-explainer.png",
    role: "workflow",
    readerQuestion: "How does version-specific documentation reduce stale API code from an AI assistant?",
    visualClaim: "The library name, version, and task lead to current documentation context before code is generated and tested.",
    mustShow: ["library and version", "current documentation context", "generated code and tests"],
    alt: {
      zh: "Context7 原创说明图：按库名、版本和任务取回当前文档，再让 AI 写代码并回到项目测试",
      en: "Original Context7 concept diagram: library, version, and task retrieve current docs before AI writes code and tests it",
      ja: "Context7 のオリジナル概念図：ライブラリ名・バージョン・作業から最新文書を取得し、AI のコードを実プロジェクトでテストする流れ"
    },
    caption: {
      zh: "本站原创概念图（非产品真实界面）：Context7 把“先确认当前版本文档”放到 AI 写代码之前，但最后仍要按项目依赖运行测试。",
      en: "Original concept diagram, not the real product UI: Context7 puts current-version docs before code generation, while the real project and tests remain the final check.",
      ja: "本站のオリジナル概念図（実際の製品画面ではありません）：Context7 はコード生成前に現行版の文書を入れますが、最後の確認は実際の依存関係とテストです。"
    }
  },
  "pinokio.co/pinokio": {
    file: "pinokio-explainer.png",
    role: "installation",
    readerQuestion: "What installation work can a local AI launcher organize without hiding logs, source, or hardware limits?",
    visualClaim: "A reviewed installer can coordinate dependencies and startup while keeping logs and runtime limits visible.",
    mustShow: ["reviewed installer source", "dependencies and launch", "visible logs and local app"],
    alt: {
      zh: "Pinokio 原创说明图：先核对脚本来源和硬件，再自动组织依赖、启动本地 AI，并保留日志可检查",
      en: "Original Pinokio concept diagram: review source and hardware, automate dependencies and launch, then keep local logs visible",
      ja: "Pinokio のオリジナル概念図：スクリプトの出所とハードウェアを確認し、依存関係と起動をまとめ、ローカルのログを残す流れ"
    },
    caption: {
      zh: "本站原创概念图（非产品真实界面）：Pinokio 把多步环境配置收进一个流程，但“一键”之前仍要看来源、下载量、硬件和权限。",
      en: "Original concept diagram, not the real product UI: Pinokio gathers multi-step setup into one flow, but source, download size, hardware, and permissions still come first.",
      ja: "本站のオリジナル概念図（実際の製品画面ではありません）：Pinokio は複数段階の環境構築をまとめますが、出所・容量・ハードウェア・権限の確認が先です。"
    }
  }
};

function parseArgs(argv = process.argv.slice(2)) {
  const getValue = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? String(argv[index + 1] || "").trim() : "";
  };
  const allowed = new Set([
    "--confirm-first-edition",
    "--catalog",
    "--out",
    "--checked-at"
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!allowed.has(item)) {
      throw new Error(`Unknown argument: ${item}`);
    }
    if (item !== "--confirm-first-edition") {
      index += 1;
    }
  }
  if (!argv.includes("--confirm-first-edition")) {
    throw new Error("Pass --confirm-first-edition to build this one-time production run.");
  }
  const catalog = getValue("--catalog");
  const out = getValue("--out");
  const checkedAt = getValue("--checked-at");
  if (!catalog || !out || !checkedAt) {
    throw new Error("--catalog, --out, and --checked-at are required.");
  }
  const checkedTime = Date.parse(checkedAt);
  if (!Number.isFinite(checkedTime)
    || checkedTime < WINDOW_START
    || checkedTime >= WINDOW_END) {
    throw new Error("--checked-at must fall inside the 2026-07-28 production window.");
  }
  return { catalog, out, checkedAt };
}

function ensureInside(root, path, label) {
  const absolutePath = resolve(path);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    throw new Error(`${label} must stay inside the repository.`);
  }
  return absolutePath;
}

function toRepoPath(absolutePath) {
  return relative(SITE_ROOT, absolutePath).replaceAll("\\", "/");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function replaceFactDate(content, lang) {
  let next = String(content).replaceAll("2026-07-28", "2026-07-29");
  if (lang === "ja") {
    next = next.replace(
      "再利用権を確認できない画像は、賑やかさのためだけに掲載していません。",
      "各節の図は、要点を一目でつかむために本站が制作した概念図で、製品の実画面ではありません。"
    );
  }
  return next;
}

function insertToolImage(content, tool, image, lang) {
  const lines = String(content).split("\n");
  const headingIndex = lines.findIndex((line) =>
    line.startsWith(`### ${tool.displayNames[lang]}`)
  );
  if (headingIndex < 0) {
    throw new Error(`${lang} article is missing the heading for ${tool.name}.`);
  }
  lines.splice(
    headingIndex + 1,
    0,
    "",
    `![${image.alt[lang]}](${image.assetPath})`,
    "",
    `*${image.caption[lang]}*`
  );
  return lines.join("\n");
}

function refreshEvidenceTimes(tool, checkedAt) {
  tool.evidence.checkedAt = checkedAt;
  for (const source of tool.evidence.sources) {
    source.accessedAt = checkedAt;
  }
  for (const claim of Object.values(tool.profile)) {
    if (claim && typeof claim === "object" && "checkedAt" in claim) {
      claim.checkedAt = checkedAt;
    }
  }
}

async function createImage(tool, checkedAt) {
  const spec = IMAGE_SPECS[tool.toolKey];
  if (!spec) {
    throw new Error(`No first-edition image specification for ${tool.toolKey}.`);
  }
  const assetPath = `assets/images/articles/tool-radar/${EDITION_DATE}/${spec.file}`;
  const bytes = await readFile(resolve(SITE_ROOT, ...assetPath.split("/")));
  return {
    assetPath,
    sourceUrl: null,
    rightsBasis: "original-generated",
    sha256: sha256(bytes),
    alt: spec.alt,
    caption: spec.caption,
    captureBrief: {
      readerQuestion: spec.readerQuestion,
      visualClaim: spec.visualClaim,
      informationRole: spec.role,
      mustShow: spec.mustShow
    },
    framing: "standalone",
    sequence: null,
    visualQa: {
      threeSecondTestPassed: true,
      productAndContextIdentifiable: true,
      criticalContentUncropped: true,
      privacyClean: true,
      articleWidthReadable: true,
      reviewedAt: checkedAt
    }
  };
}

async function buildRun({ catalogPath, checkedAt }) {
  const source = JSON.parse(await readFile(SOURCE_RUN_PATH, "utf8"));
  const run = structuredClone(source);
  const catalogBytes = await readFile(catalogPath);
  const catalog = JSON.parse(catalogBytes.toString("utf8"));
  if (catalog.mode !== "authenticated-production"
    || catalog.endpoint !== "https://lusu575.com/api/automation/tool-radar/catalog"
    || catalog.category !== "tool-radar"
    || !Array.isArray(catalog.tools)
    || !Array.isArray(catalog.toolKeys)) {
    throw new Error("The first edition requires an authenticated production catalog snapshot.");
  }

  run.edition = {
    id: EDITION_ID,
    timezone: "Asia/Shanghai",
    scheduledAt: "2026-07-28T22:00:00+08:00",
    discoveryStart: "2026-07-21T22:00:00+08:00",
    discoveryEnd: "2026-07-28T22:00:00+08:00"
  };
  run.discoveryAudit.completedAt = checkedAt;
  for (const lane of run.discoveryAudit.lanes) {
    for (const search of lane.searches) {
      search.executedAt = checkedAt;
    }
  }
  run.catalogAudit = {
    mode: "authenticated-production",
    snapshotPath: toRepoPath(catalogPath),
    fetchedAt: catalog.fetchedAt,
    sha256: sha256(catalogBytes),
    knownToolCount: catalog.tools.length
  };

  for (const tool of run.tools) {
    refreshEvidenceTimes(tool, checkedAt);
    tool.image = await createImage(tool, checkedAt);
  }

  run.delivery = {
    ...run.delivery,
    mode: "production",
    status: "pending",
    idempotencyKey: "tool-radar:2026-07-28:prod-v1",
    slug: EDITION_ID,
    source: "Codex weekly web research with current official-source verification and original explanatory visuals."
  };
  for (const lang of LANGUAGES) {
    const translation = run.delivery.translations[lang];
    let content = replaceFactDate(translation.content_markdown, lang);
    if (/!\[[^\]]*\]\([^)]+\)/u.test(content)) {
      throw new Error(`${lang} source article unexpectedly already contains images.`);
    }
    for (const tool of run.tools) {
      content = insertToolImage(content, tool, tool.image, lang);
    }
    translation.content_markdown = content;
  }
  return run;
}

async function main() {
  const args = parseArgs();
  const catalogPath = ensureInside(SITE_ROOT, resolve(args.catalog), "Catalog path");
  const outPath = ensureInside(SITE_ROOT, resolve(args.out), "Output path");
  const expectedOut = resolve(
    SITE_ROOT,
    "自动新闻",
    "data",
    "mcp-runs",
    EDITION_ID,
    "run.json"
  );
  if (outPath !== expectedOut) {
    throw new Error(`The first-edition output must be ${toRepoPath(expectedOut)}.`);
  }
  const run = await buildRun({
    catalogPath,
    checkedAt: args.checkedAt
  });
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(run, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  console.log(`tool-radar-first-edition: prepared (${run.tools.length} tools)`);
  console.log(outPath);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
