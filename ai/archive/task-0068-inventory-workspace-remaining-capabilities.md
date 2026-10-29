# Task-0068：背包 Workspace 剩余能力（整理持久化、出售丢弃、来源筛选）

状态：proposed — 待施工

> 本文承接 [[10-inventory-workspace]]（原 `newPlan/` 草案，已归档）。背包三栏 Workspace 首版已实施；本文只承载首版明确暂缓的能力。

## 目标

- 落实背包整理的跨会话保留（自定义顺序 / 排序模式持久化）；
- 补齐物品出售 / 丢弃等背包侧操作，并明确其交易语义归属；
- 补齐来源、标签等筛选维度，并完成体验评审。

## 当前事实与代码落点

- 背包三栏 Workspace：`src/ui/components/inventory-workspace.ts`、`src/ui/inventory-view.ts`（`InventoryRow` / `sortMode` / `customOrder`）。
- 交互绑定：`src/ui/controller-actions-inventory.ts`。
- Workspace 状态：`src/ui/components/app-shell.ts`、`src/ui/controller-core.ts` 中的 `InventoryWorkspaceState`。
- 背包状态归属：`inventory` 为 per-Init 字段，见 [[docs/docs-828/03-data-structures/player-state]]。
- 服务页骨架：`src/ui/components/workspace-frame.ts`，契约见 [[docs/docs-828/02-modules/ui]]。

## 设计边界

- 出售 / 丢弃若涉及资源或物品回收，必须走 `StateMutationService` 与既有交易/扣除语义，不得在 UI 层直接改状态；
- 整理偏好属于 UI 层状态，是否持久化需先裁定归属层（global / per-Init），**不得**为了保留排序而把派生数据写进 `PlayerState`；
- 不引入存档迁移；结构变更按项目纪律直接清档。

## 施工切片

### P0：整理偏好归属裁定与落点

- [ ] 裁定自定义顺序 / 排序模式的保存层与生命周期；
- [ ] 落地保存与恢复，并补回归测试。

### P1：出售 / 丢弃

- [ ] 明确出售的 Cost / 回收事务语义归属（复用或扩展既有交易边界）；
- [ ] 实现出售 / 丢弃的写入口与 UI，含失败路径。

### P2：筛选与体验评审

- [ ] 补来源 / 标签筛选；
- [ ] 完成背包三栏 Workspace 的体验评审并记录结论。

## 测试与验收

```text
npx tsc --noEmit
npm test
npm run check:architecture
```

- 跨会话恢复整理结果正确，且不污染 `PlayerState` 派生数据；
- 出售 / 丢弃失败时不改变 `PlayerState` 与 Stats；
- 体验评审有明确记录，未执行项写「待验收」。

## 剩余工作

- 本文自身全部切片待施工。

## 相关路由

- [[10-inventory-workspace]]
- [[roadmap-0020-service-workspaces]]
- [[task-0039-spot-shop-transaction-system]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/03-data-structures/player-state]]
