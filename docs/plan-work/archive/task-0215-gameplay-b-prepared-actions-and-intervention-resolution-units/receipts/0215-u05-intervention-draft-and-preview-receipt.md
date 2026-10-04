# Receipt 0215-U5

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 在 `operation-beat.ts` 增加受限 InterventionDraft、预览输入/输出与稳定错误码；新增纯 `operation-intervention-preview.ts` 和定向测试。 |
| Draft 形状 | Draft 仅含 `actorId`、可选 `actionId`、`targetActorId` 与 `reasonId`。禁止客户端附加成本、效果、delta 或替代计划字段。省略 action/target 即沿用当前基础 PreparedBeat 的行动或 U4 自动目标；草稿是完整提案，不与旧草稿字段隐式合并。reason 必须来自受信 Profile candidate 或 Action definition。 |
| 候选与目标 | 只能指挥当前 Event 中的学生；替换行动必须是其静态合格 Profile candidate，且在当前 Location 启用。action-only 使用 U4 确定目标；target-only 要求原计划已是学生行动；action+target 与 target-only 都经 U4 的 team relation/声明 Actor 检查。当前草稿占用的 Actor 不同于新提案时，必须先清除再切换。 |
| 版本与纯度 | 预览要求 snapshot planVersion、输入 PreparedBeat 与当前冻结内容重新准备出的 U4 基线完全一致，返回值携带同一基础 planVersion。U5 不写 Run、不递增版本、不消费随机流，也不修改 snapshot/content。U8 接受或清除 Draft 后递增 Run 版本，并将未变更的基础 PreparedBeat 绑定到该新版本。 |
| 预算与基线 | 先固定现有 PreparedBeat 的所有 Actor 计划，只替换被指挥学生的一项；预算探测按 Event Actor 声明顺序复查。若新行动本身无法支付，或导致保留的后续行动无法支付，则拒绝 Draft。其他 Actor 原行动、Wait、目标、费用、来源和理由都从基线逐字段保留；降费释放出的资源不会将 Wait 计划升级成新行动。 |
| 协同边界 | 预览结果提供新 PreparedBeat 和其费用/目标投影，供 U6 协同判定使用；U5 不运行 Combination、RNG 或效果结算。 |
| GALHCG 影响闭环 | 项目 `acprogram` 的 contracts、services、tests/engine 与 plan-work 范围已定向刷新；4 个 U5 路径均由 `resolve_paths` 成功解析。`review_changes` 对路径均返回 `unreferenced_path`，没有既有 Evidence owner 待分页；新的 Intervention/preview 语义映射留 U9。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-intervention-preview.test.ts` | 通过 | 1 个文件，7 tests passed；涵盖 action-only、target-only、action+target、自动目标、静态资格/地点过滤、reason 校验、stale/slot/预算拒绝、原计划不变与确定性。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无 TypeScript 错误。 |
| GALHCG | `refresh`、`resolve_paths`、`review_changes`（项目 `acprogram`） | 通过 | 4 条路径全部解析；全部是当前未映射路径，语义 owner 与 maps_to 留 U9。 |
