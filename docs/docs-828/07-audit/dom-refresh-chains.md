# 07-audit/dom-refresh-chains — DOM 刷新链条与交互状态边界审查

> 本文回答：**哪些 UI 刷新链会重建 DOM、它们会影响哪些交互状态，以及当前实现在哪些边界上可能误伤或遗留 hover。** 本文是 2026-09-17 的源码审查快照；代码是真相，整改后须重新核验。

> 整改记录（2026-09-17）：`PopoverManager` 已支持按实际替换范围关闭 tooltip；panel、chat、log、Shop region 的第一批局部替换入口已接入该能力。Runtime Editor 提交去重与全量刷新收敛在 2026-09-18 完成首批边界收敛；以下风险链保留为整改前调查证据，当前结论以最新源码与测试为准。

> 当前实现补充（2026-09-18）：`refreshPanels()` 已移除 root 级无条件 dismiss，Panel 刷新只关闭实际 mutation range；`UIUpdateDispatcher` 的 `element` 层当前覆盖 `spot.card`、`enhancement.card`、`area.nav`，集合不变时只替换对应元素；chat、log、Shop region 的直接替换入口已传入局部范围。Runtime Editor 批量 Spot Apply 已增加 UI 刷新抑制边界，pending reward / travel fallback 已按队列状态去重。主题正式提交仍保留 full render 作为安全降级，主题编辑预览使用 `refreshTheme()` 更新 CSS / background；主题背景当前不承载 tooltip anchor，未来接入交互锚点前必须补齐 mutation range 生命周期。下文 2026-09-17 的风险链保留为调查证据，当前状态以源码、`task-0096-panel-granular-refresh-api-and-hover-continuity` 和最新测试为准。

> 外部刷新补充（2026-09-18，task-0101）：已修复 Popover 延迟显示竞态。待显示 tooltip 现在受 mutation 取消、generation 与当前 root / `isConnected` 校验保护；`entityPresentationChanged` 按实体映射到可见元素、Region 或 Panel，不可见实体不再触发 `#app` 重建；同组揭示更新在输出未变化时保留节点身份；`onAny` 的日志替换增加最新 entry revision 判定。真实 Chrome 已复现并验证“hover 后 10ms 刷新、等待超过 80ms”不会打开断开锚点的旧 tooltip。主题正式事件仍按安全策略保留 full render。

## 结论摘要

当前 UI 已经存在轻量行为补丁、区域替换、panel 替换和 `#app` 全量重建四种表现层更新方式，但 hover 生命周期尚未按刷新范围统一管理。结果有三类问题：

| 等级 | 问题 | 主要位置 |
| --- | --- | --- |
| P1 | panel 局部刷新会关闭未被刷新的其他 panel 上的 hover | `src/ui/controller.ts:489-544`、`src/ui/popovers.ts:42-48` |
| P1 | 直接替换聊天、日志或 Shop region 时，已脱离文档的 tooltip 可能继续显示陈旧内容 | `src/ui/controller.ts:421-475`、`src/ui/controller.ts:768-799` |
| P1 | Runtime Spot 提交可能先被事件链刷新，再被提交完成逻辑再次全量刷新 | `src/arona-clicker/runtime.ts:39-50`、`src/ui/runtime-editor/actions.ts:317-337` |
| P2 | 主题背景 / 表现宿主的局部替换没有显式处理 hover 锚点，未来接入 tooltip 后容易复现同类问题 | `src/ui/controller-theme.ts:287-329` |
| P2 | `refreshLight` 的高频行为补丁本身安全，但待处理聊天队列会退化为全量 `render()` | `src/ui/controller-core.ts:75-89` |

## 刷新层级与理论影响范围

| 刷新入口 | DOM 操作 | 理论上应影响 | 当前交互风险 |
| --- | --- | --- | --- |
| `applyUIBehavior` | 修改既有节点的 `textContent` | 单个行为目标 | 低；不会替换 hover 锚点 |
| `refreshShopRegions` | 替换一个或多个主题 Host 的 `outerHTML` | 指定 Shop region | 中；没有 tooltip 生命周期处理 |
| `refreshChatPanel` | 替换 `.chat-pane` 或调用 center panel 替换 | 聊天区域 | 中；直接替换分支未关闭陈旧 tooltip |
| `refreshLogPanel` | 替换 `.log-panel` | 日志区域 | 中；没有 tooltip 生命周期处理 |
| `refreshPanels` | 替换 left/center/right panel | 指定 panel | 高；统一 dismiss 会误伤其他 panel |
| `render` | `root.innerHTML = renderAppShell(...)` | 整个 `#app` | 预期会关闭 `#app` 内 hover，但可能与其他刷新叠加 |
| `refreshPresentationHostElementsIn` | 替换背景子节点 / 删除背景节点 | 指定表现 Host 背景 | 当前低；缺少范围契约和回归保护 |

