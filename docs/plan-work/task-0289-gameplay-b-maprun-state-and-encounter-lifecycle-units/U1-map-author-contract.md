# Unit 0289-U1：Map 固定队伍与初始 PlayerCost 内容合同

## Goal

为 Map 加入固定 `partyCharacterIds` 与必填 `initialPlayerCost`；Registry 验证内容完整，正式 Gameplay B Map 样例填入这两个值。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 用途 |
|---|---|---|
| 设计 | `docs/plan-work/draft-0287-gameplay-b-phase-b-contract.md` Map / 生命周期合同 | 确认固定队伍与初始费用要求 |
| 规范 | `docs/docs-829/05-conventions/schema-sync.md` | 确认作者字段与生成 Schema 的边界 |
| 契约 | `src/data-services/contracts/gameplay-map.ts` `GameplayMapDef` | Map 作者数据字段 |
| 验证 | `src/data-services/registry/registry-validate.ts` `validateDatapack()` | Map 引用和费用校验 |
| 内容 / 测试 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`；`tests/data/gameplay-b-map-registry.test.ts`；`tests/engine/gameplay-b-map-run.test.ts` | 正常样例、Registry 验证与已有 typed fixture |

## Context Budget

| 项 | 预算 / 规则 |
|---|---|
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2–4 篇，只读直接命中项 |
| 历史文档 | 默认 0 篇 |
| 超预算处理 | 超出本 Unit 文件或字段边界时停止并交回总控 |

## Optional Read Set

- `docs/docs-829/03-data-structures/datapack-contracts.md`：仅在 `GameplayMapDef` 的正常作者入口仍不清楚时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`、旧 Operation 作者实现与独立 Datapack Editor UI。

## Confirmed Facts

| 事实 | 依据 | 备注 |
|---|---|---|
| 当前 Map 契约没有固定队伍与初始 PlayerCost。 | `src/data-services/contracts/gameplay-map.ts` `GameplayMapDef` | U1 新增作者字段。 |
| Registry 可取得已加载 Character ID，也会检查当前包内容。 | `src/data-services/registry/registry-validate.ts` `DatapackValidationContext` / `validateDatapack()` | 同包与已加载包引用均可验证。 |
| 当前 Map 样例通过 TypeScript Datapack 进入正式 Registry；未发现 Map 对独立编辑器生成 Schema 的引用。 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`；`scripts/` 与 `tools/datapack-editor/schema/` 搜索 | 生成 Schema 不在本 Unit 白名单。 |

## Constraints

- 字段语义遵守 [[draft-0287-gameplay-b-phase-b-contract]]。
- 不改生成 Schema；若正式作者入口实际要求改动禁改生成产物，停止并交回总控。

## Allowed Files

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/registry/registry-validate.ts`
- `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tests/engine/gameplay-b-map-run.test.ts`（只补既有 typed Map fixture，不改运行时状态断言）

## Explicit Non-goals

- 不做 PlayerState 准入、MapRun 快照、存档恢复或 UI 修改。
- 不添加 HP、Actor / Team resource、Encounter Action、Hand、Prepared Action、Target、RNG 或失败终态。
- 不改生成 Schema，不触碰旧 Operation 内容。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若角色 ID 类型或已加载包关系与 Confirmed Facts 不符，或需要改 Allowed Files 外的 Registry / loader / Schema 文件，停止并报告。

## Completion Criteria

- [x] `partyCharacterIds` 是非空、非空白、唯一的 Character ID 列表，且每个角色引用已登记 Character。
- [x] `initialPlayerCost` 是非负安全整数。
- [x] 正常 Map 样例声明固定队伍与初始 PlayerCost。
- [x] Registry 测试覆盖缺字段、重复 / 未知角色、同包 / 已加载包引用与无效费用。
- [x] 既有 MapRun typed fixture 补齐新内容字段，不改运行行为。

## Verification

| 项 | 命令 / 方式 | 实际结果 |
|---|---|---|
| Registry 定向测试 | `npx vitest run tests/data/gameplay-b-map-registry.test.ts` | 35/35 通过 |
| 类型检查 | `npx tsc --noEmit` | 通过 |
| 独立复核 | 非施工 Luna Max Agent 只读审查 | 未发现阻塞；记录一项未覆盖“Map 包先于角色包加载”的非阻塞观察，见 Receipt |
