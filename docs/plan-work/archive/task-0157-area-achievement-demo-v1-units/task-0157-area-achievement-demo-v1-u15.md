# Unit 0157-U15：Milestone／Listener／Achievement 事实文档同步

## Goal

把已稳定的首期数据包声明、Area 准入、统计唤醒、一次性效果和诊断写入当前 `docs/docs-828/`，清除与实现冲突的旧 Milestone 描述。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/05-conventions/doc-maintenance.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 当前事实源与施工边界 |
| 计划 | Task 0157、本 Unit、U01–U14 Receipts | 已验收事实与边界 |
| 目标文档 | `docs/docs-828/03-data-structures/registry.md`、`docs/docs-828/02-modules/effect-trigger.md`、`docs/docs-828/04-mechanisms/trigger-effect.md` | 结构、模块、机制 |
| 源码 | `src/data-services/contracts/datapack.ts:MilestoneDef/MilestoneListenerDef/AchievementDef`、`src/arona-clicker/services/milestone-domain.ts`、`milestone-adapter.ts`、`src/arona-clicker/read-model/achievement-view.ts` | 文档真实性 |

## Context Budget

目标约 12k–20k tokens；额外阅读超出 2 个文件或 70k tokens 时停报。

## Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| Registry 新增 Listener/Achievement 表和引用/一对一校验 | U01/U02 Receipts、`registry.ts`、`registry-validate.ts` |
| Listener 关联目标按当前 Init 已访 Area 准入，两种累计 stat 精确唤醒；首次提交后执行 then，失败记日志不重放 | U03–U06/U13 Receipts、Domain/Adapter |
| Achievement 只读投影由 UI 消费；UI 细节已在 U14 同步 UI 卡片 | U07–U10/U14 Receipts |

## Constraints

- `registry.md` 只补表与校验关系，不叙述尚未实现的作者编辑器。
- `effect-trigger.md` 更新 Milestone Adapter 的能力及 Listener 效果职责。
- `trigger-effect.md` 修正旧 Milestone“无奖励/展示”的过期句子，写明首期 Area Listener 的准入/撤出、两种 Init 累计 stat 唤醒、一次性 `then`、Achievement 只读展示及不支持条件准入诊断；区分未关联 Listener 的旧 Milestone 行为。
- 明确本期仅 Area 范围；Init／全局 author scope、附加 `when`、前置成就和编辑器仍是后续方向，不写成现有能力。
- 文档短而可核对，不复制源码或 Task 施工过程。

## Allowed Files

- `docs/docs-828/03-data-structures/registry.md`
- `docs/docs-828/02-modules/effect-trigger.md`
- `docs/docs-828/04-mechanisms/trigger-effect.md`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u15-receipt.md`

## Explicit Non-goals

- 不修改源码、测试、UI 卡片、Task 主文档或历史计划。
- 不新增机制或提前宣称 Runtime Editor 支持。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若机制事实与 Receipt 冲突，以源码核实后停报。

## Completion Criteria

- [ ] 三份当前事实文档与实现一致，Milestone 的旧无效果/无展示绝对表述已修正。
- [ ] `npm run check:docs` 与 `git --no-pager diff --check` 通过；Receipt 记录。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 文档 | `npm run check:docs` | 通过 |
| 格式 | `git --no-pager diff --check` | 通过 |