## 证据链一：Spot / 揭示事件导致的跨 panel hover 误伤

Runtime Editor 提交时，Runtime 会发出 `spotDefinitionChanged`：

```text
RuntimeContentCoordinator.commit
  → AronaClickerRuntime.onCommitted
  → eventBus.emit(spotDefinitionChanged)
  → UIController.onAny
  → refreshRevealIfChanged
  → refreshPanels(['left', 'right'])
```

`refreshRevealIfChanged` 的代码只认为揭示变化影响左右 panel（`src/ui/controller-core.ts:57-67`）。这本身是合理的范围判断，但 `refreshPanels` 在真正替换 panel 前调用 `popovers.dismissBeforeRootMutation()`（`src/ui/controller.ts:508-511`）。

`dismissBeforeRootMutation` 的判断条件是 hover 锚点是否仍属于整个 `#app`（`src/ui/popovers.ts:42-48`），不是是否属于待替换 panel。因此：

- hover 锚点在被替换的 left/right panel：关闭是正确的；
- hover 锚点在未被替换的 center panel：也被关闭，是错误的；
- `retainIfAnchored()` 先确认锚点仍连接，但随后无条件 dismiss，导致“保留”判断被覆盖。

这解释了“Spot 更新时其他内容上的 hover 被刷新”的现象。

## 证据链二：局部 `outerHTML` 替换留下陈旧 tooltip

`PopoverManager` 把 tooltip 放在 `body`，而 hover 锚点通常位于 `#app`。tooltip 是否关闭依赖 controller 在根节点变更前后调用 `retainIfAnchored` / `dismissBeforeRootMutation`。

但以下局部路径直接替换 DOM：

| 路径 | 代码 | 结果 |
| --- | --- | --- |
| 聊天直接刷新 | `src/ui/controller.ts:438-461` | `.chat-pane` 被替换前没有 dismiss；若锚点在聊天内，tooltip 可能保留旧内容和已断开的 `lastWrap` |
| 日志刷新 | `src/ui/controller.ts:466-475` | `.log-panel` 被替换前后都没有 popover 处理 |
| Shop region 刷新 | `src/ui/controller.ts:780-799` | 指定 region 被替换，但没有关闭该 region 内的 tooltip，也没有触碰其他 region 的 tooltip |
| 主题表现局部刷新 | `src/ui/controller-theme.ts:287-311` | 背景子节点可被替换 / 删除，当前没有统一的交互状态边界 |

其中聊天直接刷新尤其容易发生：Talklet 的 `chatTextShown`、`chatTextCleared` 等事件会调用 `refreshChatPanel()`（`src/ui/controller-events.ts:109-135`），而这些事件可能在用户正悬停聊天内容时发生。由于 tooltip 是 `body` 级节点，原锚点脱离文档并不会自动使 tooltip 消失。

## 证据链三：一次 Spot 提交的重复重建

Runtime Editor 的批量提交循环逐个执行 `createSpot` / `replaceSpot`（`src/ui/runtime-editor/actions.ts:317-324`）。每次提交都会触发 `spotDefinitionChanged`（`src/arona-clicker/runtime.ts:42-49`）。提交成功后，动作函数又执行：

```text
for each Spot mutation
  → spotDefinitionChanged
  → onAny / reveal refresh（可能触发 refreshPanels 或 render）
提交循环结束
  → openRuntimeSpotEditor
  → ctrl.render()
```

当当前界面不是普通游戏三栏，`refreshPanels` 还会在 `src/ui/controller.ts:498-504` 退化为全量 `render()`。因此一次提交可能发生一次事件驱动重建，再发生一次显式全量重建；多 Spot 提交还可能在 200ms 揭示节流窗口之外重复进入该链条。

即使揭示指纹没有变化，`ctrl.render()` 仍然会通过 `root.innerHTML` 重建整个 `#app`（`src/ui/controller.ts:614`），所以所有 `#app` 内 hover 锚点都会失效。

## 证据链四：高频 Tick 的安全分支与退化分支

正常 Tick 使用 UI behavior dispatcher：

```text
refreshLight
  → applyUIBehavior('spot.yield', ...)
  → applyUIBehavior('resource.value', ...)
  → applyUIBehavior('resource.gain', ...)
```

这些行为只写入既有节点的 `textContent`（`src/ui/update/ui-behaviors.ts:53-81`），不会替换 DOM，因此不会直接破坏 hover。

但若存在待落账的奖励或移动通知，`refreshLight` 会退化为 `ctrl.render()`（`src/ui/controller-core.ts:75-79`）。这条退化是为了避免消息丢失，但它把本来安全的高频刷新重新升级成全量 DOM 重建；若通知队列在多个 Tick 间持续存在，可能造成重复的交互抖动。

