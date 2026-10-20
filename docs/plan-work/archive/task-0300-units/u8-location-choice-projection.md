# Unit 0300-U8：地点选择身份与 Flow 候选投影

状态：completed — 2026-10-19。

## Goal

将当前地点移动器的直接按钮投影替换为带真实地点引用的只读 Flow 选择候选。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0300-gameplay-b-reusable-card-interaction.md` P6 | 地点选择的产品规则与边界 |
| 文档 | `docs/docs-829/06-wiki/50-ui/read-model-context.md` | UI 只消费当前 detached View |
| 源码 | `src/arona-clicker/contracts/runtime.ts:MapWorkspaceNodeView`, `MapWorkspaceEdgeView`, `MapRunActiveWorkspaceView` | 核实地点、邻接与条件投影 |
| 源码 | `src/ui/flow/map-flow-model.ts:moveChoicesEntry` | 替换现有直接移动按钮投影 |
| 源码 | `src/ui/cards/card-host.ts` | 复用 Object / Instance 与入口绑定 |
| 测试 | `tests/ui/map-flow-adapter.test.ts`、`tests/ui/card-host.test.ts` | 投影和绑定验收 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 约 12k–24k token |
| 文档 Read Set | 2 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k token 时拆分或交回上游 |

## Optional Read Set

- 无

## Do Not Read by Default

- `docs/plan-work/archive/**`
- MapRun Owner 实现；除非当前投影事实与 Task 冲突

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Active Workspace View 提供 Run、Map、当前地点与已评估的有向边条件。 | `src/arona-clicker/contracts/runtime.ts:MapRunActiveWorkspaceView`, `MapWorkspaceMapView`, `MapWorkspaceEdgeView` | 足以投影相邻地点和锁定说明 |
| 现有 `moveChoicesEntry` 将邻接边渲染成 `data-map-move-to` Action。 | `src/ui/flow/map-flow-model.ts:moveChoicesEntry` | 点击目前会直接请求移动 |
| Card Host 当前只接受卡牌专属的实例入口集合。 | `src/ui/cards/card-host.ts:MapCardEntry`, `mapCardBindingAttributes` | 本 Unit 增加地点选择入口名 |

## Constraints

- 服从 P6 与项目 UI Read Model 边界。
- 地点引用必须由 runId、mapId、nodeId 组成；Node 不进入战斗牌目录、Relation 或目标候选。
- 仅用 Map View 提供的 Edge 邻接与满足状态，不重算资源条件。

## Allowed Files

- `src/ui/cards/card-host.ts`
- `src/ui/flow/flow-entry.ts`
- `src/ui/flow/map-flow-model.ts`
- `tests/ui/card-host.test.ts`
- `tests/ui/map-flow-adapter.test.ts`

## Explicit Non-goals

- 不实现卡面渲染、选中态或确认交互。
- 不调用移动命令，不修改 MapRun、存档或 Runtime 契约。
- 不添加地点间作用关系或战斗目标能力。

## Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件全部 6 条。特别是：若需要改 Runtime Owner / View 契约、超出白名单或需要引入新的地点规则，停止并上交。

## Completion Criteria

- [ ] Flow DTO 有独立的地点候选类型，引用同时含 Run / Map / Node 身份。
- [ ] 每个地点候选有稳定 Object Key、不同视觉 Instance Key、标题、进度和已评估的可选择 / 锁定信息。
- [ ] 移动器不再投影可直接执行的 `data-map-move-to` Action。
- [ ] 测试覆盖相邻候选、锁定原因、非邻接排除与活动期间不投影。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `node node_modules/vitest/vitest.mjs run tests/ui/card-host.test.ts tests/ui/map-flow-adapter.test.ts` | 通过 |
| 差异检查 | `git diff --check` | 无空白错误 |
