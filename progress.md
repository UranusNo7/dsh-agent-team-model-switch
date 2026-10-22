## 2026-10-05 - Task: 修复跨供应商同模型同思考深度切换

### What was done
- 修正客户端思考深度选择器：仅当 provider、model 与 reasoningEffort 均一致时才视为当前项并跳过提交。
- 跨供应商选择相同模型 ID 和相同思考深度时，现在会正常提交新的 provider/model 路由。

### Testing
- `node --check lib/client.js`
- `node --check lib/plugin.js`
- `node --check lib/entry.js`

### Notes
- 改动文件：`lib/client.js`；新增 `progress.md`。
- 回滚方式：撤销 `client.js` 中 `sameModel` 相关判断及删除本次日志条目。

## 2026-10-05 - Task: 增加全局默认 Team 成员模型

### What was done
- 调查确认官方 `spawnTeammate` 没有创建前模型覆盖事件或 LLM model 参数。
- 包装 `agentTeams.spawnTeammate`，创建完成后立即将新成员绑定到持久化的 provider/model/reasoningEffort 默认路由。
- 新增 `set_default_member_model` 队长工具与 `/set-default` Host 路由；默认设置写入 profile 的 `team-model-default.json`。

### Testing
- `node --check lib/plugin.js`
- `node --check lib/client.js`
- `node --check lib/entry.js`

### Notes
- 改动文件：`lib/plugin.js`、`progress.md`。
- 限制：由于官方创建前没有可拦截 waterfall，创建过程内部若立即发起首个请求，无法保证首个请求使用默认路由；创建完成后的后续请求会被插件覆盖。
- 回滚方式：撤销 `lib/plugin.js` 本次默认配置、spawn 包装、工具和路由改动。

## 2026-10-05 - Task: 增加默认模型面板入口

### What was done
- 在“全部队员”行增加“设为默认”按钮，调用 `/set-default`，不改变现有单成员或整队切换语义。
- 面板显示默认设置成功或失败反馈。
- spawn 包装增加 Team Lead 身份校验，普通队员创建成员时不会套用全局默认。

### Testing
- `node --check lib/plugin.js`
- `node --check lib/client.js`
- `node --check lib/entry.js`

### Notes
- 改动文件：`lib/client.js`、`lib/plugin.js`、`progress.md`。
- 回滚方式：撤销本次面板按钮、Lead 校验及日志追加。

## 2026-10-06 - Task: 验证 desktop 解析并上传 GitHub

### What was done
- 核对 desktop profile 本插件依赖与符号链接，确认源码目标已可访问；未重装插件、未终止用户进程。
- 创建 UranusNo7/dsh-agent-team-model-switch 私有仓库，初始化 main 并推送本插件源码、说明和日志。

### Testing
- desktop profile 中实际 import Host 包成功，导出 apply、inject、name。
- client 子路径解析到 lib/client.js；普通 Node 报 window 未定义，尚未验证桌面浏览器实际挂载。
- 提交文件仅含 README.md、package.json、cordis.patch.yml、lib 三文件和 progress.md；git diff --cached --check 通过，敏感凭据模式检索无匹配。
- GitHub 查询确认 private、默认分支 main；首次推送提交 bc4358f 成功。

### Notes
- 新增本地 Git 元数据，追加 progress.md；未提交 profile 或运行数据。
- 仓库：https://github.com/UranusNo7/dsh-agent-team-model-switch。
- 本轮未变更 desktop profile；若仍报旧路径错误，应继续读取真实进程的 profile/日志，不能以 Node 解析通过代替桌面挂载验收。
- 日志回滚可通过后续 Git revert 撤销本条记录，不重写远端历史。

## 2026-10-06 - Task: 修复成员模型面板被裁切

### What was done
- 面板此前锚定在页头触发按钮上，短会话名时按钮靠近左边，400px 面板向左溢出视口，左侧成员名与提示被裁切。
- `lib/client.js` 增加 `placePanel()`：打开与窗口 resize 时按真实盒模型把面板整体平移回视口内（左右两侧都管），不改面板尺寸，模型/深度/设为默认交互不变。
- 新增 `test/layout.mjs`：从 `lib/client.js` 抽取真实 CSS 与 `placePanel` 源码，在无头 Chromium 中按宿主页头几何测量。

