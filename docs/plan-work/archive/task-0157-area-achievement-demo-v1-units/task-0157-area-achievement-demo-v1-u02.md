# Unit 0157-U02：Registry 识别并校验三层声明

## Goal

让 Registry 保存 Listener／Achievement 定义，并在加载期拒绝无效 ID、断裂引用、重复一对一关系及不可执行的 `then` op。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/registry.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 架构与 Unit 纪律 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit、U01 Receipt | 已定合同与边界 |
| 源码 | `src/data-services/contracts/datapack.ts`、`src/engine/core/entity-id.ts`、`src/data-services/registry/registry.ts`、`src/data-services/registry/registry-validate.ts` | 类型、ID、表步骤、加载期验证 |
| 效果 | `src/engine/types/expression.ts` 的 `EffectOp`、`src/arona-clicker/state/effect-ops.ts`、`src/arona-clicker/services/runtime-effect-reactor.ts`、`src/arona-clicker/services/story-flow.ts` 的 `travelToArea` | 判定 Listener 上下文真正可执行的 op |
| 测试 | `tests/engine/registry.test.ts` | 查询、清理、拒绝条件 |

## Context Budget

目标约 15k–25k tokens；不遍历无关 Registry 关系函数，超出 2 个额外文件或 60k tokens 时停止上报。

## Optional Read Set

- `src/data-services/datapack/pack-manager.ts`，仅在跨包引用策略需要核对时读取。

## Do Not Read by Default

- Runtime Editor、UI、历史计划、Milestone Runtime 和其他机制测试。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| U01 已将两个可选列表加入 Datapack 与分片 | `src/data-services/contracts/datapack.ts`、U01 Receipt | 本 Unit 不改合同 |
| Registry 的 Milestone 表经 `tableSteps` merge/clear 并公开只读 Map | `src/data-services/registry/registry.ts:234-236,714` | 新表按同一路径 |
| `validateDatapack` 先于 Registry 合并 | `src/data-services/registry/registry.ts:1237-1251` | 引用需检查当前包及已装载定义 |
| `loot` 与声明类 op 不由 EffectEngine 执行；`travelToArea` 由 StoryFlow 专门处理 | `src/arona-clicker/state/effect-ops.ts`、`src/engine/types/expression.ts:143-148`、`src/arona-clicker/services/story-flow.ts` | Listener 的 then 不接受这些 op |

## Constraints

- 新 ID typeName 使用 `milestone-listener` 与 `achievement`，并在 `ENTITY_TYPES` 登记。
- Achievement 只能引用存在的 Listener；Listener 只能引用存在的 Milestone 与 Area。允许引用当前包或此前已加载包的定义；不允许两个 Listener 分享同一 Milestone，或两个 Achievement 分享同一 Listener。
- 对 `then` 使用明确的可执行 op 白名单。未知 op、`loot`、`travelToArea` 与声明类 op 在加载期以含定义 ID 的错误拒绝；不要只靠 TypeScript 类型断言处理 JSON。
- 不要求所有独立 Milestone 都有 Listener；旧 Milestone 行为保持。
- 遵守 [[docs/docs-828/05-conventions/architecture-discipline]]；data-services 不依赖 AronaClicker。效果模块仅作只读证据。

## Allowed Files

- `src/engine/core/entity-id.ts`
- `src/data-services/registry/registry.ts`
- `src/data-services/registry/registry-validate.ts`
- `tests/engine/registry.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u02-receipt.md`

## Explicit Non-goals

- 不修改声明字段、parser、Milestone Runtime、效果执行器、UI、Schema 生成文件或示范包。
- 不验证本 Task 尚未支持的组合进度、附加 `when`、Init／全局归属或前置关系。
- 不顺手修改现有其他 Entity ID 的校验行为。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若为了使当前包／已装载包引用正确必须引入白名单外修改，先停止报告。

## Completion Criteria

- [ ] Registry merge、clear、只读查询均覆盖 Listener 与 Achievement。
- [ ] 无效 ID、缺失引用、重复一对一关联、不可执行 `then` op 均给出含定义 ID 的可定位错误。
- [ ] 旧 Milestone 单独加载仍通过；测试覆盖当前包与已装载包引用。
- [ ] Receipt 记录实际改动、验证与剩余问题。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/registry.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 架构 | `npm run check:architecture` | 通过 |
| 文档 | `npm run check:docs` | 通过 |
