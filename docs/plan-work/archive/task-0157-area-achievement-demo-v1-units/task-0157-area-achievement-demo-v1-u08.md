# Unit 0157-U08：通过 GameReadModel 暴露成就投影

## Goal

让游戏内 UI 经 `GameReadModel` 获取 U07 的只读 Achievement 投影，不直接读取可写 PlayerState 或重算统计。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/01-architecture/data-flow.md`、`docs/ai/PROJECT-CONSTITUTION.md` | UI 只读边界 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit、U07 Receipt | 投影前置结果 |
| 源码 | `src/arona-clicker/read-model/achievement-view.ts`、`src/arona-clicker/contracts/runtime.ts:GameReadModel`、`src/arona-clicker/runtime-game-instance.ts:getView`、`src/engine/stats/stats.ts:getSnapshot` | 投影组合与只读接口 |
| 测试 | `tests/engine/achievement-view.test.ts` | 运行时门面验证入口 |

## Context Budget

目标约 10k–18k tokens；只看上述符号，超出 2 个额外文件或 60k tokens 时停下上报。

## Optional Read Set

- `src/ui/context.ts` 的 `UIContext.game` 类型，仅在确认 UI 可调用面时读取。

## Do Not Read by Default

- UI 组件与控制器、编辑器、历史计划、效果和导入路径。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| U07 已提供纯 `buildAchievementView` 并复制输出值 | `src/arona-clicker/read-model/achievement-view.ts`、U07 Receipt | 无需重写投影 |
| `GameReadModel` 是组件可读取的运行时接口，`GameInstance.getView()` 已组合 Registry/State/Stats | `src/arona-clicker/contracts/runtime.ts`、`runtime-game-instance.ts` | 新方法沿同一只读模式 |

## Constraints

- 在 `GameReadModel` 增加 `getAchievementView(): readonly AchievementViewItem[]`，GameInstance 每次调用从当前 Registry、State、Stats 快照派生，不缓存可失效的列表。
- 仅类型引用投影类型；运行时代码不让 UI 获取写引用。沿用 U07 的发现、排序、进度口径。
- 不新增 GameEvent、存档字段或新的全局状态。

## Allowed Files

- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `tests/engine/achievement-view.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u08-receipt.md`

## Explicit Non-goals

- 不修改 U07 纯投影、Records UI、事件刷新、编辑器或数据包内容。
- 不为 Achievement 添加独立完成、领取或奖励账本。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若类型引用造成架构环或须修改白名单外接口，停下给出证据。

## Completion Criteria

- [ ] GameReadModel 的只读方法与 GameInstance 实现一致，UIContext.game 类型可访问。
- [ ] 调用反映当前到访/统计/完成状态，返回值不暴露可写 Registry/State 对象。
- [ ] Receipt 记录实际验证。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/achievement-view.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 架构 | `npm run check:architecture` | 通过 |
| 文档 | `npm run check:docs` | 通过 |
