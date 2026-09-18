# Task：Panel 细粒度刷新 API 与 Hover 连续性

状态：done — ✅ 核心刷新边界、局部 Popover 生命周期、批量/Tick/主题决策与浏览器验收已完成；后续语义节点扩展拆至 [[task-0100-ui-semantic-region-mapping-follow-up]]

## 目标

针对内容更新引起的 Panel 元素状态变化，建立可按字段、元素组和局部 Region 定位的刷新 API，避免把“状态变化”升级为整个 Panel 或整个 Workspace 的 DOM 替换，从而保持不相关元素的 hover、tooltip、滚动位置和焦点连续性。

本 Task 同时收敛上一轮调查提出的建议：

1. 修正 `refreshPanels()` 的全局 tooltip 关闭边界；
2. 把内容更新映射到最小可安全刷新的字段或 Region；
3. 合并 Runtime Editor 批量提交造成的重复刷新；
4. 统一局部 DOM 替换的 popover 生命周期与验收证据。

## 设计边界

- 本 Task 只处理 `src/ui/` 的刷新调度、DOM 写入边界、popover 生命周期、测试和验收文档；不改引擎事件语义、PlayerState、交易边界、存档格式或 Workspace 路由语义。
- 保留现有四层刷新梯度：behavior → element/group 或 Region → Panel → Workspace/App。更大范围刷新只能作为小范围刷新不可用或确有结构变化时的降级。
- 建议 API 应以稳定的 UI host / data key 表达目标，不以临时 DOM 引用作为跨异步更新的契约；具体字段名、类型和命名方式在 P0 设计切片中裁定。
- 所有异步更新仍必须受 `UISurfaceRuntime` 的 surface token / generation 约束；旧 surface 的请求不得写入新 surface。
- Tooltip 规则按实际替换范围判断：被替换范围内的 anchor 关闭，其余仍连接的 anchor 保留；整 App render 才关闭 App 内部全部 anchor。
- 不以 JavaScript 调用次数代替浏览器布局、绘制或交互体验证据；Hover、滚动、焦点和视觉连续性必须有浏览器级验收。

## 当前事实与代码落点

- `UIUpdateDispatcher` 已区分 `behavior`、`element`、`region`、`structure` 更新，并具备 surface token、generation、去重、合并和过期请求丢弃能力；`element` 当前稳定目标包括 `spot.card`、`enhancement.card` 与 `area.nav`。
- `UIController.refreshLight()` 能对 `data-resource`、`data-gain`、`data-spot-yield` 做状态文本更新；普通 Tick 可保持在 behavior 层，但待处理 reward / travel chat 时仍会降级到完整 render。
- `UIController.refreshPanels()` 仍以 Panel `outerHTML` 替换为主，但已移除默认 root 级 `dismissBeforeRootMutation()`；现在只对实际被替换的 Panel 调用范围关闭。该实现优先于 `task-0086` 中未经源码复核的历史完成描述。
- chat、log、Shop Region 的直接替换路径当前已分别传入局部范围给 `dismissBeforeRootMutation()`；旧审计文档中将这些路径一概描述为“全局关闭”的内容需要视为历史快照，后续以源码和集成测试为准。
- `render()` 会通过 `root.innerHTML = renderAppShell(...)` 重建 App 根节点，仍应保留为确有结构、主题或 Workspace 变化时的最后一级降级。
- Runtime Editor 批量 Apply 仍逐项触发 `spotDefinitionChanged`，但 UI Controller 现在提供批量刷新抑制边界；批次内不重复做揭示刷新，成功或部分失败后由调用方保留一次明确 render。
- 主题路径暂不纳入内容 `element` / `region` 刷新契约：已提交的 `themeChanged` / `userThemeChanged` 同时改变 root token、scope token、presentation 状态、背景图层和部分内容态，当前继续使用 `render()` 作为安全降级；主题编辑预览则使用 `refreshTheme()` 做 CSS / background 原地更新。主题背景节点目前不承载 tooltip anchor，若未来承载交互锚点，必须先接入 mutation range 生命周期再改成局部替换。

## 建议优先级与本次调整

