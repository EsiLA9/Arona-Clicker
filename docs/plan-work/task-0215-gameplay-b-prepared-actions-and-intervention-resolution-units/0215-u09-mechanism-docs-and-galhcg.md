# Unit 0215-U9：Operation Runtime 机制文档与 GALHCG 收尾

## Goal

把已稳定的 Task 0215 实现事实写入唯一权威 Operation Runtime 文档，并闭合相关 GALHCG 证据。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/01-architecture/data-flow.md` | 当前机制事实与数据流文档边界 |
| 文档 | `docs/ai/galhcg-project-map.md`、`docs/docs-829/05-conventions/doc-maintenance.md` | GALHCG 查询/变更与文档维护规则 |
| 源码/测试 | 最终完成的 U1–U8 Receipt 所列实际文件 | 只记录已实现并有测试证据的机制 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 8k–25k token |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 保留操作主流程与契约边界，内部 helper 不写入机制页 |

## Optional Read Set

- `docs/docs-829/02-modules/arona-clicker.md`：只在真实模块入口改变且模块页拥有对应职责时读取。

## Do Not Read by Default

- 归档机制正文、Task 0216 UI 文档、未来 Save/Registry 实现、GALHCG 无关 Concept。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前 operation-runtime.md 是 AC Operation owner、入口和生命周期的权威机制页。 | `AGENTS.md`、`docs/docs-829/00-INDEX.md`、该机制页 | 只在稳定实现后修订。 |
| Task 实现后需按 GALHCG 对直接受影响的源码/测试/文档做变更复核。 | `docs/ai/galhcg-project-map.md` | 不把中间 DTO/helper 自动转为 Concept。 |

## Constraints

- 每项实现陈述必须与 U1–U8 源码、定向测试及 Receipt 对齐；测试未覆盖的语义不得当作事实。
- 说明 ActionDef 唯一受信来源、Team 与 PlayerCost 边界、准备/干预/Commit、版本和原子性、局部 RNG/Resolution。
- 仅当 `data-flow.md` 的真实产品数据流职责需要改动时同步更新；不要复制整篇 Runtime 机制内容。
- GALHCG 对现有 Operation Runtime Concept 调整 summary/maps_to/evidence；Prepared Action、Intent、Resolution 只有在跨模块稳定复用后才建立 Concept。

## Allowed Files

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`
- `docs/docs-829/01-architecture/data-flow.md`（仅当证据证明数据流页须更新）
- `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md`
- `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/**`

## Explicit Non-goals

- 不改源码、历史 Task、AI 协议、AGENTS.md 或 GALHCG 无关节点。
- 不因 Task 收尾自动把 Task/Unit 设计提案升级为当前实现事实。
- 不归档 Task，除非 Task Owner 确认 U1–U9 Acceptance/验证全部通过。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件默认六条执行；若地图 evidence path 无法闭合、实现和 Task 冲突或文档页权威归属不清，停止并上报。

## Completion Criteria

- [ ] Operation Runtime 文档描述已实现 Beat 数据流、command boundary、Team/Actor resources、PlayerCost 分离、RNG cursor 与有限历史。
- [ ] `data-flow.md` 仅在直接相关信息需要变化时按最小范围更新。
- [ ] 对直接受影响的 GALHCG owners 执行 `review_changes`；freshness、evidence 路径及映射按工具结果维护并记录 Receipt。
- [ ] Task 0215 的验收、测试、Unit 与 Receipt 彼此闭合；归档由 Task Owner 后续步骤处理。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档结构 | `npm run check:docs` | 新链接与目录结构有效 |
| Diff | `git diff --check` | 无空白错误 |
| GALHCG | 按 `docs/ai/galhcg-project-map.md` 查询与复核变更 | 记录实际结果，更新必要映射 |
| 人工验收 | 对照 U1–U8 实际 Receipt 和源文件 | 无设计提案混入实现事实 |