### Testing
- `node test/layout.mjs` 全通过：短名 unshiftedLeft=-272 → 平移后 8..408 均在视口内；长名 -82、空名 -286、窄视口 504px 同样通过。
- 负向对照：把副本中的 `placePanel` 置空后同一测试 5/5 失败（exit 1），证明测试确实能捕获该缺陷。
- `node --check` 通过 lib/plugin.js、lib/client.js、lib/entry.js、test/layout.mjs。

### Notes
- 改动文件：`lib/client.js`、新增 `test/layout.mjs`、`progress.md`。
- 缺口：隔离测试用宿主已打包的页头 CSS 复刻几何，未在真实桌面页面内测量；面板已挂载的真实 DOM 仍未验证，需刷新页面后目视确认。

## 2026-10-06 - Task: 加固成员模型面板定位

### What was done
- 将成员模型面板改为 fixed 定位，以 root 的真实 viewport 盒子计算 top/left。
- 使用面板实际 getBoundingClientRect 多轮校正，处理祖先 transform/contain、overflow/clip、左右边界、窄视口与 resize。
- 扩展 Chromium 布局回归，覆盖 overflow/clip、transform 捕获祖先、窄视口与 zoom，并保留旧 absolute 越界对照。

### Testing
- `node --check lib/client.js`、`node --check test/layout.mjs` 通过。
- `node test/layout.mjs` 6/6 通过；旧 absolute 对照在短/长会话下左侧越界，fixed 结果均在视口内。
- `git diff --check` 通过。

### Notes
- 改动文件：`lib/client.js`、`test/layout.mjs`、`progress.md`。

## 2026-10-06 - Task: 加固面板滚动与异步尺寸定位

### What was done
- 面板打开期间监听 capture scroll 与 resize，滚动宿主后重新按真实盒子定位。
- 使用 ResizeObserver 在成员数据导致面板尺寸变化时重新定位，并在关闭时清理监听与 observer。
- 回归测试增加 overflow:clip 与 transform 捕获祖先的组合场景。

### Testing
- `node --check lib/plugin.js`、`node --check lib/client.js`、`node --check lib/entry.js`、`node --check test/layout.mjs` 通过。
- `node test/layout.mjs`：6/6 PASS；旧 absolute 对照越界，fixed 定位均在视口内。
- `git diff --check` 通过。

### Notes
- Client inspect 仍无法取得真实 DOM；真实桌面需刷新后验证。
- 回滚方式：还原 fixed/placePanel 与测试新增内容，并删除本条记录。

## 2026-10-17 - Task: 适配当前 DSH Desktop Agent Teams

### What was done
- 兼容 DSH Desktop 0.2.1-rc.1 的 Agent Teams：旧版存在 `mailbox.dispatchOnce` 时继续安装退出成员的历史队列保护；当前版没有该私有入口且官方明确不投递历史队列时跳过旧钩子，避免插件因过时内部 API 拒绝挂载。
- 增加插件管理器可读取的中英文标题、描述和包内原创图标，并导出到安装包清单。

### Testing
- `node --check lib/plugin.js`
- `node --check lib/client.js`
- `node --check lib/entry.js`
- `node test/layout.mjs`
- 当前桌面端首次启用实测失败原因已复现为旧 `mailbox.dispatchOnce` 硬失败；修复后将重新启用并读取应用结果。

### Testing
- `node --check lib/plugin.js`, `node --check lib/client.js`, `node --check lib/entry.js` 均通过。
- `node test/layout.mjs` 在当前 Edge 无头环境中因 `--dump-dom` 未返回测试页的 `<pre>` 内容而退出，属于测试环境输出缺口，未据此宣称布局通过。
- `plugin_manager set_bundle` 先复现旧 `mailbox.dispatchOnce` 挂载失败；停用后重新启用返回 `application: applied`。插件工具已出现在 Host Tool 清单；带 `x-atms: 1` 的路由请求返回预期业务错误 400，缺少守卫请求返回 403。
- Tabbit 当前浏览器注册不可用（`CLI_REGISTRATION_UNAVAILABLE`），未完成真实页面刷新后的视觉检查；Client Slot 仍显示旧页面注册项，需用户刷新 DSH 页面加载客户端 bundle。

### Notes
- 上一条记录中的 `node test/layout.mjs` 已在本补记中更正为当前环境下未完成；产品布局代码未因此改动。

## 2026-10-17 - Task: 同步桌面端安装说明

### What was done
- README 更新为当前 `D:/python_code/DSH插件/dsh-agent-team-model-switch` 链接路径、已启用状态和 Team 私有 mailbox 兼容说明。