## 证据链五：刷新调度器已具备范围模型，但未覆盖直接刷新路径

`UIUpdateDispatcher` 已有 `behavior / region / structure` 三类更新、surface token、generation 校验和 region 优先级合并（`src/ui/update/ui-update-types.ts`、`src/ui/update/ui-update-dispatcher.ts`）。这能防止旧 Surface 把更新写回新 DOM，也能将同一 region 的行为更新合并掉。

但以下刷新没有统一纳入该范围模型：

- `refreshPanels` 直接操作 panel；
- `refreshChatPanel` 直接操作 `.chat-pane`；
- `refreshLogPanel` 直接操作 `.log-panel`；
- `refreshPresentationHostElementsIn` 直接操作表现背景节点；
- Runtime Editor 提交完成后的 `ctrl.render()` 仍是调用方自行决定的全量重建。

因此，surface 防陈旧更新与 popover 防陈旧锚点目前是两套不完整的边界系统。

## 风险分级与建议方向

### P1：按实际替换范围处理 Popover

建议把“即将被替换的 DOM 范围”作为 PopoverManager 的输入，而不是只有 `root` 级别的 dismiss：

- panel 刷新传入待替换 panel 元素或 panel host；
- region 刷新传入待替换 region host；
- chat / log 刷新传入具体内容节点；
- 只有 `render()` 这种 `#app` 全量重建才关闭所有 `#app` 内锚点；
- 锚点位于未受影响的 region 时保留 tooltip，并在必要时重新计算位置。

### P1：所有 DOM 替换入口统一经过交互生命周期

至少应形成以下不变量：

1. 替换前，若当前 tooltip 锚点属于替换范围，则关闭 tooltip；
2. 替换后，若锚点仍连接且未被替换，则 tooltip 保留；
3. 锚点已脱离文档时，tooltip 不得保持 `is-open`；
4. 任何直接 `outerHTML` / `innerHTML` 替换不得绕过该生命周期。

### P1：Runtime Editor 提交只保留一个 UI 收敛点

Spot 批量提交应避免每个定义变更都立即触发一次 UI 重建。可选方向：

- 提交期间收集 definition changes，提交结束后按当前 Surface 一次性刷新；或
- 事件订阅只更新引擎缓存 / 揭示状态，UI 由提交完成回调统一刷新；或
- 由更新调度器提供 definition batch / structure update，并在同一 microtask 内合并。

具体选择需另立实现任务；本文不预先裁定 API。

### P2：补齐回归测试与诊断

建议至少覆盖：

| 场景 | 验收 |
| --- | --- |
| hover 在 center，刷新 left/right | tooltip 保持打开，锚点与内容不变 |
| hover 在被替换 panel | tooltip 关闭，不残留旧内容 |
| chat pane 被局部替换 | tooltip 不得残留在断开锚点上 |
| Shop 一个 region 刷新 | 其他 region hover 保持，被刷 region hover 关闭 |
| Runtime Editor 批量更新多个 Spot | 统计中只出现预期数量的结构 / panel 重建 |
| Tick 普通生产 | 只出现 behavior patch，不出现 full render |
| Tick 携带待落账通知 | 明确记录一次退化 render，避免持续重复重建 |

已有开发诊断属性可用于验收：`data-ui-refresh-full`、`data-ui-refresh-panels`、`data-ui-refresh-region`、`data-ui-refresh-behavior`、`data-ui-refresh-dropped`；更新调度器还保留最近 200 条 `UIRefreshObservation`。

## 当前核验

- 已读取：`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/ui.md`、`docs/docs-828/02-modules/runtime-editor.md`、`docs/docs-828/05-conventions/doc-maintenance.md`。
- 已执行：`npm run ui:callgraph -- --hot`。
- 已核对：`src/ui/controller.ts`、`controller-core.ts`、`controller-events.ts`、`controller-theme.ts`、`popovers.ts`、`ui/update/*`、Runtime Editor actions、Runtime Content Coordinator 与 Runtime 装配。
- 2026-09-17 快照时尚未执行实现修复；2026-09-18 已完成首批实现、专项回归测试与真实 Chrome CDP 浏览器验收。主题背景仍按安全降级策略保留 full render，语义节点扩展及 Runtime Editor 批量精确计数另列入 `task-0100`。
- 2026-09-18 Task-0101 最终核验：全量测试 173 files / 1607 tests 通过；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（231 篇，0 errors）和 `npm run ui:callgraph -- --hot` 通过。Chrome CDP 验收结果：tooltip closed，旧 Spot anchor disconnected，未残留旧内容。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/01-architecture/run-logic]] · [[docs/docs-828/05-conventions/testing]]
