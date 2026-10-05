# dsh-team-model-switcher

给 DSH 官方实验版 Agent Teams 补上「切换队员模型」的能力。

- **Host 工具**：`list_member_models({})` 读取全队模型证据；`set_member_model({ member, provider, model, reasoningEffort? })` 切单个队员，
  `set_all_member_models({ provider, model, reasoningEffort? })` **一键切换整队**，`remove_team_member({ member })` 移除故障队员，均由队长调用；
- **Web 面板**：会话页头出现「成员模型」按钮，首行是「全部队员」（一键整队），下面是每个队员一行；
  点开是**两阶段选择** —— 先选模型，该模型若支持思考深度再列出 `reasoningEffort` 档位
  （含「默认」一行），选中即生效；
- 队员**运行中或空闲**都能切；切换后**每次重新激活都沿用**新路由（含思考深度）。

## 移除团队成员

- 队长工具：`remove_team_member({ member: "broken-member" })`。
- 面板：刷新页面后，在「成员模型」面板每个队员行右侧点「移除」，确认后执行。
- 同一操作的路由：`POST /agent-team-model-switch/remove`，body `{sessionId, member}`，使用既有 `x-atms: 1` 守卫。

操作只允许 Team Lead 移除本队队员，不能移除 Lead。它会中断当前 turn、解除该成员持有的未完成任务负责人，
持久记录退出状态并从官方 `list_agents`、本插件面板和模型查询中隐藏成员；新消息、任务重新指派、旧 Team 邮箱排队投递都会被阻止。
历史会话和已完成任务保留；已经投递进运行中 turn 的内容靠中断停止，不撤回历史消息。

官方 Team 名册没有删除事件，因此这是插件执行的持久退出规则，而非改写官方日志。
状态位于 `<profile>/team-removed-members.json`；旧名字仍被官方名册保留，需要重建队员时用新名字。
插件卸载或停用后这些退出规则不再执行，官方原始成员记录会重新可见。
保留的历史子会话仍可打开；本操作阻止 Team 调用，不删除历史子会话本身。

实现对 Team service 做可撤销的运行时方法包装；旧队列投递还依赖当前版本 `mailbox.dispatchOnce` 内部入口。
若升级后入口变动，插件会明确挂载失败，避免仅隐藏名单却放任队列继续唤醒。
隔离回归测试验证了 Lead 保护、名册过滤、新消息/任务指派/旧队列阻断、任务释放、重载持久化及卸载时恢复方法。
真实 Host 上验证了删除 Lead 返回 400；本次未删除任何用户现有队员。

## 为什么需要它

官方 Team 插件在创建队员时**继承队长当时的模型路由**，之后没有任何改动入口：

| 现有入口 | 结果 |
| --- | --- |
| `spawn_teammate` 工具 | 没有 `provider`/`model` 参数 |
| `agentTeams` 服务 | 只有 roster / 消息 / 任务板，没有改成员模型的方法 |
| `sessionController.selectModel()` | 对 subagent 子会话直接返回 `session/agent-busy` |
| 队员子会话里的模型选择器 | 已寻址 subagent 会话不公开该入口 |

而且子 Agent 在两次任务之间会被回收：`ctx.agents.get(childId)` 在队员空闲时为 `undefined`。

## 实现要点

1. **切换当前这次激活**：在存活子 Agent 的 scoped context 上安装一对监听
   （`system-prompt/assemble` 覆盖 system prompt 变量、`agent/request` 覆盖请求 config），
   等价于 `@deepseek-ai/dsh-agent` 的 `installModelSelection`（省掉 model-change 通知）。
2. **跨激活保持**：把目标路由记在插件内的 `pending` 表里，并监听 `agent/created`；
   子 Agent 每次被重新创建时立刻装上该路由，因此下一次任务的第一步就用新模型。
   用户显式选过的路由另外写进 profile 目录下的 `team-model-switcher.json`，所以**重启 DSH 后依然有效**。
   显式选过的路由**一律钉住**，即使它与队长当前路由完全相同：成员会话在"直连消息"时会用自己
   `subagent/descriptor` 里冻结的路由（见「已知限制」），把覆盖清掉就等于把那种陈旧路由放回来。
3. **校验**：切换前用 `ctx.llm.resolveCallConfig()` 归一化并拒绝不可路由的 provider/model，
   `reasoningEffort` 同一路径校验（非法值报 `unknown reasoning effort for <provider>/<model>: <value>`）。
4. **留痕**：向队员会话追加 `model/selection` 事件（若会话已挂载），roster 投影即可显示新模型。

## 文件

| 文件 | 作用 |
| --- | --- |
| `lib/entry.js` | 常驻入口：每次挂载都用带 `?rev=` 的新 URL 动态 import `plugin.js`，绕开 Loader 模块缓存 |
| `lib/plugin.js` | Host 半侧：工具 + 两条 HTTP 路由 + 选择安装逻辑（零依赖，不 import 任何 `@deepseek-ai/*`） |
| `lib/client.js` | Web 半侧：`window.__ModuleLoader__` 预构建 bundle，注册 `conversation.session.header.actions` 面板 |
| `cordis.patch.yml` | 组合包 patch：安装时插入 `id: team-model-switcher-2` 条目 |
| `package.json` | `dsh.bundle.patch` + `dsh.client` 声明（`main` / `exports["."]` → `./lib/entry.js`） |
| `team-model-switcher.json` | **运行期生成**，在 profile 目录（不在本包内）：显式设置的队员路由，重启后据此恢复 |

