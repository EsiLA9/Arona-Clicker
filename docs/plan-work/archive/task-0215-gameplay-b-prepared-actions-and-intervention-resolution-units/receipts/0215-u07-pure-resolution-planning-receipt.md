# Receipt 0215-U7

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `operation-resolution.ts` 的 detached 快照/受信输入/结算批次合同；新增纯 `operation-resolution-planner.ts` 与定向测试。 |
| 基准计划与干预 | 从 Run 快照和冻结规则重算 U4 canonical PreparedBeat，并与 owner 保存的基准计划逐字段比较；仅接受该 Run 已保存的 InterventionDraft，再由 U5 重建干预后计划。陈旧或无效输入返回稳定诊断。 |
| 费用与随机 | 最终计划中的 Action 费用按 Event Actor 声明顺序，从提交起始 Actor/Team 余额预留；以十进制精确加减检查下限，所有费用通过后才调用 Student Skill RNG。结算内产出的资源不会支付本 Beat 的费用。费用记录保留来源，费用扣减也作为对应资源变化的负贡献。 |
| 技能与协同 | Skill 检查使用最终干预计划，按 Event Actor 顺序产生暂存 RNG cursor；随后按 U6 规则生成 Combination。命中的两个输入 Action 仍各支付一次，但原 Action 效果被组合替代；其 Student Skill 检查及成功效果仍保留。未写入 Run，也不提交 cursor。 |
| 数值变化 | Action、Intent、Combination、Skill 与支付按目标 numeric pool 聚合；精确十进制累计后每个 HP/resource/track 只限幅一次。输出 before/requestedDelta/delta/after 与稳定来源；目标键采用无歧义 tuple 编码，包含冒号的 Actor/resource ID 仍属于独立资源池。 |
| 纯度与错误 | 不接受调用方提供的效果、费用、技能 roll、协同结果或最终替代计划。成功及失败都不改写 Run 快照和受信内容；输出深冻结前会复制输入拥有的值。未知字段、越界/缺失引用、无效 target、非有限数值、陈旧计划及 RNG 错误均拒绝整批结果。 |
| GALHCG 影响闭环 | `acprogram` 定向刷新本 Receipt、contract、service、test 共 4 条路径；`resolve_paths` 4/4 均成功解析且不需再刷新。4 条 `review_changes` 都返回 `unreferenced_path`，当前没有既有直接 Evidence / `maps_to` owner 需要迁移；Resolution 概念映射留 U9 稳定后统一维护。`lookup("Operation Resolution")` 与 `lookup("战术结算")` 均完整零命中；`grep("operation-resolution")` 命中 3 个已建立 File 节点，未返回语义 Concept。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-resolution-planner.test.ts` | 通过 | 1 个文件，8 tests passed；覆盖共享 Team 与 Actor 费用、提交时起始余额约束（同 Beat 产出的资源不支付后续计划）、Combination 替代 Action 效果、Skill 保留、干预优先于技能/协同、同池相反贡献先合并再限幅、确定性、成功/失败输入纯度、陈旧/畸形计划诊断、无效资源引用及含分隔符 ID 的独立池。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无 TypeScript 错误。 |
| 文档检查 | `npm run check:docs` | 通过 | Receipt 加入后检查。 |
