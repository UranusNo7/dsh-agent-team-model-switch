# 成员模型面板 UI 约定

面向 `lib/client.js` 中「成员模型」面板的展示约定。只描述界面结构与主题取色，不涉及 Host 路由、模型解析或业务行为。

## 结构

```text
.atms-root
├─ .atms-trigger            会话页头按钮「成员模型」
└─ .atms-panel              仅 open 时渲染，fixed 定位
   ├─ .atms-head
   │  ├─ .atms-title        「成员模型」
   │  └─ .atms-sub          一句话说明：切换下次请求的模型与思考深度；「全部队员」整队生效
   ├─ .atms-body
   │  ├─ .atms-row          「全部队员」一行 + 每个队员一行
   │  │  ├─ .atms-ident
   │  │  │  ├─ .atms-name        成员名（整行省略号，title 保留全名）
   │  │  │  └─ .atms-status      中文状态：运行中 / 空闲 / 准备中 / 失败（+「切换中…」）
   │  │  ├─ .atms-picker          整行宽按钮：主行模型名，次行 provider · 思考深度 · 继承队长
   │  │  ├─ .atms-actions
   │  │  │  ├─ .atms-action             轻量次级按钮（整队行：设为默认）
   │  │  │  └─ .atms-action-danger      轻量次级按钮（队员行：移除）
   │  │  └─ .atms-options         展开后的模型列表 / 思考深度列表（二级滚动）
   │  └─ .atms-hint          底部说明「继承队长」含义，或空态文案
   ├─ .atms-notice           成功反馈
   └─ .atms-error            失败反馈
```

- 成员身份独占一行，模型选择器独占其下整行，避免长模型名与身份、动作按钮争抢宽度。
- 选择器主行只显示模型主名（目录名优先，缺失回退 model id）；provider、思考深度、「继承队长」放次行。
- 选择器 `title` 保留完整路由 `provider/model · 思考深度 <effort>`（含「继承队长」），鼠标悬停仍可读到全量信息。
- 两阶段选择不变：先选模型，声明了思考深度的模型再进第二级；第二级保留「默认」项与各档位说明。

## 主题取色

只使用 DSH 主题 token，不写死颜色；括号内为变量缺失时的语义回退。

| 用途 | Token |
| --- | --- |
| 面板底色 | `--dsw-alias-bg-layer-1` → `bg-layer-2` → `Canvas` |
| 选择器 / 列表 / 二级面板底色 | `--dsw-alias-bg-layer-2` → `Canvas` |
| 分隔线与常规描边 | `--dsw-alias-border-l1`（回退 `color-mix(in srgb,CanvasText 30%,transparent)`） |
| 选择器、返回键描边 | `--dsw-alias-border-l2`（回退 `color-mix(in srgb,CanvasText 45%,transparent)`） |
| 主文本 | `--dsw-alias-label-primary` → `CanvasText` |
| 次级文本、状态、提示 | `--dsw-alias-label-secondary` → `GrayText` |
| 当前项与悬停强调 | `--dsw-alias-brand-primary` → `Highlight` |
| 运行中 / 失败状态 | `--dsw-alias-state-success-primary` / `--dsw-alias-state-error-primary` → `CanvasText` |
| 面板阴影 | `color-mix(in srgb, var(--dsw-alias-bg-overlay, CanvasText) 45%, transparent)` 等 |

- 悬停底色用 `color-mix` 混 `--dsw-alias-label-primary`（深色主题偏白、浅色主题偏黑），两个主题下方向都正确。
- 阴影复用 `--dsw-alias-bg-overlay` token，而不是 label token：label 在深色主题接近白色，直接当阴影会变成浅色光晕。该 token 在深/浅两套主题下的实际取值与观感本轮未验证。
- 面板不再使用 `--dsw-alias-bg-overlay` 作底色（旧版看起来像一层灰罩），改为 `bg-layer-1`。

## 定位与尺寸

- `placePanel` 的 fixed 视口定位、修正循环、resize/scroll/`ResizeObserver` 重排逻辑未改动。
- 面板宽度 420px，`max-width: calc(100vw - 24px)`；窄屏时面板整体收窄（`.atms-ident` 未设 `flex-wrap`，名称以省略号截断，选择器随面板一起变窄），不依赖行内换行。
- 面板 `max-height: min(72vh, 560px)`，超出后在面板内滚动；模型/深度列表自身再限高 240px。

## 修改须知

- 新增样式只能引用上表 token 或 `color-mix(... token ...)`；不要引入 `#hex`、`rgba()` 等固定颜色。
- 样式节点 `<style data-atms>` 由 `injectStyle` upsert：`apply` 每次挂载都查找该节点，存在就重写 `textContent` 为当前 `CSS`（不再无条件 return），不存在才创建，因此客户端 bundle 重新加载时会就地刷新规则，不会留下旧一代选择器（例如旧的 `.atms-picker{max-width:210px}`、`.atms-rowhead`）。
- 节点归属由 `data-atms-owner` 记录：`apply` 用 `ctx.effect` 注册清理，只有最后写入该节点的挂载才移除它，避免旧挂载的 disposal 抢在新挂载之后执行时删掉正在生效的样式。若客户端未触发热更新，仍需刷新页面才会执行新的 `apply`。
- 面板 CSS 由 `test/layout.mjs` 从 `lib/client.js` 中提取 `var CSS = [...]` 表达式并在无头浏览器中量测；保持 `.join('')` 结尾与 `var NAME = '...'` 的 token 写法。
- 改宽度、内边距或圆角后需重跑布局回归，确认面板仍留在视口内。
- 视觉验收需用户刷新 DSH 页面后在真实主题（深/浅）下确认；仅语法与源码检查不能代替渲染检查。
