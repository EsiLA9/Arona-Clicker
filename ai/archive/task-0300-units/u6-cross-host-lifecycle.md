# Unit 0300-U6：跨宿主命中与生命周期

状态：completed — 2026-10-19。

## Goal

让 Map 当前准备牌可以把 Flow 中的真实只读副本作为目标；两处共享同一 Object Key / Relation Key，实例键不同；回收、DOM patch 与拖拽来源移除不产生悬挂状态。

## Read Set

- `src/ui/workspace/map-relation-interaction.ts`
- `src/ui/workspace/map-dom-updates.ts`
- `src/ui/controller.ts` 的 `requestMapWorkspaceRefresh` / `reconcile`
- `tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/map-dom-updates.test.ts`

## Allowed Files

- `src/ui/workspace/map-relation-interaction.ts`
- `src/ui/workspace/map-dom-updates.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- `tests/ui/map-dom-updates.test.ts`

## Confirmed Facts

- `patchMapDOM` 先按 Flow entry key、focus/region key 协调。
- 交互 session 的 `current()` 从 `[data-map-workspace-region]` 取 runId。
- 目标命中已统一到 `targetAt()`；本 Unit 只补实例入口与生命周期。

## Scope

- Flow 卡面作为合法候选时参与同一 `targetAt()` 路径。
- Map 筹划 → Flow 射击副本只调用一次 `setMapPreparedCardTarget`；round / RNG / 余额不变。
- `mapNodeKey` 增加卡牌实例键，数值刷新保持节点身份。
- 拖拽来源被移除时取消编辑、移除 ghost 并释放 capture；其他副本关系继续有效。

## Explicit Non-goals

- 不实现作用线、跨窗口 portal、多目标或地点选择。
- 不让只读副本获得 source 权限。
- 不按 DOM 顺序改变领域候选。

## Completion Criteria

- 协同演练中 Flow 卡与 Map 卡 Object Key / Relation Key 一致、Instance Key 不同。
- Hover 任一射击副本，两处来源与候选高亮一致。
- Map 编辑目标点击 Flow 射击副本，只发送一次命令并更新草稿。
- Flow 卡点击 / pointerdown 不启动编辑或拖拽。
- Flow 条目移除只删除视觉实例；Map 目录与草稿不变。

## Stop Conditions

- 需要修改 Owner 候选或新增命令时停止。
- 需要新增跨窗口挂载入口时停止，转为后续 Task。

## Verification

- `gameplay-b-map-workspace.test.ts` 22 项通过。
- `map-dom-updates.test.ts` 5 项通过。
- `map-relation-interaction.test.ts` 16 项通过。
