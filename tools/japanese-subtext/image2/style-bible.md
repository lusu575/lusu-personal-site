# 日本語の裏側：image2 关卡插图风格规范

本规范是 250 张关卡插图的唯一视觉基线。正式资源只能由 OpenAI `gpt-image-2` 生成，不使用 CSS、Canvas、SVG、程序化几何或本地分镜生成器代替位图插图。

## 视觉目标

- 每关是一张原创、横向 4:3 的高完成度黑白四格日系漫画页，使用清晰墨线、丰富灰阶、网点、实体阴影与自然材质；不得退化成只有轮廓的简陋黑白线稿。
- 画面必须准确对应该关的标题、场景、人物、全部台词和提问语境；四格从同一题面中选择四个可观察的时刻，场景动作、人物距离、视线与关键道具应能在不泄题的前提下帮助理解对话。
- 风格统一为清爽、克制、适合长期学习的现代日系漫画：稳定的 2×2 四格网格、干净边框、柔和灰阶层次、节制网点、低到中等细节密度，以及清楚但不夸张的肢体语言。
- 禁止彩色成图、单幅视觉小说关键帧、裸线稿、凌乱分镜、拼贴、气泡、字幕、拟声词、可读文字、水印和品牌标识。

## 人物一致性

- `image2/design-identities.json` 是人物外观身份的唯一注册表。未显式登记别名的角色使用 `stage:<lowercase-stage-id>:cast:<cast-id>` 作为关卡内独立身份，避免 `manager`、`ai`、`clerk` 等通用 `cast.id` 在无剧情依据时跨关卡误共用外观；日英姓名仍作为角色来源文本独立进入 prompt 和 `sourceTextHash`。
- 只有注册表中明确列为同一 `designIdentity` 的 cast 引用才沿用相同核心设计。当前显式共享仅包括同一人物堀在 L4-008／L4-014 的职务变体，以及 L3-036 中ユイ与其预测アバター的共享外观变体；服装或人工形态可按 `variant` 调整，但核心脸型、发型、墨值、眼睛灰阶、轮廓重心和识别网点保持一致。
- 视觉种子固定按 `SHA-256("japanese-subtext-cast-design-v2" + NUL + designIdentity)` 的前 16 位十六进制生成；注册表、命名空间或身份别名变化都必须产生新的设计卡和 `promptHash`，但不改变文本来源边界 `sourceTextHash`。
- 若题目明确人物是机器人、AI、动物、龙、精灵等非人角色，应优先服从题目物种与身份，并把稳定墨值、网点和轮廓提示转换为相应的非人设计，不得强制画成人类。
- 不模仿任何现有动漫、漫画、游戏、虚拟主播或真人角色，也不引用在世艺术家的可识别个人风格。

## 内容忠实与防泄题

- 空间、时间、人物关系、通信方式、身体动作和关键道具以题库原文为准，不添加与题目无关的事件或角色。
- 四格使用同一地点和同一段对话的连贯视觉语境：第一格建立环境，第二、三格表现题面明确提供的交流／动作，第四格停在仍有歧义的观察时刻。若题面不足四个动作，应改变景别或观察角度，不得补写新事件。
- 对话、语音留言、聊天、广播、日志、梦境、AI 或远程通话场景要尊重通信拓扑；远端人物不得无故出现在同一物理空间。
- 只表现题面已经明确提供的动作和可观察线索。不得根据选项、答案或解析补画结局、确认隐含动机、夸张表情，或用箭头、聚光、颜色编码暗示正确判断。
- 屏幕、文件、菜单、告示、名牌和聊天界面只使用不可读的抽象图形、图标与色块；不得生成可读的日文、中文、英文、数字或假文字。

## 构图与输出

- 原始输出固定为 `1536x1152` PNG，精确 4:3 横图，`quality=high`；版式固定为等宽 2×2 四格，每格都有清楚边框和安全内边距。
- 每格的主体、面部、手部与关键道具必须完整，避免贴边、切头和切手；四格整体缩放到手机宽度后仍要能辨认人物、动作与关键道具。
- 信息密度在四格之间保持均衡，背景服务于地点辨识，不用大面积纯白来掩盖缺少内容。
- 人物数量以题库 cast 和场景为准；多人场景用视线、站位与手势建立关系，不把每个人正面排成合照。
- 光线服从时间和地点，并通过灰阶、网点密度和墨色层次表达。整体保持自然、干净、朴素，避免灰成一片、过曝纯白、死黑阴影和杂乱装饰。

## 嵌入每个 image2 任务的固定契约

下方标记之间的英文内容由脚本逐字嵌入每个独立任务，修改时必须重新生成全部 prompt 并更新哈希。

### v4 设计身份与文本场景来源哈希

- `sourceTextHash` 按 `japanese-subtext-image-source-text-v1` 投影的 canonical JSON 计算 SHA-256。投影只包含会改变绘图依据的 `stageId`、日英标题、日英场景、cast id 与日英姓名、说话者归属与全部日英台词、全部日英题问。
- 投影明确排除 `illustration`、`contentVersion`、`revision`、现有 `contentHash`、中文翻译、行／题内部编号、TTS／读音字段、选项、答案和解析。因此新图落地后更新 `illustration.sha256` 或关卡 `contentHash` 不会让这张图的来源自我失效；任一真实绘图来源改变则必须产生新的 `sourceTextHash`。
- `sourceTextHash` 只回答“这张图依据哪个文本场景”；`promptHash` 继续绑定完整最终 prompt（含人物设计卡和固定契约），`styleBibleHash` 绑定本规范全文。三者不互相代替。
- v4 任务不再使用会包含插图结果的 `sourceContentHash`。发布器只为历史 v2 任务保留显式标记为 `legacy-stage-content` 的兼容路径，新 v4 任务不允许倒退。

