# Receipt 0215-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `src/arona-clicker/contracts/operation-skill.ts`、`src/arona-clicker/services/operation-action-content-validation.ts`、`src/arona-clicker/services/operation-tactical-definition-validation.ts`；修改 Operation/Resolver/Admission/Run-start 契约与 `operation-participant-admission.ts`、`student-operation-profile-resolver.ts`、`operation-definition-validation.ts`、`operation-runtime-service.ts`；迁移并扩展 4 个 Operation Runtime/Admission 集成测试；同步 U3 的非学生 Actor 资源验证与 U6 Skill 触发时序交接说明。 |
| 实现结果 | ActionDefs 与 Student Skill Rules 由构造期 Resolver 提供，经 Admission 和 Run-start input 到达私有 owner；删除 `OperationEventDef.actionRequirements` 并拒绝旧字段。Profile 静态候选门槛与理由从完整 ActionDef 投影，顺序、Wait fallback、冻结和 owner 防伪造复核保留。 |
| 内容校验 | 验证 Action/Skill ID 与闭合结构、Profile candidate/Skill trigger、Skill 概率与效果轨道、Location enabled Action、Combination tag/target kind、Action/Skill/Combination 的 Actor/Team resource 引用；所有无效内容都在 owner 写入 Run 前拒绝。 |
| 契约裁定 | Student Skill Rule 是有限的 `{id, triggerActionIds, chanceBps, effects}` DTO，effects 内联且只作用于 Operation 局部；不新增通用 Outcome 表/DSL。触发按干预后的最终学生 Action ID，在 Combination 消费前检查。实际 roll/效果仍留 U6/U7。活动 Task 0215 的“缺 Action 定义拒绝”要求取代归档 Task 0214 的静默 Action 集合交集。 |
| 未完成内容 | U3 将 ParticipantSpec 候选及非学生 Actor/Team resource 校验接入同一内容验证边界；U8 将 Action/Skill 和非学生候选深拷贝冻结进 per-Run private rules。U4 之后消费 Action/Team costs 与计划。 |
| GALHCG 影响闭环 | `operation-skill.ts`、`operation-action-content-validation.ts`、`operation-tactical-definition-validation.ts` 已按限定范围刷新并解析到 File 节点；三者目前尚无概念映射，U9 再确认唯一语义 Owner 并建映射。已有 Operation Runtime / Student Profile Admission 源码和测试的直接 Evidence owners 均 `content_changed`；对应 owner 分页已完整，汇总机制与 Evidence 更新留 U9，避免提前记录未完成 Action/Skill Runtime。 |
| 其他工作区 | 全库文档检查和类型检查被独立 Task 0229 的未提交改动阻塞，未修改该 Task。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-runtime-service.test.ts tests/engine/student-operation-runtime.test.ts tests/engine/operation-participant-admission.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts` | 通过 | 4 个文件，38 tests passed。 |
| 类型检查 | `npx tsc --noEmit` | 当前工作区失败 | 仅报告另一个未提交 Task 0229 的 `src/ui/selector-theme.ts:307` 两处 Background layer 类型不兼容；本 Unit 文件没有类型诊断。 |
| 架构检查 | `npm run check:architecture` | 通过 | 数据服务/Engine 边界检查通过。 |
| 文档检查 | `npm run check:docs` | 当前工作区失败 | 仅报告未提交 `task-0229-u5-editable-theme-save-service.md` 引用的两个 Theme 源码/测试路径不存在。 |
| Diff 检查 | `git diff --check` | 通过 | 仅有其他工作区文件的 CRLF 转换提示。 |
| GALHCG | `review_changes`（项目 `acprogram`） | 已检查 | 既有 owner 的 `content_changed` 状态及其直接 Evidence 已完整分页；新文件映射交 U9。 |

## 需后续处理

- U3 在 ParticipantSpec 增加非学生候选后，扩展 Action kind、Actor/Team resource 和 cost/effect 交叉检查；现有实现有意只复核学生可用候选。
- U8 将 `actionDefinitions`、`studentSkillRules` 与 U3 非学生候选顺序深拷贝/冻结进 RunRules；准备、预览、提交期间不再访问 resolver。
- U9 更新 `operation-runtime.md` 与 GALHCG：Action/Skill 入口、Profile gate 投影、受信内容验证职责和实际 RunRules 所有权稳定后再成为机制事实。

## Receipt 命名说明

文件名追加 `-receipt` 以满足 `check:docs` 对 plan-work basename 唯一的要求；文内 Receipt ID 与 Unit 对应。
