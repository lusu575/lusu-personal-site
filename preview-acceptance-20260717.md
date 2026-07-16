# 100 项 UI / UX 优化 Preview 验收表

- 分支：`codex/100-ui-ux-optimizations-20260717`
- 基线 `main`：`1ad379b4e3739b5a9763b9a44b982f5aa9465958`
- Preview 实现提交：`f0ae39de4b68f9e7616004acd9f5dfca748e8fbb`
- Preview URL（预期别名）：[Cloudflare Pages Preview](https://codex-100-ui-ux-optimizations-20260717.lusu-personal-site.pages.dev)（2026-07-17 03:05 SGT 检查仍返回 HTTP 404，尚未上线）
- 缓存 query：`20260717-100-ui-ux-preview-r1`
- 数据边界：只做公开只读页面检查；不在 Preview 上传文件、不发送聊天、不登录、不触发生产 D1 写入。

## 自动校验

- [x] JavaScript / MJS 语法检查。
- [x] 根测试套件。
- [x] 临时互传专项测试。
- [x] 游戏壳层专项测试。
- [x] 日语训练器专项测试。
- [x] `git diff --check`。
- [ ] GitHub Verify（分支已推送；现有工作流仅覆盖 PR / `main`，本分支未产生状态）。
- [ ] Cloudflare Preview 构建（分支已上传；预期别名当前仍为 HTTP 404，尚未确认生成部署）。

## 视口与交互

- [x] 静态守卫：桌面 1440×900。
- [x] 静态守卫：手机 390×844、375×667、320px 窄屏。
- [x] 静态守卫：844×390 横屏与短屏。
- [x] 静态守卫：`prefers-reduced-motion` 与低性能模式。
- [x] 键盘：焦点环、账号模式、文章手动复制、视频重试、聊天快捷键。
- [x] 触控：44px 主要命中区、Dock 横向滚动与边缘提示、软键盘定向滚动。
- [ ] Preview 公网页面截图核对（等待预览可访问后执行）。

## 内容与状态

- [x] 中文 / English / 日本語关键新增文案齐全。
- [x] 加载、空态、失败与重试路径有稳定操作。
- [x] 长标题、文件名、标签、正文和 320px 月历有溢出守卫。
- [x] 图片比例、固有尺寸、懒加载和异步解码覆盖新增动态媒体。
- [x] Preview R2 明确关闭，不误用正式文件桶。
- [ ] Preview commit 与预期 URL 已回填；CI、实际部署时间及页面验收仍待确认。