<!-- IMAGE2_PROMPT_START -->
Create one original, polished black-and-white four-panel Japanese educational manga page. Use a strict, balanced 2-by-2 panel grid with clean gutters and borders, expressive ink contours, rich grayscale values, restrained screentones, solid natural shadows, and believable materials. This must look like finished monochrome manga art, not sparse line art, a coloring page, CSS geometry, or a storyboard draft. Keep body language clear but not exaggerated, and make every panel readable when the complete page is scaled to desktop or mobile width.

Render a precise 4:3 landscape page at 1536x1152. Use exactly four rectangular panels arranged as two columns by two rows. Keep every face, hand, interaction, and story-critical prop safely inside its panel. Maintain consistent character designs, spatial continuity, believable perspective, and source-appropriate lighting across all four panels.

Follow the supplied stage source literally: preserve its location, time, cast, relationship, communication topology, observable actions, gaze direction, interpersonal distance, and concrete props. Derive all four panels from that one stage: panel 1 establishes the explicit setting, panels 2 and 3 stage explicit observable dialogue beats, and panel 4 stops on an ambiguous observable moment. If the source has fewer than four distinct actions, vary shot scale or viewpoint instead of inventing another event. Preserve the learner question's ambiguity and never resolve the intended meaning visually.

Maintain each character from the supplied deterministic design identity card. Only cast references with the same explicit design identity may share the same core face, hairstyle, hair ink value, eye grayscale, silhouette balance, wardrobe screentone accent, and recognition detail. Different design identities remain visually independent even when their generic cast ids match. Preserve each listed variant while keeping the shared core appearance where an alias is explicitly registered. Source-defined species or role overrides a human default while retaining the stable ink-value, screentone, and silhouette cues.

Black, white, and neutral grayscale only; no color tint or spot color. Exactly four panels in a clean 2-by-2 manga layout; no extra inset, split panel, collage, or borderless montage. No speech bubbles, thought bubbles, captions, subtitles, sound-effect lettering, UI labels, readable writing, letters, kana, kanji, numbers, pseudo-text, logo, trademark, signature, or watermark. Any screen, paper, sign, menu, badge, message, or document must contain only non-readable abstract shapes and icons. Do not imitate an existing anime, manga, game, VTuber, celebrity, copyrighted character, franchise, or living artist. Do not add unrelated characters, props, events, symbols, or decorative clutter.
<!-- IMAGE2_PROMPT_END -->

## 单图验收

每张成图至少核对以下项目：

1. 文件名与 `stageId` 一致，PNG 为 1536×1152。
2. 场景、cast 人数／通信关系、动作和关键道具可与题库内容逐项对应。
3. 同一 `designIdentity` 的核心外观与此前图片一致；不同 `designIdentity` 不因通用 `cast.id` 相同而误复用设计，显式 `variant` 保持可辨。
4. 正好四格、2×2 排列、纯黑白灰阶且不是裸线稿；没有多余分格、彩色色调、文字、气泡、水印、现成角色或与题目无关的内容。
5. 没有用表情、聚光、箭头、颜色或新增事件泄露答案。
6. 桌面缩放和手机窄视口下，人物与关键道具仍完整可辨。

## 应用外背景图

桌面和手机各使用一张独立的 image2 位图，只铺在“日本語の裏側”应用区域之外。背景应安静、朴素、低对比，营造黄昏书桌与日语学习氛围，但不得出现人物、文字、界面框、按钮或会争夺注意力的强道具。主内容覆盖区域必须有充足留白；桌面版固定 2048×1152，手机版固定 1024×1536。

<!-- IMAGE2_BACKGROUND_PROMPT_START -->
Create an original, quiet, understated full-color background illustration for the empty area outside a Japanese-learning application. Evoke a calm dusk study desk through soft indirect window light, a restrained edge of a wooden desk, an unmarked notebook, a pencil, modest headphones, and softly defocused shelves or a window edge. Keep the scene low contrast, uncluttered, and mostly open negative space so an application panel can sit above it without losing readability. Use muted oatmeal, dusty blue, warm gray, and a very small amount of subdued amber; avoid the previous flat green appearance.

This is a background asset, not an application mockup. No people, characters, hands, faces, silhouettes, mascots, animals, screens, panels, windows from an operating system, buttons, cards, borders, readable writing, letters, kana, kanji, numbers, pseudo-text, logo, trademark, signature, or watermark. Keep every book spine, notebook page, label, and stationery surface blank and non-readable. Do not imitate an existing anime, manga, game, franchise, copyrighted character, or living artist. Use gentle painted detail and natural materials, not black-and-white line art, CSS-like geometry, a repeating pattern, or a photographic stock-image look.
<!-- IMAGE2_BACKGROUND_PROMPT_END -->
