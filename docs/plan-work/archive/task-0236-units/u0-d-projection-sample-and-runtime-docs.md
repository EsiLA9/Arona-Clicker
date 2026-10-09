# Unit 0236-U0-D：OperationView、第一幕样例与机制文档

## Goal
让 Action 内容校验阻止战术专属 ID/type 过滤被 SceneAction / SceneCard 旁路，第一幕 Datapack 明确只作用于旋转木马，并更新当前 Runtime 文档。OperationView 的战术合法目标继续由已过滤的 preview 结果投影；不改变未过滤场景行为。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 任务 | `docs/plan-work/archive/task-0236-gameplay-b-typed-action-cards-and-target-layers.md`、U0-A / U0-B / U0-C Unit 与 Receipt | 统一筛选合同及其 Runtime 使用 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/galhcg-project-map.md` | Unit / Evidence 护栏 |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 更新的目标选择权威说明 |
| 契约 | `src/arona-clicker/contracts/operation.ts:OperationEventDef/OperationLocationDef` | 确认 Run Event 已含展开的 Location SceneAction 与有限 SceneCard 引用，便于静态准入检查 |
| 源码 | `operation-action-content-validation.ts:validateOperationActionContent`、`src/arona-clicker/content/operation-samples/carousel-safety-slice.ts` | 内容级战术目标 / 场景引用边界和首幕 Action 声明 |
| 测试 | `tests/engine/gameplay-b-scene-action-sample.test.ts`、`tests/engine/operation-scene-actions.test.ts` | 正式首幕样例与场景旁路拒绝验收 |

## Context Budget
| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k tokens |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分或上报，不扩大白名单 |

## Optional Read Set
- 前序 U0 Receipt，仅用来确认字段名称与实际校验入口。

## Do Not Read by Default
- `docs/plan-work/archive/**`、其他 Operation 内容包和无关 UI。

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Action 内容校验自行构造 relation 候选以检查效果目标资源引用。 | `src/arona-clicker/services/operation-action-content-validation.ts:legalTargetActors` | 静态可达目标必须应用新范围。 |
| OperationView 的战术目标来自干预预览结果并汇总为 `legalTargetActorIds`。 | `src/arona-clicker/services/operation-view-projector.ts:projectOperationView` | View 不应有第二套宽泛候选规则。 |
| 第一幕三张学生行动当前只把 carousel 放入目标优先级，target relation 仍为 any。 | `src/arona-clicker/content/operation-samples/carousel-safety-slice.ts` | 需将三个规则声明改为精确目标范围。 |
| Runtime `OperationEventDef` 保留 resolved `locations` 与可选 `playerSceneDeck`，两种场景包装器引用均可在 Action 内容校验阶段检查。 | `src/arona-clicker/contracts/operation.ts:OperationEventDef`、`src/data-services/contracts/operation.ts:OperationLocationDef/OperationPlayerSceneDeckDef` | 静态 guard 不需扩展 Registry API 或 SceneBatch planner。 |
| SceneAction / PlayerSceneCard 的 OperationView 与 SceneBatch planner 使用 relation-only 目标判断。 | `operation-view-projector.ts:targetCandidates/projectSceneActions/projectSceneCardCandidates`、`operation-resolution-planner.ts:sceneTargetIsRelated` | 新增过滤合同仅适用于战术 Beat Action；内容准入须禁止同一过滤 Action 经场景包装器执行。 |

## Constraints
- 第一幕只允许目标 Actor ID 为旋转木马；不可只用 `targetPriorityActorIds` 或 Actor 类型碰巧单一来模拟 allowlist。
- Action 内容引用和 OperationView / Runtime 投影必须与 U0-B、U0-C 共用规则语义。
- `allowedActorIds` 每项必须引用本 Event 已声明 Actor；`allowedActorTypes` 每项必须匹配本 Event 中至少一个已声明 `OperationActorDef.type`，避免无目标的拼写错误配置。
- SceneAction / PlayerSceneCard 若引用带 Actor ID / type 过滤的 Operation Action，内容准入拒绝；不要扩展场景候选 / 批次结算实现。

## Allowed Files
- `src/arona-clicker/services/operation-action-content-validation.ts`
- `src/arona-clicker/content/operation-samples/carousel-safety-slice.ts`
- `tests/engine/gameplay-b-scene-action-sample.test.ts`
- `tests/engine/operation-scene-actions.test.ts`
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`
- `docs/plan-work/archive/task-0236-units/u0-d-projection-sample-and-runtime-docs.md`
- `docs/plan-work/archive/task-0236-units/receipts/receipt-u0-d-projection-sample-and-runtime-docs.md`

## Explicit Non-goals
- 不改其他 Operation 内容包，不改 SceneAction / SceneCard 的 UI、费用、效果或结算。
- 不改合同定义、选择器、干预 / 结算或 UI 文件。

## Stop Conditions
按 [[docs/ai/PROJECT-CONSTITUTION#停止条件]] 默认六条执行；如 View 当前事实与前序 Unit 规则不一致，停止并上报。

## Completion Criteria
- [x] 三张首幕 Action 用 ID / 对象范围规则精确允许 carousel，不扩展到任意其他环境 Actor。
- [x] 战术 OperationView 仅通过 U0-C 已过滤的 preview 结果投影合法目标。
- [x] 内容校验拒绝把声明 ID/type 过滤的 Action 引用到 Location SceneAction 或 PlayerSceneCard；旧未过滤场景仍通过。
- [x] 内容校验拒绝不存在于 Event 的 Actor ID / `OperationActorDef.type` 过滤值。
- [x] 定向首幕测试断言 carousel 唯一合法目标，并证明同事件其他 Actor 非法。
- [x] 定向场景测试断言过滤 Action 被场景包装器引用时准入失败，而未过滤的 SceneAction / SceneCard 保持兼容。
- [x] Runtime 当前机制文档准确描述目标范围合同和未声明过滤的旧行为。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/gameplay-b-scene-action-sample.test.ts tests/engine/operation-scene-actions.test.ts` | 通过 |
| 文档 | `npm run check:docs` | 通过 |
| Receipt | 填写本 Unit Receipt | 记录实际改动 / 验证 |