Host 半侧刻意不 import 任何 DSH 包：**profile 之外的文件路径无法解析 `@deepseek-ai/*`**
（实测同一份代码放在 profile 内可 import、放在 `D:\python_code` 就 `failed to import`），
因此把 web 通道做成两条普通 JSON 路由，而不是 Typert Remote。

## 路由

| 路由 | 说明 |
| --- | --- |
| `POST /agent-team-model-switch/list` | 入参 `{ sessionId }`，返回 roster + 可路由模型目录（每个模型带 `reasoning: { efforts, defaultEffort? }`） |
| `POST /agent-team-model-switch/select` | 入参 `{ sessionId, member, provider, model, reasoningEffort? }` |
| `POST /agent-team-model-switch/select-all` | 入参 `{ sessionId, provider, model, reasoningEffort? }`，一次改整队（不含队长本人） |

三条都要求请求头 `x-atms: 1`，并拒绝 `Sec-Fetch-Site` 为跨站的请求（跨站 POST 需预检，而本路由不响应预检）。

## 安装 / 卸载

已在 `desktop` profile 安装并启用：

```text
bundle: dsh-team-model-switcher-2   （link:D:/python_code/dsh-agent-team-model-switch）
entry : include:team-model-switcher-2
```

卸载：`plugin_manager remove_bundle dsh-team-model-switcher-2` 即可（会从 `dsh.profile.bundles`
与 patch 中摘除，无需手工编辑文件；若上次卸载被中断，检查 `cordis.patch.yml` 是否残留条目）。

## 使用

- 面板：打开一个**团队队长**的会话，页头点「成员模型」（客户端 bundle 在页面加载时拉取，
  新装插件或改了 bundle 后需要**刷新一次页面**）。面板第一行是「全部队员」：整队路由一致时显示该路由，
  不一致时显示「统一设置…」，点它选中的模型会对**所有队员**生效（走 `/select-all`）；下面是每个队员一行。
  点某行的当前模型按钮，会在面板内展开可滚动的
  模型列表（分组 = provider，当前项带 ✓；自绘列表，不用浏览器原生 `<select>`，避免弹层过大、透明、糊字）。
  若选中的模型支持思考深度，列表会切成该模型的档位视图（首项是「默认」，并显示模型缺省档），
  点档位即带 `reasoningEffort` 提交；Escape 逐级返回。
- 工具：队长调用 `set_member_model` 切单个队员，例如
  `{ member: "researcher", provider: "opencode-go", model: "muse-spark-1.3-contributor", reasoningEffort: "low" }`；
  或 `set_all_member_models({ provider, model, reasoningEffort? })` 一键改整队。
- 面板上的「（继承队长）」表示该队员**没有被显式设置过**；一旦你在面板里为它选了模型
  （哪怕选的就是你自己当前那条路由），这条路由就会被钉住，直连消息也用它。
  想让某个队员重新跟随队长：删掉 `team-model-switcher.json` 里它那个 session 的条目即可。

## 已验证

- 运行中切换：同一 turn 的下一步 `request/header` 即变为新路由。
- 空闲切换：走 `pending` + `agent/created`，重新唤醒后**新激活第一步**就是新路由。
- 思考深度：空闲队员选 `opencode-go/muse-spark-1.3-contributor` + `reasoningEffort: "low"`，
  其会话日志下一步为 `request/header {"provider":"opencode-go","model":"muse-spark-1.3-contributor","reasoningEffort":"low"}`。
- 一键整队：`POST /select-all { sessionId, provider, model, reasoningEffort }` → `200 {"updated":1,...}`；
  空闲队员重新唤醒后 turn 7 step 1 的 `request/header` 即
  `{"provider":"opencode-go","model":"muse-spark-1.3-contributor","reasoningEffort":"low"}`（会话日志第 107 行），该步回复 `ALL-OK`。
- 热重载：改完 `plugin.js` 后把插件关→开，新加的 `/select-all` 立即生效（`entry.js` 的 `?rev=` 绕开了模块缓存）。
- 路由守卫：不带 `x-atms: 1` → `403`；`/select-all` 空 body → `400 {"error":"sessionId must be a non-empty string"}`。
- **重启保持**：队员设为 `xcpcgpt/gpt-6-sol` + `medium` 后，把插件关→开（等价于重启：内存 `pending` 被清空），
  `/list` 仍返回该路由，队员下次激活的 `request/header` 就是
  `{"provider":"xcpcgpt","model":"gpt-6-sol","reasoningEffort":"medium","maxTokens":128000}`（会话日志第 120 行），该步回复 `RESTART-OK`。
