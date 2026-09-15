# Task-0067：UI 更新调度第二阶段（Reveal 分类与 Keyed Reconcile 评估）

状态：proposed — 待施工

> 本文承接 [[task-0045-ui-incremental-update-workspace-isolation]] 的 P5–P6。该任务 P0–P4 第一施工片段已完成并通过验证；P7 中与 Contacts / Story 相关的部分已由 [[task-0047-contacts-story-workspace-ownership]] 承接。

## 目标

- 把跨 Spot / Enhancement / Init / Area / Story 的单字符串 Reveal fingerprint 拆成分类指纹，并把已知事件映射到最小 UI Region；
- 把 `onAny` 收窄为兼容诊断入口；
- 在**有测量证据**的前提下评估 Keyed Collection Reconcile，而不是提前引入。

## 当前事实与代码落点

- Surface Token 与更新调度：`src/ui/update/ui-surface.ts`、`ui-update-types.ts`、`ui-update-dispatcher.ts`、`ui-behaviors.ts`。
- 调度与观测：`src/ui/controller.ts`、`src/ui/controller-core.ts`、`UIController.getRefreshStats()`。
- 事件入口：`src/ui/controller-events.ts`（当前 `onAny` 对非 Tick / 非 SpotProduced 事件统一触发 Reveal 检查与日志刷新）。
- 引擎条件反向索引（不重复实现）：`src/engine/expression/condition-deps.ts`、`src/engine/visibility/`。

## 施工切片

### P5：Reveal 分类与显式 UI 事件映射

- [ ] 把单字符串 fingerprint 拆成按域分类的 fingerprint；
- [ ] 把已知事件映射到最小 UI Region，减少无关区域重建；
- [ ] `onAny` 降级为兼容诊断，不再是主路径；
- [ ] 对照 `VisibilityEngine` / `ConditionDepIndex`，决定是否需要 UI 专用依赖投影。

### P6：Keyed Collection Reconcile 评估（条件触发）

- [ ] 只有在 Region 重建被测量证明为瓶颈时才引入；先覆盖单一列表，再评估推广。

## 非目标

- 不在本任务内重做 P7 已归入 [[task-0047-contacts-story-workspace-ownership]] 的部分；
- 不修改 Shop 交易语义、`PlayerState` 结构或 `GameCommands` 边界；
- 不新增持久状态或存档迁移。

## 测试与验收

```text
npx tsc --noEmit
npm test
npm run check:architecture
```

- 分类 fingerprint 能区分不同域的 Reveal 变化；
- 已映射事件只触发目标 Region，未受影响 DOM 节点身份不变；
- Keyed Reconcile 若引入，必须先给出 Region 重建耗时证据。

## 剩余工作

- 本文自身全部切片待施工。

## 相关路由

- [[task-0045-ui-incremental-update-workspace-isolation]]
- [[ui-incremental-update-workspace-isolation-draft]]
- [[task-0047-contacts-story-workspace-ownership]]
- [[docs/docs-828/02-modules/ui]]
