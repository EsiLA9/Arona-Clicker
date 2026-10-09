# Unit 0241-U2：Operation 池注册与内容校验

## Goal

接入新增 Registry 表，并在 Registry 内容校验中验证池、Strategy、Action/Actor/Event/Location 引用和有限 selector。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 | 内容合同与解析边界 |
| 文档 | `docs/docs-829/05-conventions/architecture-discipline.md` | Registry 责任边界 |
| 源码 | `src/data-services/registry/registry.ts` | 表 merge/clear/getter |
| 源码 | `src/data-services/registry/registry-validate.ts` | ID / unique validation |
| 源码 | `src/data-services/registry/operation-content-validation.ts` | Operation 引用校验 |
| 测试 | `tests/engine/registry.test.ts` | Registry 行为入口 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k tokens |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超 60k tokens 时停止并交还 Task Owner |

## Optional Read Set

- `src/data-services/registry/registry.ts`（Operation 表的通用 merge/clear 行为）。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `src/ui/**`、`tools/datapack-editor/**` 的 UI 实现

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Registry 单独维护 Operation 四张表及对应 merge/clear/getter | `registry.ts` Operation 私有 Map 与 TableStep | 新表按同一数据服务模式接入 |
| Operation authored content 校验集中于 `operation-content-validation.ts` | `registry-validate.ts` `validateOperationContent` 调用链 | 校验不应泄漏到 UI |
| 所有 Datapack Registry 定义的三段式 typeName 统一由 `src/engine/core/entity-id.ts` 的 `ENTITY_TYPES` 登记；当前 Operation 有四种对应项 | `src/engine/core/entity-id.ts:ENTITY_TYPES`、`registry-validate.ts:checkEntityIds` | 新 Strategy Profile / CardPool 必须追加各自稳定 typeName；本 Unit 只允许扩词汇，不改 parser/validator 行为 |

## Constraints

- 只修改列出的 Registry/校验与回归测试文件。
- 不添加随机或权重机制到 Data Services；仅做结构和引用校验。
- E0 selector 可见面外的通用 Condition 不在本 Unit。

## Allowed Files

- `src/data-services/registry/registry.ts`
- `src/data-services/registry/registry-validate.ts`
- `src/data-services/registry/operation-content-validation.ts`
- `src/engine/core/entity-id.ts`（仅新增 `operation-strategy-profile` / `operation-card-pool` 两项 `ENTITY_TYPES`）
- `tests/engine/registry.test.ts`

## Explicit Non-goals

- Operation Run resolver / hand runtime。
- Editor 表格或 UX。
- Gameplay B 内容示例。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；需跨出白名单时先上报。

## Completion Criteria

- [ ] Pool/Strategy 可注册、清空、读取，身份检查完整。
- [ ] 两种新三段式实体类型通过 ID 校验；未知类型仍按既有规则拒绝。
- [ ] 缺失/重复 ID、引用、非法 BPS/weight/hand size、未知 Context fact 能被拒绝。
- [ ] 有针对关键正反例的 Registry 行为断言。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/registry.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Receipt

见 `receipts/receipt-0241-u2-operation-registry-validation.md`。
