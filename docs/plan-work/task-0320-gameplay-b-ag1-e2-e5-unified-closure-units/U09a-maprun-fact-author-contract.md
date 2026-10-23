# Unit 0320-U09a：MapRun Fact 作者定义与 Registry

## Goal

为 P2 的 MapRun-local Counter/Flag 建立闭合的 Map 作者定义与 Registry 校验，并同步生成 Datapack Editor Schema；本 Unit 不创建运行时状态或 Effect Program 读写。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task / 合同 | Task 0320 P2、U08 E2 Contract Freeze | 已冻结字段语义、上限、生命周期与边界 |
| 规范 | `docs/docs-829/05-conventions/schema-sync.md`、`docs/docs-829/05-conventions/testing.md` | 生成 Schema 与选择定向测试 |
| 契约 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapDef`、Encounter locals | Map 定义字段与相似计数定义 |
| Registry | `src/data-services/registry/registry-validate.ts`：Map/Encounter 声明校验 | 接入新 Map-local 声明校验 |
| 测试 | `tests/data/gameplay-b-map-registry.test.ts`、`tools/datapack-editor/schema/engine-schema.sync.test.ts` | 正式 Map Registry 行为与生成协议验证 |
| 生成器 | `scripts/gen-engine-schema.mjs` | Schema 通过生成器更新，禁止手改结果 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k tokens；限于 Map 作者定义和 Registry |
| 文档 Read Set | 4 篇/节 |
| 历史文档 | 0 篇 |
| 超预算处理 | 如需修改 MapRun runtime 或 Effect AST，停止并拆交 U09b/U10 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Map 定义的 `resumeVersion` 是活动 MapRun 兼容边界 | `gameplay-map.ts`、`datapack-contracts.md` | 新定义改变运行规则时由作者提高版本 |
| Encounter locals 的 Counter/Flag 有 safe integer、初值与 Counter 界限校验 | `gameplay-map.ts`、`gameplay-map-effects.ts`、`registry-validate.ts` | MapRun Fact 使用独立 Map 级声明，不复用 Encounter locals 生命周期 |
| Datapack Editor Schema 由 `npm run gen:schema` 从源契约生成 | `schema-sync.md`、`scripts/gen-engine-schema.mjs` | 不手改 `engine-defs.gen.json` |

## Constraints

- 严格实现 U08 冻结的 `GameplayMapDef.mapRunFacts` Counter/Flag 声明形状：Counter `id/initial/min/max`，Flag `id/initial`。
- Counter 与 Flag 在 MapRun Fact 命名域中互斥重名；Encounter-local 可以使用相同文本 ID，因为生命周期/命名域不同。
- 总声明数量不超过64；Counter 全部为 safe integer 且 `min ≤ initial ≤ max`；Flag 初值严格 boolean。引用/重复/未知字段按 Registry 现有闭合规范拒绝。
- 未声明 MapRun Facts 的旧 Map 不增加运行时状态。该字段不启用 Edge 门控、Effect 读写或任何长期 AC/Story 状态。
- 依 `schema-sync` 用生成器更新生成 Schema，不手工编辑生成文件。

## Allowed Files

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（仅 `npm run gen:schema` 生成）

## Explicit Non-goals

- 不增加 MapRun runtime state、Save/Resume、ReadModel 或 Effect Program 操作；归 U09b/U10。
- 不增加 MapRun Fact Edge 条件；归 P5/E5。
- 不修改作者示例、Docs 正式合同、Datapack Editor UI、旧存档或 `resumeVersion` 内容样例。
- 不编辑 GALHCG 图、刷新索引或写 freshness；Task 0320 收尾统一只读核对。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。新增任何 Allowed Files 外路径前停止，由负责人更新本 Unit。

## Completion Criteria

- [x] `GameplayMapDef.mapRunFacts` 有准确 TSDoc 与闭合类型。
- [x] Registry 覆盖合法声明、重复 ID、跨 Counter/Flag 重名、范围/初值非法、字段错误与总量上限。
- [x] 生成 Schema 包含 MapRun Facts 作者字段并通过同步测试。
- [x] 定向 Registry/Schema 测试、类型检查、差异检查通过并记录。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Map Registry | `npx vitest run tests/data/gameplay-b-map-registry.test.ts` | 新定义接受且非法形状拒绝 |
| 生成 Schema 同步 | `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts` | Generated schema 匹配源类型 |
| 类型检查 | `npx tsc --noEmit` | 退出码0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
