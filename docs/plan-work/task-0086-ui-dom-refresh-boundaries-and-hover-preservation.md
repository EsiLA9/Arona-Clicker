# Task：UI DOM 刷新边界与 Hover 保留

状态：active — 🟡 调查完成，P0 第一批低风险收敛已施工，继续验证

## 目标

降低不必要的激进 DOM 刷新，保证局部刷新只影响其实际覆盖范围，并避免刷新后出现跨区域 hover 被误关闭或陈旧 tooltip 残留。

## 设计边界

- 当前“编辑器”语义仍指游戏内 UI；本任务只处理 `src/ui/` 运行时 UI，不处理已弃用的 `tools/datapack-editor/`。
- 不改变引擎事件语义、Spot 热内容事务、Workspace 路由和存档结构。
- 不在本任务内引入框架式 keyed diff；优先复用现有 `PopoverManager`、panel/region 刷新和 UIUpdateDispatcher。
- 全量 `render()` 仍允许用于真正的 Surface / 结构变化；本任务只减少可证明不必要的升级和误伤。
- 不将 tooltip 内容缓存为跨实体的长期状态；锚点被替换后必须关闭或重新绑定。

## 当前事实与代码落点

### 刷新入口

| 入口 | 当前行为 | 主要风险 |
| --- | --- | --- |
| `refreshLight` | 通过 behavior dispatcher 修改数值节点 | 正常 Tick 安全；待落账通知会退化为全量 render |
| `refreshPanels` | 替换指定 left/center/right panel | dismiss 逻辑按整个 `#app` 判断，误伤未刷新 panel 的 hover |
| `refreshChatPanel` | 直接替换 `.chat-pane` 或转为 center panel 刷新 | 直接替换分支没有统一 tooltip 生命周期 |
| `refreshLogPanel` | 直接替换 `.log-panel` | 直接替换分支没有 tooltip 生命周期 |
| `refreshShopRegions` | 替换指定 Shop Host region | 未处理被替换 region 内的 tooltip |
| `render` | `root.innerHTML = renderAppShell(...)` | 会重建全部 `#app` 锚点；Runtime Editor 提交可能重复进入 |
| `refreshPresentationHostElementsIn` | 替换表现背景子节点 | 当前一般不含 hover 锚点，但缺少统一替换边界契约 |

### 关键已确认问题

1. `PopoverManager.dismissBeforeRootMutation()` 只判断锚点是否属于 `#app`，没有刷新范围参数；`refreshPanels(['left', 'right'])` 因此会关闭 center 上的 hover。
2. Chat / log / Shop region 的直接 `outerHTML` 替换绕过 `retainIfAnchored` / `dismissBeforeRootMutation`；锚点断开后 tooltip 可能继续显示旧内容。
3. Runtime Editor 逐个提交 Spot 时发出 `spotDefinitionChanged`，提交结束又显式 `ctrl.render()`；事件刷新和完成刷新可能叠加。
4. UIUpdateDispatcher 已有 behavior / region / structure、surface token 和 generation，但 panel 与 chat/log 的直接替换尚未纳入同一范围模型。

完整调查证据见 [[docs/docs-828/07-audit/dom-refresh-chains]]。

## 施工切片

### P0：建立按替换范围关闭 Hover 的基础能力

- [x] 扩展 `PopoverManager`，支持以具体 DOM 范围判断当前锚点是否会被替换。
- [x] `refreshPanels` 只关闭待替换 panel 内的 hover；未刷新 panel 的 hover 保持。
- [x] `render()` 保持全量关闭 `#app` 内陈旧锚点的语义。
- [x] 为跨 panel hover 保留和被替换 panel hover 关闭补 Vitest 测试。

### P1：收口直接局部替换路径

- Chat / log / Shop region 替换前调用同一范围化生命周期。
- 至少保证锚点已断开时 tooltip 不得继续保持 `is-open`。
- 检查主题表现背景替换是否需要同样接入；若当前没有实际 hover 锚点，记录为 deferred，不扩大任务范围。

### P1：减少 Runtime Editor 提交的重复重建

- 先以现有统计与调用链确认重复重建的可复现组合。
- 让一批 Spot 提交尽量在提交完成处统一收敛 UI 更新；不改变 Coordinator 的事务和回滚边界。
- 保留失败路径的即时错误展示和成功后的编辑器状态刷新。
- 若需要引入批量事件或新的 dispatcher 更新类型，另行拆出子任务或 ADR，不在本切片中隐式扩展协议。

### P2：高频退化路径与诊断

- 为待落账通知导致的 `refreshLight → render` 增加去重/统计核验。
- 保持 `data-ui-refresh-*` 与 `UIRefreshObservation` 可用于浏览器验收。
- 不为了降低计数而牺牲聊天通知顺序或事件驱动一致性。

## 测试与验收

### 必须通过

- `npx tsc --noEmit`
- `npx vitest run`（或最终 `npm test`）
- `npm run check:docs`
- `npm run check:architecture`

### UI 专项验收

| 场景 | 验收口径 |
| --- | --- |
| hover center，刷新 left/right | tooltip 保持打开，锚点仍连接 |
| hover 被刷新的 panel | tooltip 关闭，不残留旧内容 |
| chat pane 局部刷新 | tooltip 不得绑定断开的锚点 |
| Shop 单 region 刷新 | 其他 region hover 保持，被刷 region hover 关闭 |
| Runtime Editor 批量更新多个 Spot | 只发生必要的刷新，不能因每个 Spot 提交额外重建整页 |
| 普通 Tick | 只产生 behavior patch，不产生 full render |
| 待落账通知 Tick | 通知顺序正确，退化刷新不持续重复 |

## 当前核验（2026-09-17）

- 已完成源码调查：`src/ui/controller.ts`、`controller-core.ts`、`controller-events.ts`、`controller-theme.ts`、`popovers.ts`、`ui/update/*`、Runtime Editor actions、Runtime 装配。
- 已执行 `npm run ui:callgraph -- --hot`，确认 `refreshPanels` 是高入度刷新入口，UI DOM 写入点共 191 个。
- 已创建调查文档 [[docs/docs-828/07-audit/dom-refresh-chains]]。
- 第一批实现：Popover 按替换范围关闭；panel、chat、log、Shop region 局部替换均接入范围化关闭。
- 第一批测试：`tests/ui/popovers.test.ts` 已覆盖跨范围保留、范围内关闭和全量关闭。
- 已验证：专项 UI 测试 3 个测试文件 / 10 个测试通过；全量测试 164 个测试文件 / 1542 个测试通过；`npx tsc --noEmit`、`npm run check:docs`、`npm run check:architecture` 均通过。

## 剩余工作

- [x] P0 范围化 Popover 生命周期与测试
- [x] P1 直接局部替换路径接入（第一批）
- [ ] P1 Runtime Editor 提交刷新去重
- [ ] P2 Tick 退化路径核验
- [x] 类型、专项测试、文档检查
- [x] 全量测试、架构检查
- [ ] 浏览器验收并记录刷新计数与 hover 行为

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/07-audit/dom-refresh-chains]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/05-conventions/testing]]