- **显示修复**：没有自定义路由的队员不再显示 Agent Teams 名册里的 `spawn/<创建时模型>`，
  而是显示队长当前路由并带 `inherited: true`（面板显示「（继承队长）」）。
- **陈旧路由事故（2026-10-03）**：某成员会话的 `subagent/descriptor` 冻结在已下线的 `opencode-go` 上，
  队长派活（继承队长）能跑，但在该成员会话里**直接发消息**时会 `no adapter registered for provider "opencode-go"`（会话 `1628e9c6` turn 17）。
  处理：清掉 profile 里 opencode-go 的 provider 条目与 `allowedModels` 两条、并卸载 `dsh-opencode-go`；
  再用 `/select-all` 给该 Team 全部 8 名成员钉上 `commandgoat/deepseek/deepseek-v4.1-flash` + high（返回 `updated: 8`，覆盖文件 8 条）。
- **直连消息也吃钉住的路由（已复现验证）**：成员 `route-probe` 的 descriptor 同样冻结在 opencode-go ——
  钉住前直连发消息失败（会话 `af25ffb0` turn 9 第 134 行 header = opencode-go，第 138 行 `NO_ADAPTER`）；
  钉上 `commandgoat/deepseek/deepseek-v4.1-flash` + high 后再直连发一条消息即成功
  （turn 10 第 146 行 header = 该路由，第 150 行 `turn/end completed`）。

## 已知限制

- 只能作用于**本 Team 的队员**（队长身份校验来自 `agentTeams.membership`）；一键整队同样**不含队长本人**，
  队长的模型属于普通会话的模型选择。
- 显式设置的路由持久化在 `<profile 目录>/team-model-switcher.json`（`desktop` profile 即
  `%USERPROFILE%\.dsh\profiles\desktop\team-model-switcher.json`）；条目一旦写入就**不会被自动清除**
  （即使选的就是队长当前路由），删掉某个条目才会让那名队员回到"继承队长"。
  （第一版把记忆只放在内存里、重启 DSH 就丢；第二版又会把"等于队长路由"的设置自动清掉，都已在 2026-10-03 修掉。）
- **官方名册显示的模型不是真实模型**：`list_agents` 与任务结果卡里的「提供方 / 模型」是**创建时冻结**的值 ——
  `provider` 其实是子代理后端名（`spawn`/`fork`，不是模型提供商），`模型` 是成员创建那一刻的路由。
  真实路由以成员会话的 `request/header` 为准，或看本插件的面板 / `/agent-team-model-switch/list`。
- 成员会话被**直连消息**激活时（你直接在成员会话里发消息），用的是它自己 `subagent/descriptor` 里冻结的路由；
  只有队长派活才走"继承队长"。所以冻结在已下线 provider 上的老成员，直连消息会直接失败 —— 用面板给它们钉一条有效路由即可。
- 切换只影响之后的请求；正在跑的步骤保持启动时的模型。
- `reasoningEffort` 只负责把档位交给路由与请求头；上游是否真正消费该档位取决于对应 provider 适配器
  （`off` / `max` 之类的档位名也由 provider 自己声明）。
- 依赖 DSH 内部缝（`agent.ctx` 上的 `system-prompt/assemble` / `agent/request`、`agent/created`、
  `session.append('model/selection')`），随官方实验版升级可能需要适配。

## 查询真实模型

队长应调用 `list_member_models({})`，不要从官方 `list_agents` 或 `spawn_teammate` 的创建记录推断实际模型。
工具读取当前 Team 的活跃会话或持久会话日志，不激活队员，返回：

- `nextTeamRequest`：下一次队长派活的预计路由；`nextDirectRequest`：下一次直连的预计路由。
- `lastRequest`：最新实际请求头（provider/model/reasoningEffort/seq/time）。
- `lastResponse`：最新实际回复的 provider/model/seq/time。
- `source`：Lead 自身、显式固定或预计继承队长；`readError`：日志读取失败时的原因。

预计路由不是实际使用证据。尚未运行或缺少记录时实际值为 `null`，不能据此宣称队员已经用了某个模型。
同一查询可通过 `POST /agent-team-model-switch/models`（body `{sessionId}`，既有 `x-atms: 1` 守卫）只读调用。
已实际调用工具验证：空闲 `route-probe` 的最近请求 seq=146、回复 seq=148 均为 commandgoat/deepseek/deepseek-v4.1-flash，请求 effort=high。
官方旧工具的结果卡片仍保留创建时字段；本工具提供另一个能核对实际记录的入口。

## 开发注意（重要）

DSH 的 Loader 对宿主插件模块做**双层缓存**：`specifier → 解析出的文件 URL → 模块`。
在同一个运行进程里改代码后，仅换包名或仅换入口文件名都**不会**重新导入；
甚至 `plugin_manager set_plugin` 关→开也不会重新 import（实测改完 `modelGroups()` 后关开一轮，
`/list` 仍是旧结果）。因此现在由 `lib/entry.js` 每次挂载用 `?rev=<n>-<时间戳>` 的新 URL 动态
import 实现热重载；改 `plugin.js` 后只要关开一次插件即可生效，`entry.js` 本身极少改动（改它仍需换名或重启）。