### Testing
- 通过 `plugin_manager list_plugins` 确认 `include:team-model-switcher-2` 为 `enabled: true`、`fiberPhase: active`。

### Notes
- 改动文件：`README.md`、`progress.md`。
- 回滚方式：恢复 README 原安装段落并删除本条日志。

## 2026-10-17 - Task: 最终重装并启用当前工作区插件

### What was done
- 通过 `plugin_manager` 移除旧 bundle 后，以当前工作区绝对路径重新执行 `install_bundle`，指定 npm registry，结果为 `application: applied`、`enabled: true`。
- 安装器输出的 pnpm link 文本仍显示历史短目录名，但该目录在当前文件系统不存在；Host 重新挂载成功且插件工具/路由可用，因此未将该文本当作激活失败。

### Testing
- 重新启用后的 `include:team-model-switcher-2` 为 `enabled: true`、`fiberPhase: active`。
- `/agent-team-model-switch/models` 带 `x-atms: 1` 返回 400（缺失 session 的预期业务错误），无标记返回 403。

### Notes
- 本次重装保留现有 Team roster、任务和模型覆盖文件；未删除成员或修改其模型配置。
- 官方 `llm-deepseek-account` 的 `models` 配置 warning 仍为独立的 profile 既有问题。

## 2026-10-19 - Task: 优化成员模型面板与 DSH 主题一致性

### What was done
- 面板底色由 `--dsw-alias-bg-overlay`（截图中的灰罩来源）改为 `--dsw-alias-bg-layer-1`，选择器与列表用 `--dsw-alias-bg-layer-2`；描边、文本、状态、强调全部改用 DSH 主题 token，移除 `#hex` 与 `rgba()` 固定颜色，阴影改为 token + `color-mix`。
- 成员行改为「身份一行 + 整行宽模型选择器 + 轻量次级按钮」：选择器主行显示模型主名，次行显示 provider、思考深度与「继承队长」，完整路由 `provider/model · 思考深度 …` 保留在 `title`。
- 状态文案中文化（运行中 / 空闲 / 准备中 / 失败），运行中与失败用主题 state 颜色；面板新增标题与一句副标题，「全部队员 / 继承队长」说明下移到底部提示。
- 评审修正：整队行没有路由时次行用中性文案「为全部队员选择模型」（统一路由、全员继承或各不相同都可能），不再把 provider 缺失断言为「各队员模型不一致」。

### Testing
- `node --check lib/client.js`、`lib/plugin.js`、`lib/entry.js`、`test/layout.mjs` 全部通过。
- 从 `lib/client.js` 提取 `var CSS = [...]` 表达式在 Node 中求值：5485 字节、花括号 40/40 平衡、`#hex`/`rgba(` 匹配数为 0；CSS 中 31 个 `.atms-*` 类都有对应渲染节点。
- Host `Tool` inspect 仍列出本插件 5 个工具（`list_member_models`、`set_member_model`、`set_all_member_models`、`set_default_member_model`、`remove_team_member`），说明 Host 半侧在当前进程内处于活动状态。

### Notes
- 改动文件：`lib/client.js`、新增 `docs/ui.md`、`progress.md`；未改 Host 半侧、HTTP 路由、请求体、回调与 `placePanel` 定位逻辑。
- 视觉未验：Tabbit 浏览器注册不可用（`CLI_REGISTRATION_UNAVAILABLE`），Client inspect 超时；本轮按 verification.md 只做语法与源码检查，未跑 mock 或无头页面，深浅主题下的实际观感需用户刷新页面确认。
- 回滚方式：还原 `lib/client.js` 的 token、CSS 与三处渲染改动，删除 `docs/ui.md` 与本条日志。

## 2026-10-19 - Task: 修复客户端更新后残留旧样式

### What was done
- 定位已证实缺陷：`injectStyle` 只要页面上存在 `style[data-atms]` 就 `return`，于是客户端 bundle 更新后新组件标记配旧一代 CSS（model/provider 仍行内、picker 仍 `max-width:210px`、面板底色仍是旧的 overlay 灰底）。
- 改为 upsert：找到自有节点就重写 `textContent` 为当前 `CSS`，找不到才创建；`apply` 为该节点记录 `data-atms-owner`，并用 `ctx.effect` 注册清理，只有最后写入该节点的挂载才移除它，避免旧挂载 disposal 抢在新挂载之后删除正在生效的样式。
- 只改样式节点生命周期；未改颜色取值、主题 token、Host 业务、路由与回调。

