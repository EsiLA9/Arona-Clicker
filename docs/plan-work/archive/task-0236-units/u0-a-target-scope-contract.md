# Unit 0236-U0-A：声明式 Action 目标范围

## Goal
扩展 Operation Action target 合同，使内容可严格限定 Event Actor ID / 声明的 `type` 字符串范围；把新增字段纳入结构校验与 Datapack Schema 同步，同时保持旧合同兼容。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 任务 | `docs/plan-work/archive/task-0236-gameplay-b-typed-action-cards-and-target-layers.md` | 产品边界与目标语义 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/galhcg-project-map.md` | Unit / Evidence 护栏 |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/05-conventions/schema-sync.md` | 当前 Runtime 合同与 Schema 生成边界 |
| 源码 | `src/data-services/contracts/operation.ts:OperationActionTargetDef`、`src/arona-clicker/services/operation-tactical-definition-validation.ts:validateOperationActionDef` | 目标定义与静态内容校验 |
| 测试 | `tests/engine/student-operation-runtime.test.ts` | Operation Action 内容准入校验 |

## Context Budget
| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k tokens |
| 文档 Read Set | 4 篇；只列完成本 Unit 必需文档 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分或上报，不扩大白名单 |

## Optional Read Set
- 仅当事实缺失时，检查 Schema 生成入口与其定向测试；运行 `npm run gen:schema` 以验证生成影响。

## Do Not Read by Default
- `docs/plan-work/archive/**`、无关 Engine 模块及 UI 源码。

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前 Actor target 只有 `kind` 与 `relation`，未表达 Actor ID / 类型限制。 | `src/data-services/contracts/operation.ts:OperationActionTargetDef` | 新字段须可选以保留未筛选旧内容语义。 |
| `OperationActorDef.type` 是任意字符串；`OperationActorKind` / View 的 `participantKind` 表示参与者分类，不是 Event Actor 的声明对象类型。 | `src/data-services/contracts/operation.ts:OperationActorDef/OperationActorKind`、`src/arona-clicker/contracts/operation-view.ts:OperationViewActor.participantKind`、`tests/engine/operation-target-selection.test.ts:actor` | 使用 `allowedActorTypes: string[]` 精确匹配 `OperationActorDef.type`；不得把 student/opponent/environment participant 分类冒充对象 type。 |
| Action 定义由 `validateOperationActionDef` 校验，Operation Action 数据模型属于 Data Service 合同层。 | `src/arona-clicker/services/operation-tactical-definition-validation.ts` | 不把过滤限制只加在 UI。 |
| 项目生成的 Schema JSON 禁止手改；源合同变化后应运行生成命令。 | `AGENTS.md`、`docs/docs-829/05-conventions/schema-sync.md` | 仅用官方生成器写输出。 |
| `OperationActionDef.target` 当前在生成协议中是 `kind: hand`；独立 Datapack Editor 的 `TABLE_META` 仍只有 13 张编辑表，不包含 Gameplay B 的 Operation 表。 | `tools/datapack-editor/schema/engine-defs.gen.json:defs.OperationActionDef.target`、`tools/datapack-editor/schema/editor-extras.ts:TABLE_META` | `npm run gen:schema` 会解析 Data Service 类型，但不会为现有 Operation hand 字段生成 UI 子表单；本 Task 不扩展 Operation 表的编辑器表单。 |

## Constraints
- 按 Task 0236 的目标表现契约；旧内容不声明过滤时必须保持既有 `relation` 行为。
- 若源事实、生成入口或 Schema 结果超出上述范围，按停止条件上报。

## Allowed Files
- `src/data-services/contracts/operation.ts`
- `src/arona-clicker/services/operation-tactical-definition-validation.ts`
- `tests/engine/student-operation-runtime.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（仅允许 `npm run gen:schema` 生成；禁止手改）
- `docs/plan-work/archive/task-0236-units/u0-a-target-scope-contract.md`
- `docs/plan-work/archive/task-0236-units/receipts/receipt-u0-a-target-scope-contract.md`

## Explicit Non-goals
- 不修改自动目标选择、干预预览、OperationView、结算规划或 UI。
- 不修改首幕 Datapack 行动。
- 不改变既有 `relation: 'any'` 未声明限制时的含义。
- 不扩展独立 Datapack Editor 的 Gameplay B Operation 表单；运行 Schema 生成与同步测试并如实记录无语义差异，不因既有 `hand` 目标占位扩建编辑器表范围。

## Stop Conditions
按 [[docs/ai/PROJECT-CONSTITUTION#停止条件]] 默认六条执行；Schema 生成若要求修改白名单外源文件，停止并上报。

## Completion Criteria
- [x] 新目标过滤字段可被结构校验明确接受 / 拒绝（空值、重复、非法 type 字符串或非法 Actor ID）。
- [x] 未声明过滤时与既有 target 合同兼容。
- [x] `npm run gen:schema` 与相关 Schema 检查已执行；记录 Operation target 仍是既有 hand 字段的原因，生成结果只由命令写入且不保留仅 generatedAt 的噪声差异。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/student-operation-runtime.test.ts` | 通过 |
| Schema 同步 | `npm run gen:schema` | 命令成功；记录是否产生差异 |
| Receipt | 填写本 Unit Receipt | 记录实际改动 / 验证 |
