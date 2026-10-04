# Unit task-0161-U04：归档 0158 并写回机制事实

## Goal

冻结 Task 0158 的最后已知状态，把其用户观察、剩余验收和修改范围交给 0161，并把已落地机制写回当前 docs-828。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md` 的 Task 文档结构 / docs-828 路由 | 归档与当前事实源规则 |
| 文档 | `docs/docs-828/05-conventions/doc-maintenance.md` | 当前机制文档更新规则 |
| 文档 | `docs/plan-work/task-0158-ui-theme-workspace-transition-refresh-audit.md` | 完整转移最后已知观察与未完成项 |
| 文档 | `docs/plan-work/task-0161-theme-background-layer-lifecycle-pipeline.md` | 唯一工作入口与验收 |
| 文档 | `docs/docs-828/04-mechanisms/color-derivation.md`、`docs/docs-828/02-modules/ui.md` | 事实更新落点 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–30k tokens |
| 文档 Read Set | 6 篇，Task 0158 是唯一必须读取的历史正文 |
| 历史文档 | 1 份，仅为完整接手证据 |
| 超预算处理 | 保留路由、拆分文档维护 Unit |

## Optional Read Set

- `docs/docs-828/01-architecture/data-flow.md`：在颜色/背景来源边界未解释时补读。

## Do Not Read by Default

- 其它 `docs/plan-work/archive/**`；无其它历史任务需要合并。
- `docs/newPlan/**`；项目禁止写入该目录。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Task 0158 是验收证据文档，原边界禁止改主题机制。 | 原 Task 0158 的目标 / 边界 | 归档时保留 active 最后状态。 |
| 用户明确要求把 0158 的验收和修改需求全部移交 0161。 | 本线程用户指令 | 0161 成为唯一活跃 Task。 |
| 稳定机制说明必须进入 docs-828，而不是停留在计划文档。 | AGENTS 与 `doc-maintenance.md` | 只记录已由源码/测试确认的事实。 |

## Constraints

- 按原样保留 0158 用户观察、已有证据和未完成范围；归档不表示完成。
- 正式计划引用使用裸文件名，00-index 不并列登记被归档 Task 为 active。
- docs-828 只记录实现事实与稳定契约。

## Allowed Files

- `docs/plan-work/archive/task-0158-ui-theme-workspace-transition-refresh-audit.md`
- `docs/plan-work/task-0161-theme-background-layer-lifecycle-pipeline.md`
- `docs/plan-work/00-index.md`
- `docs/docs-828/04-mechanisms/color-derivation.md`
- `docs/docs-828/02-modules/ui.md`

## Explicit Non-goals

- 不删除或改写归档的 0158 历史证据。
- 不借此裁定整套 Theme Editor IA 或颜色设计。

## Stop Conditions

按 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件六项执行；文档事实与源码/测试不符时停止并改 Task 记录为待核验。

## Completion Criteria

- [x] 0158 冻结归档，0161 接管所有用户报告与剩余验收。
- [x] 00-index 只把 0161 登记为当前施工项。
- [x] docs-828 描述来源快照、选择页投影、空覆盖与 Preview 替换事实。
- [x] docs-828 说明 Restart/撤离选择页不把运行快照中的当前 Area 主题叠加到 Init 焦点。
- [x] `npm run check:docs` 及本 Unit 受管文件范围的 `git diff --check` 通过（见执行收据）。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档检查 | `npm run check:docs` | 通过 |
| 差异检查 | `git diff --check -- docs/plan-work/archive/task-0158-ui-theme-workspace-transition-refresh-audit.md docs/plan-work/task-0161-theme-background-layer-lifecycle-pipeline.md docs/plan-work/00-index.md docs/docs-828/04-mechanisms/color-derivation.md docs/docs-828/02-modules/ui.md` | 本 Unit 管理的文档无空白错误 |
| 单一活跃入口 | 阅读 `docs/plan-work/00-index.md` | 只有 0161 当前推进 |

## Pre-flight

- Goal：归档 0158 并写回已确认机制事实。
- Allowed Files：以上五个文档。
- Explicit Non-goals：不删证据，不扩大 Theme Editor 策略。
- Stop Conditions：遵守本 Unit 六项停止条件。
