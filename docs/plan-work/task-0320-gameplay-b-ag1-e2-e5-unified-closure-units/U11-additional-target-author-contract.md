# Unit 0320-U11：E2 显式额外目标作者合同与 Registry

## Goal

按 U08 冻结合同，为 Map-local Action 增加可选 `additionalTarget: 'partyCharacter' | 'enemy'` 作者字段，并在 Registry/Context 中按每个实际来源上下文验证。此 Unit 只负责静态字段、AG-1 准入和来源限制；不提供任何运行时目标选择。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → datapack-schema context pack、`docs/ai/PROJECT-CONSTITUTION.md` | Registry/Schema 路由与 Patch Unit 纪律 |
| 上游合同 | Task 0320 P2、U08 §显式额外目标、U09b Additional Target Runtime Audit | 作者字段形状、AG-1 准入、主目标与来源边界 |
| 作者类型 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapActionDef` | Map Action 新字段定义 |
| Registry | `src/data-services/registry/registry-validate.ts`：`validateMapActionContent` | Action closed-field allowlist 与基础字段校验 |
| Context | `src/data-services/validation/gameplay-map-effect-context.ts`：`validateGameplayMapEffectContext` | 具体 Encounter/Activity、Party/Enemy、Ability/Item 与 Pool-only 来源绑定 |
| 测试 | `tests/data/gameplay-b-map-registry.test.ts`、`tests/data/gameplay-b-effect-registry.test.ts` | Action 字段与来源上下文定向证据 |
| 项目地图 | `graph_project(acprogram)` 与定向 `additionalTarget` 路径搜索 | 施工前核对项目身份和直接影响；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k tokens；限 Map Action、Registry/Context 与两个测试文件 |
| 文档 Read Set | 5 篇/节 |
| 历史文档 | 0 篇；U08/U09b 是当前额外目标合同与运行态调查 |
| 超预算处理 | 需要新建 UI/runtime draft、Save/Resume、Receipt、Schema 或修改其它路径时停止并上交拆分建议 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| `GameplayMapActionDef` 当前没有 `additionalTarget` | `gameplay-map.ts`：Action 类型 | U08 已冻结可选二值字段形状 |
| Action 使用闭合字段 allowlist | `registry-validate.ts`：`validateMapActionContent` | 字段必须显式加入并校验未知值/类型 |
| Context 能区分具体 Party、Enemy、Ability/Item Actorless 与 Pool-only Action 来源 | `gameplay-map-effect-context.ts`：`validateGameplayMapEffectContext` | 额外目标来源限制应消费这些现有上下文 |
| 当前 Draft/Preview/Commit/Save/Receipt 只保存 primary target，暂无额外领域 ID | U09b Runtime Audit：MapRun target/draft/service 接点 | 本 Unit 不宣称额外目标可运行 |

## Constraints

- 精确字段为可选 `additionalTarget?: 'partyCharacter' | 'enemy'`；不接受其它值或非字符串类型。
- 字段只允许出现在显式 `executionContractId: 'AG-1'` 的 Map；E1 和未声明执行合同必须拒绝含字段的 Action。
- Action 必须已有单位主目标（`self`、`partyCharacter` 或 `enemy`）；`none` 与 `card` 拒绝。`self` 依 U08 属于单位目标，不得额外排除。
- 按每个 Encounter/Activity 的实际来源检查：Party/PlayerCommand/Ability/Item 来源允许；任何 Enemy 自然来源（直接、Pool-only，或同一 Action 同时被 Party 与 Enemy 引用）均拒绝。
- 即使 Action 没有 `effectProgram`，额外目标字段本身也必须进行合同与来源校验。
- Registry Context 只校验作者字段/静态来源；不解析可选目标身份、不保存在 Draft、不改 Preview/Commit/Receipt/Restore。
- Schema 仍在后续独立 Unit 通过生成器同步；本 Unit 不手改或生成 Schema。

## Allowed Files

### 施工实现白名单（Agent）

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/registry/registry-validate.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`

### Task Owner 维护的施工记录

- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U11-additional-target-author-contract.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U11-receipt.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md`
- `docs/plan-work/00-index.md`

实现控制为 5 个实现文件、约 300–500 行净改动；子 Agent 不得编辑本 Unit、Receipt、主 Task 或索引。

## Explicit Non-goals

- 不改生成 Schema；后续单独通过 `npm run gen:schema` 同步。
- 不新增 MapRun Draft 字段或 Ability/Item/Party Action 额外目标选择 API。
- 不改 `MapEffectSourceInput`、Planner、resourceChange 写账户、Effect Receipt、scheduler 或 Save/Resume。
- 不增加目标 UI、选择交互或测试截图；不声称额外目标可提交或可恢复。
- 不改 Task 0316–0319，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若实际 Party/Enemy/Pool 来源无法由当前 Context 精确判别、需修改白名单外路径，或要求运行时额外目标身份才能完成静态校验，停止并提交证据。

## Completion Criteria

- [x] TypeScript 作者合同与 Registry closed-field allowlist 精确允许可选两值字段，拒绝错误类型和值。
- [x] 显式 AG-1 Map 可通过；E1/未声明合同含字段时拒绝；缺省字段的旧 Map 保持通过。
- [x] 仅允许单位主目标；`self`、Party/Enemy 单位主目标正例通过，`none`/`card` 拒绝。
- [x] Party/PlayerCommand/Ability/Item 来源可用；Enemy 直接来源、Pool-only 来源与混合使用拒绝；无 Effect Program 时仍校验。
- [x] Map Registry 与 Effect Context 定向测试、`npx tsc --noEmit`、`npm run check:docs`、`git --no-pager diff --check` 通过并写 Receipt。
- [x] 没有修改 Schema/runtime/UI，没有声称额外目标已能选择、提交或恢复。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Registry | `npx vitest run --silent tests/data/gameplay-b-map-registry.test.ts tests/data/gameplay-b-effect-registry.test.ts` | 字段校验和每个实际来源限制通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
