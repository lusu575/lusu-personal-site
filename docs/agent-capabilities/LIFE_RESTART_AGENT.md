# Life Restart Agent 语义适配器

## 能力边界

`life-restart` 适配器为本地 CLI／stdio MCP 能力层提供隔离的、可持久化的「人生重开模拟器」经典（Custom）模式会话。它运行自己的确定性状态机，不读取、观看、配对或控制已经打开的浏览器游戏，也不导入浏览器存档。

适配器只接受以下语义动作：

- `choose_talents`：从本局十个候选中选择恰好三个互不冲突的天赋。
- `allocate_properties`：为 `CHR`、`INT`、`STR`、`MNY` 四项分别分配 `0..10` 的整数，合计必须与本局可用点数完全一致；`SPR` 按上游 Custom 模式固定从 5 开始。
- `advance`：`steps` 固定为 `1`，一次只推进一岁。
- `restart_life`：仅在终局可用；`inheritedTalentId` 为本局原始已选天赋之一或 `null`，继承项只保证出现在下一轮十连抽的首位，仍需重新选择。
- `reset`：必须显式提供 `confirm: true`，清空当前隔离会话的累计进度。

动作发现返回少量参数化描述器和一个合法示例，不枚举天赋组合或属性分配组合。选择器、键盘事件、脚本、URL、任意路径、命令和存档导入都不属于协议。

## 数据与来源

实现语义以官方仓库 MIT 许可的固定提交 `a10861eed93296c96d0e0fca98c82e86f4dfda4b` 为依据，复刻该提交的 Custom 模式流程、条件表达式、事件权重／分支／效果、天赋排斥／替换／触发次数和终局继承语义。实现代码是站点能力层内的适配实现，不把上游浏览器 UI 或 Laya 运行时导入能力层。归属、修改说明与完整许可证位置见 `games/life-restart/NOTICE.md`。

运行时只加载仓库内现有中文数据，并在解析前校验原始字节 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `games/life-restart/source/data/zh-cn/age.json` | `c0d398c4dd2bd5552f746ec24a4113389dfe014c80e493df9246dabbd6187a23` |
| `games/life-restart/source/data/zh-cn/talents.json` | `715353f26504335b86837ac43b980c537021fb5889d99330507449e6613de32d` |
| `games/life-restart/source/data/zh-cn/events.json` | `c06b3d7893f3774b0e8d294cce9038b04660cd250eb9ce5cd18effdfbea40bf3` |

当前 Agent 输出因此是中文内容。仓库虽然还包含 `en-us` 数据，但其中存在未翻译中文文本，本适配器不加载它，也不宣称提供完整英文或日文游戏翻译。

## 状态机

会话依次经过：

1. `talent-selection`
2. `property-allocation`
3. `trajectory`
4. `summary`

创建时可提供 32 位 `seed` 和 `calendarYear`。随机数状态与 `calendarYear` 会写入受验证的持久状态；`{currentyear}` 使用该固定年份，不调用恢复时的系统时间。相同数据、种子、年份和动作序列会得到相同天赋、事件、分支、随机属性与序列化状态。

状态格式版本为 2。每次 `create`、确认 `reset` 或 `restart_life` 都会记录一个当前人生起点检查点：起始 revision、抽取候选天赋前的 RNG、代际／累计局数／继承信息，以及累计事件前缀的长度和 SHA-256。恢复时从该检查点在内存中重新执行候选抽取、天赋选择、属性分配和精确数量的逐岁推进，再将完整重放状态与输入状态做深比较；内部重放路径跳过二次重放校验，因此不会递归。该校验保证状态符合一条确定性当前人生轨迹，但不是对可主动重写整个本地状态和程序的攻击者提供密码学认证。

逐岁推进先触发满足条件且未超过上游触发次数的天赋，再从该年龄满足 include／exclude 条件的事件中按权重选择一个事件。事件分支在当前事件效果前判断，当前事件随后写入本局和累计事件集合、应用效果，并有界递归到分支事件。终局由 `LIF < 1` 决定。

## 安全与资源上限

- `create`、`restore`、`serialize`、`revision`、`observe`、`actions`、`normalizeAction`、`act` 都经过严格 JSON 形状、类型、范围和数据身份校验。
- 写动作由通用游戏会话层继续提供 revision CAS、`clientActionId` 幂等收据、锁、TTL、会话数量和磁盘写入边界；适配器每个成功动作只把 revision 增加 1。
- 状态最大 64 KiB；观察最大 56 KiB；动作目录最大 16 KiB。只保留最近 24 个逐岁记录，事件链最多 24 层，单次当前人生最多推进 2048 次；活动天赋、事件集合、属性值、代数和触发次数都有明确上限。
- `observe` 不返回 RNG 内部状态；状态恢复要求版本、模式、固定上游提交和三份数据哈希全部匹配，并拒绝未知字段、重复／未知 ID、相位矛盾、派生总分或最近历史不一致等畸形状态。当前人生确定性重放还会拒绝伪造的 RNG、活动天赋、事件集合、逐岁年龄／文本／属性和终局摘要。
- 测试夹具只能由进程内工厂以 `allowTestData: true` 显式注入 JSON 对象；适配器从不接受数据路径或网络地址。

该边界只代表隔离的本地 Agent 会话，不代表页面 bridge、浏览器配对、浏览器存档兼容、远程 MCP 写入或 AI 接管网页游戏。
