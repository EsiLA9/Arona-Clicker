# Unit 0309-U11：准备页来源失效回归

## Goal

用真实 Area 旅行改变准备页来源条件，证明来源 Spot 不再属于当前 Area 时安全回到原游戏路由且不清除活动 MapRun。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` 的 route 生命周期验收 | 要求来源／Area 失效后恢复 returnTo，并保留仍有效 Run |
| 测试 | `tests/ui/gameplay-b-basic-map-p0-p3.test.ts` 的 `bootToSpot` / `bootMap` | 复用真实设施入口、Story 解锁和页面宿主 |
| 源码 | `src/ui/controller.ts:isMapEntrySourceAvailable/render/returnFromMapEntry` | 确认 Area 改变后的恢复分支 |
| 源码 | `src/arona-clicker/runtime-commands.ts:travelToArea` | 使用现有 Area 旅行动作制造失效 |

## Constraints

- 仅通过当前真实可达 Area 调用公开 travel command 改变 Area；不直接改 GameState 或 DOM。
- 断言回到第一次入口的日常 Game route，原 active Run 快照完全相同。
- 不 abandon、restart 或修改 MapRun 领域字段。

## Allowed Files

- `tests/ui/gameplay-b-basic-map-p0-p3.test.ts`

## Explicit Non-goals

- 不改生产代码、route/store、Datapack、Schema 或 Area Map。
- 不修改其它 Task 的区域导航用例。

## Completion Criteria

- [x] Active MapRun 现场返回准备页后，切换离开来源 Area 会退出准备页。
- [x] 返回游戏的 current route 为 game，active MapRun 快照逐字段不变。
- [x] 相关 UI 回归与完整类型检查通过。
