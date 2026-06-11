# 鲁肃个人网站专用Skill

## 用途

本目录是鲁肃个人站的项目专用 Skill，用于保存长期维护规则、强约束和踩坑点。新的 AI / Codex 对话在维护 `lusu575/lusu-personal-site` 时，应优先读取：

```text
skills/lusu-personal-site-skill/SKILL.md
```

`PROJECT_CONTEXT.md` 只保留项目总说明和核心事实；具体规则以本 Skill 为准。

## 当前规则清单

- 每次修改项目后，必须更新 `CHANGELOG.md`。
- 项目信息变化时，必须更新 `PROJECT_CONTEXT.md`。
- 新增长期注意事项、维护规则、踩坑点时，必须同步补充到本 Skill。
- Skill 规则变化时，必须同步更新本 README。
- 保持 Windows XP + Pixel Art + Y2K + 可爱复古互联网桌面风格。
- 可见文案必须维护中文 / English / 日本語。
- 改首页、窗口、任务栏、图标、弹窗、游戏外壳等前端内容时，必须检查手机端适配。
- 聊天室用户内容必须纯文本渲染，不能用 `innerHTML` 插入访客昵称或消息。
- 用户要求只美化、不动功能时，只改视觉层，避免改功能逻辑。
- 用户要求只改文档时，只修改文档文件，不改网站代码、样式、功能或资源。
- Cloudflare Pages Git 自动部署是正式部署链路，不要把 `npx wrangler deploy` 或 `npx wrangler pages deploy .` 写成 Git 自动部署命令。
- 后续新增游戏时，必须在游戏标签或信息里标明中文、English、日本語是否支持。
- 网站切换语言时，游戏区优先展示对应语言。
- 如果游戏不支持当前语言，默认启动英语版本。
- `kittens-game` 语言设置使用 `com.nuclearunicorn.kittengame.language`；`a-dark-room` 简体中文语言参数为 `zh_cn`，并保留 `ignorebrowser=true`。
- 本地验证游戏区应通过静态服务器访问，不要直接打开 `file://`。
- 文章内容保存在 Cloudflare D1，代码保存在 GitHub；正式发布文章应同时写入 zh / en / ja 三种内容。
- 文章系统第一阶段不做自动翻译，不新增翻译按钮、`translate` 或 `retranslate` 接口。
- 文章 Markdown 渲染必须防 XSS，不能把未经处理的 Markdown 或 HTML 直接作为 `innerHTML` 插入页面。
- 后台文章管理接口必须要求 `users.role = admin`，普通登录用户不能管理文章。
- Cloudflare 部署检查命令和期望状态保留在 `SKILL.md`。
- 线上验证要注意 Cloudflare 缓存和 `lusu575.com` / `www.lusu575.com` 双域名缓存差异。
- 修改 `js/main.js`、`css/style.css` 或强视觉资源时，必须同步更新 `index.html` 中的资源 query 版本号，避免线上继续显示旧缓存。
- 右上角“最近更新日期”从 `content.updates` 的最大日期自动生成；新增可见更新时补 `content.updates`，不要恢复写死日期。

## 后续维护方式

当项目出现新的长期规则、反复踩坑点或协作约束时：

1. 更新 `skills/lusu-personal-site-skill/SKILL.md`。
2. 同步更新本 `README.md` 的规则清单或维护方式。
3. 如果项目事实发生变化，同时更新根目录 `PROJECT_CONTEXT.md`。
4. 在根目录 `CHANGELOG.md` 记录本次文档或规则变化。

新对话中可以直接说明：

```text
请先读取 PROJECT_CONTEXT.md 和 skills/lusu-personal-site-skill/SKILL.md，再继续维护项目。
```
