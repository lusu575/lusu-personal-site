# lusu-personal-site
鲁肃的个人站
啊随便捣鼓着玩

## 维护备注

- 正式部署链路：GitHub `main` -> Cloudflare Pages Git 自动部署 -> `lusu575.com`。
- 游戏区只保留可在本站本地打开的静态游戏入口，不做外部跳转入口。
- `games/life-restart/` 来自 `VickScarlet/lifeRestart`，上游需要先执行 `xlsx2json` 和 `build`，本站提交构建产物 `template/public` 对应的 `games/life-restart/source/`。
- lifeRestart 当前支持中文和 English，暂无日本語；日语站点入口默认启动 English。
