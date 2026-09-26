# Unit 0157-U13：不支持条件的准入诊断

## Goal

Listener 关联的 Milestone 条件若无法建立可靠 Watch，首次取得 Area 准入资格时给出含目标身份与具体叶条件的 DevLog 诊断，避免静默显示为可运行目标。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/effect-trigger.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 运行时边界 |
| 计划 | Task 0157、本 Unit、U05/U06 Receipts | Watch 能力与日志事实 |
| 源码 | `src/arona-clicker/services/milestone-domain.ts:sourcesOf/deriveDesiredMilestoneWatches`、`src/arona-clicker/services/milestone-adapter.ts:applyDesired`、`src/engine/core/dev-log.ts:record` | 能力判断与准入日志 |
| 测试 | `tests/engine/milestone-adapter.test.ts` | 对账与不支持条件验证入口 |

## Context Budget

目标约 10k–18k tokens；额外阅读超出 2 个文件或 60k tokens 时停报。

## Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| 当前 `sourcesOf` 遇到任一不支持叶条件返回 undefined，目标不会生成 Watch | `milestone-domain.ts:sourcesOf/deriveDesiredMilestoneWatches` |
| Adapter 已获注入的 DevLog，但尚未记录无 Watch 原因 | `milestone-adapter.ts:constructor/applyDesired` |
| Area 到访后调用 `reconcileCurrent`，因此这里是本 Task 的准入点 | `init-service.ts:travelToArea/enterInit`、U04 Receipt |

## Constraints

- 复用 Domain 现有 `sourceOf` 判定，导出一个小型只读诊断函数，指出首个不支持叶的 target/key/comparator；避免第二份条件白名单。
- Adapter 仅对当前 Init 中已到访 Area、未完成且有 Listener 的 Milestone 报告；DevLog `source='milestone'`、`level='error'`，消息或详情包含 Milestone、Listener、Area ID 与叶条件。
- 每个相同定义运行时只报一次，重复 reconcile 不刷屏；若定义改变，则可报新诊断。
- 支持条件与未关联 Listener 的旧 Milestone 行为不变。不要把不支持目标变为错误完成或注册虚假监听。

## Allowed Files

- `src/arona-clicker/services/milestone-domain.ts`
- `src/arona-clicker/services/milestone-adapter.ts`
- `tests/engine/milestone-adapter.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u13-receipt.md`

## Explicit Non-goals

- 不扩展支持的 Condition 范围，不修改 Registry、Effect、UI 或示范包。
- 不让诊断改变准入条件或完成事实。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若复用 `sourceOf` 无法在预算内保留单一能力判定，停止上报。

## Completion Criteria

- [ ] 不支持叶在 Area 准入时被定位、只记录一次，重复对账不刷屏。
- [ ] 未到访、已完成及旧 Milestone 不误报；支持目标正常运行。
- [ ] 定向测试、类型与文档检查通过，Receipt 记录结果。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/milestone-adapter.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