| 优先级 | 建议 / 修改内容 | 完成判据 |
| --- | --- | --- |
| P0 | 设计 Panel 细粒度刷新 API，并将刷新目标显式分为字段、元素组、Region、Panel 结构和 App 结构 | 状态类内容更新不再默认替换整个 Panel；目标不可用时有明确降级和可观测原因 |
| P0 | 按实际 mutation range 修正 popover 生命周期，移除或限制 `refreshPanels()` 的 root 级关闭 | 刷新 left / right 时 center tooltip 保持；被替换 Panel 内 tooltip 正确关闭 |
| P1 | 建立内容更新到最小字段 / Region 的映射，优先覆盖 Spot 揭示、产出、可用性、Area / Init 导航和 Shop 状态 | 同一 Panel 内的非目标 hover、滚动和焦点不被打断 |
| P1 | 为 Runtime Editor 批量 Apply 增加刷新合并边界，批次内只在提交完成后做一次必要的 UI reconciliation | 批量 N 项变更不会产生 N 次重复 Panel / Workspace 刷新；失败项仍能及时反馈 |
| P2 | 将主题 host / background 的局部替换接入相同的 range lifecycle，或明确记录其暂缓理由 | 不再存在未定义的局部 DOM 替换与 tooltip 生命周期组合 |
| P2 | 测量并收敛 Tick 中 reward / travel pending 导致的完整 render fallback | 正常 Tick 保持 behavior 更新；待处理通知不会在连续 Tick 中重复完整 render |
| P2 | 补齐调用链、刷新计数和浏览器级 Hover / scroll / focus 验收证据 | 能区分“调用被合并”与“真实 DOM / 视觉更新减少” |

## 施工切片

### P0：刷新目标与范围契约

- [x] 在现有 `UIUpdateDispatcher` 请求模型上补充 `element` 目标类型；首个目标 `spot.card` 通过稳定 `data-ui-spot-card` 定位。
- [x] 明确四类写入语义：behavior、element、Region、Panel / App 结构；元素集合变化时回退到 Panel。
- [x] 明确元素请求的去重键、优先级、surface 校验和 `element-target-missing` 诊断。
- [x] 保持组件只消费 `getView()` / `createUIContext()` 的只读面，不把写引用泄露给内容层。

### P0：Popover 与 Panel mutation 集成

- [x] 移除 `refreshPanels()` 对不相关 Panel 的 root 级 `dismissBeforeRootMutation()`，改为对每个实际替换范围调用。
- [x] 增加 controller 集成测试：center tooltip 在 left / right 刷新后保持；left tooltip 在 left 被替换时关闭。
- [x] 为 chat、log、Shop Region 的局部替换补齐 tooltip 保留/关闭断言，防止后续回归成全局 dismiss。
- [x] 验证 behavior 更新不改变目标 Panel 节点身份，也不触发无关 tooltip 重建。

### P1：内容更新最小映射

- [x] 建立 Spot reveal → 当前区域 Spot 卡片元素更新的第一条映射；卡片集合变化时回退右 Panel。
- [x] 扩展资源产出、Area 导航、Enhancement 卡片、Shop catalog / settlement 的字段 / Region 映射；资源产出走 behavior，Area / Enhancement 走 element，Shop 走 region。
- [x] 记录无法安全局部更新的结构变化，并明确其 Panel / Workspace 降级条件；更高熵的 Init / 语义节点扩展转入 [[task-0100-ui-semantic-region-mapping-follow-up]]。
- [x] 对本 Task 已落地的 Spot / Area / Enhancement / Shop 映射补充节点身份、Popover、滚动、焦点和异步过期请求的测试断言。

### P1：Runtime Editor 批量刷新合并

- [x] 选定批量 Apply 的提交完成边界，延迟 UI reconciliation 到批次结束；不改变引擎提交和失败语义。
- [x] 使批次内的 `spotDefinitionChanged` 事件不会逐项放大为重复完整 render，由 UI Controller 批量边界抑制。
- [x] 记录本轮浏览器验收中的 behavior / Region / Panel / full 计数变化；更细的 Runtime Editor 批量 N 项断言转入 [[task-0100-ui-semantic-region-mapping-follow-up]]。

### P2：主题路径、Tick fallback 与验收

- [x] 决定主题 host / background 暂不纳入内容刷新契约，并记录原因：主题提交同时影响多层 token、presentation 和内容态；预览保留 `refreshTheme()` 的局部 CSS / background 更新，正式提交保留 full render 降级。
- [x] 检查并收敛 pending reward / travel chat 的 full render fallback 批次去重和顺序保护。
- [x] 为 pending reward / travel chat 的 Tick fallback 增加“同一队列状态只 render 一次”的去重保护。
- [x] 使用真实 Chrome CDP 验证 `behavior`、`region`、`panels`、`full` 四类路径的 Hover、滚动、焦点和页面结果。

## 测试与验收

必须覆盖：