### Testing
- `node --check lib/client.js` 通过。
- 用 DOM stub 直接执行当前 `lib/client.js` 的 factory 与 `apply`（非页面、非渲染）：预置旧一代样式节点后 `apply` 复用同一节点、清掉 `max-width:210px`/`.atms-rowhead` 并写入当前 `.atms-picker{display:flex;width:100%…}`；第二次挂载后仍只有 1 个节点；旧挂载 disposal 后节点仍在且归属新挂载，最新挂载 disposal 后节点被移除；全新页面重复 `apply` 仍只有 1 个节点。10/10 PASS。
- Host `Tool` inspect 仍列出本插件 5 个工具，Host 半侧未受影响。

### Notes
- 改动文件：`lib/client.js`、`docs/ui.md`、`progress.md`。
- 未验证限制：无法取得真实页面与真实主题 token 取值，本轮不宣称面板颜色已与官方完全一致；样式刷新效果需要客户端重新加载 bundle（或刷新页面）后由用户/队长复核。
- 回滚方式：把 `injectStyle` 还原为「存在即 return」并去掉 `apply` 中的 owner/effect 清理，删除 `docs/ui.md` 相应条目与本条日志。

## 2026-10-22 - Task: 生成 Release 标准插件包并记录打包验证

### What was done
- 用 `npm pack --ignore-scripts --pack-destination artifacts` 从当前工作区生成标准安装包 `artifacts/dsh-team-model-switcher-2-0.1.1.tgz`（包名 `dsh-team-model-switcher-2`，版本 `0.1.1`，9 个条目，压缩后 25318 字节）；`--ignore-scripts` 保证未执行任何 npm 生命周期脚本。
- 从 tgz 内解出 `package/package.json` 复核 `name` / `version` / `main` / `files` 与源码一致，未改源码、版本号与业务代码。

### Testing
- `tar -tzf artifacts/dsh-team-model-switcher-2-0.1.1.tgz` 清单全部位于 `package/` 下且齐全：`lib/entry.js`、`lib/plugin.js`、`lib/client.js`、`package.json`、`cordis.patch.yml`、`locale/en.json`、`locale/zh.json`、`icon.svg`、`README.md`。
- SHA256：`a90f5e10bb1b655e05b775d846f4ff390e4f7e5261218b95a78cbe9c1dd26e6b`。

### Notes
- 改动文件：新增 `artifacts/dsh-team-model-switcher-2-0.1.1.tgz`，追加 `progress.md` 本条日志；源码未改。
- 未做部分：未上传 GitHub、未创建 Release、未做全新 DSH profile 安装验证；tgz 未 `git add`，也未 commit/push。
- 回滚方式：删除该 tgz 文件及本条日志即可。

## 2026-10-22 - Task: v0.1.1 GitHub Release 发布与下载核验补记

### What was done
- 补记 Lead 已完成的正式发布：`v0.1.1` 已作为 GitHub Release 发布，tag 目标提交 `4dddad25a363bb17f96ca4e41644591065c47493`，Release 见 https://github.com/UranusNo7/dsh-agent-team-model-switch/releases/tag/v0.1.1 。
- 本成员仅做本地下载核验：Lead 用 `gh release download` 取回附件到 `artifacts/verified-release/dsh-team-model-switcher-2-0.1.1.tgz`，本地比对与打包产物完全一致；未参与上传、tag 或 Release 创建。

### Testing
- Release 元数据（Lead 侧 `gh release view`）：`isDraft: false`、`isPrerelease: false`，附件状态为已上传，大小 25318 字节，平台 digest `sha256:a90f5e10bb1b655e05b775d846f4ff390e4f7e5261218b95a78cbe9c1dd26e6b`。
- 本地独立复核下载件：`artifacts/verified-release/dsh-team-model-switcher-2-0.1.1.tgz` 25318 字节，SHA256 `a90f5e10bb1b655e05b775d846f4ff390e4f7e5261218b95a78cbe9c1dd26e6b`，与本地打包产物 `artifacts/dsh-team-model-switcher-2-0.1.1.tgz` 完全一致，上传链路无损坏或截断。

### Notes
- 改动文件：仅追加 `progress.md` 本条日志；源码、版本号、既有打包记录均未改动。
- 未做部分：未做全新 DSH profile 安装验证，因此本文不宣称安装可用性；tgz 未 `git add`，提交推送由 Lead 执行。
- 回滚方式：删除本条日志即可，不影响已发布 Release。