- center tooltip 在刷新 left / right Panel 后仍存在且 anchor 仍连接；刷新 center 时 tooltip 才关闭；
- chat、log、Shop Region 的局部替换只关闭自身范围内 tooltip；
- 资源 / 产出等状态更新只改目标字段，不替换 Panel 节点；
- 旧 surface 的异步请求被丢弃，不向新 Workspace / route 写 DOM；
- Runtime Editor 批量变更产生预期数量的 UI 刷新，且失败项仍有反馈；
- 普通 Tick 不触发完整 render；pending 通知 fallback 不在连续 Tick 中重复放大；
- 主题或背景局部替换不破坏 hover；若暂不纳入统一契约，必须在验收记录中明确该限制。

建议核验命令：

- `npm run ui:callgraph -- --hot`
- `npx vitest run tests/ui/popovers.test.ts tests/ui/ui-update-dispatcher.test.ts tests/ui/workspace-lifecycle.test.ts tests/ui/shop-modal.test.ts tests/ui/controller-events.test.ts`
- `npx tsc --noEmit`
- `npm run check:architecture`
- `npm run check:docs`

## 当前核验（2026-09-18）

- 已完成刷新调用链调查：UI 文件 96 个、定义 1975 个、可靠调用边 2736 条、DOM 写入点 205 个（分布于 107 个函数）。`refreshPanels` 是高入度刷新入口之一。
- 已运行 `npm run ui:callgraph -- --hot`，命令通过。
- 已运行 UI 目标测试，当前相关测试覆盖区域导航、Spot / Enhancement 元素刷新、`refreshPanels()` 的跨 Panel tooltip 保留、`element` 调度器和 Tick fallback 去重。
- 全量 `npm test -- --reporter=dot --silent` 已通过：171 个测试文件、1595 个测试全部通过；`story-entry-split` 的随机抽选不确定性与 Runtime Editor 错误回显断言均已在当前工作树状态下验证收敛。
- 当前源码核验显示：Panel 路径已按 mutation range 关闭 popover；chat / log / Shop 路径已有局部 scope 处理；pending 通知 fallback 已完成同一队列状态去重；主题正式提交按记录的安全降级决策保留 full render，预览仍走 `refreshTheme()` 局部更新。
- 已修改刷新调度、Panel/Spot/Enhancement/Area 元素渲染、Controller Events、Runtime Editor 批量边界与对应测试；工作区原有其它改动保持不变。
- CUA 枚举因 `nodeRepl.fetch request failed` 不可用；已改用真实 Chrome CDP 完成浏览器级 Hover / scroll / focus 验收，不把源码测试结果冒充视觉证据。
- 已补充真实 Chrome CDP 验收：behavior 计数由 100 增至 104 而 full 保持 1；Shop Region 更新使 region 计数由 0 增至 1 而 full 保持 3；Panel 更新后未替换的左侧 tooltip 保持打开，中心焦点保持，右侧滚动位置由 80 保持为 80；设置导航使 full 由 4 增至 5 并进入 Settings Workspace。该证据不依赖失效的 CUA 枚举。

## 剩余工作

- [x] 完成刷新机制调查与建议优先级整理。
- [x] 创建本 Task 并同步任务索引。
- [x] 完成 P0 刷新目标 / mutation range API 设计与实现（首个 `spot.card` 目标）。
- [x] 完成 P0 Panel / popover controller 集成测试与回归修正。
- [x] 完成当前 Task 范围内的 P1 内容更新映射；Init 文案、可用性汇总、ARIA / 主题语义节点扩展已拆至 [[task-0100-ui-semantic-region-mapping-follow-up]]。
- [x] 完成 P1 Runtime Editor 批量刷新合并边界。
- [x] 完成 P2 Tick fallback 的基础去重实现；主题正式提交保留 full-render 安全降级，编辑器预览走 `refreshTheme()` 局部更新。
- [x] 完成 TypeScript、架构与文档检查。
- [x] 消除 `story-entry-split` 测试对随机抽选的依赖。
- [x] 完成浏览器级 Hover / scroll / focus 验收（真实 Chrome CDP；CUA 枚举仍不可用）。

## 相关路由

- [[task-0086-ui-dom-refresh-boundaries-and-hover-preservation]]
- [[task-0067-ui-update-dispatcher-stage2]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/01-architecture/data-flow]]
- [[docs/docs-828/07-audit/dom-refresh-chains]]
- [[docs/docs-828/05-conventions/testing]]
- [[task-0100-ui-semantic-region-mapping-follow-up]]
