# Unit 0157-U11：双区域演示数据包 JSON

## Goal

交付可与基础包一同加载的独立演示世界线 JSON：1 个 Init、2 个起初相邻可达的 Area、资源累计与物品收集成就各 1 个，玩家可在游戏内完成。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/world.md`、`docs/docs-828/02-modules/registry.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 内容与施工边界 |
| 计划 | Task 0157、本 Unit、U06/U07 Receipts | 玩法语义与进度口径 |
| 范例 | `datapack/addition_test/datapack.json`、`datapack/addition_test/00-world.json`、`datapack/addition_test/01-content.json` | manifest、Init/Area/Spot/Item 结构 |
| 源码 | `src/data-services/contracts/datapack.ts:MilestoneDef/MilestoneListenerDef/AchievementDef`、`src/data-services/contracts/world.ts:EntryEffectDef`、`src/arona-clicker/services/init-service.ts:travelToArea` | 声明与首访效果时序 |
| 测试 | `tests/engine/milestone-runtime.test.ts`、`tests/data/fragment-parser.test.ts` | 加载和运行时测试入口 |

## Context Budget

目标约 15k–25k tokens；额外阅读超过 2 个文件或 70k tokens 时停止上报。

## Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| JSON 分片合并 Milestone、Listener、Achievement 列表 | U01 Receipt、`fragment-parser.ts` |
| Area 旅行先写到访，再执行 Area 进入效果，最后 Milestone 准入对账 | `init-service.ts:travelToArea` |
| 演示内容可使用基础包信用点资源，但应声明依赖 base | `addition_test/datapack.json`、`addition_test/00-world.json` |
| 物品累计 DSL 是 `$InitCollectedAmount <initId> <itemId>`，比较符可用 `>=`，数值阈值；资源累计同形为 `$InitProducedAmount <initId> <resourceId>` | `src/engine/expression/stat-dsl.ts`、`src/arona-clicker/services/milestone-domain.ts:statSourceOf` |
| Area 的 `enterEffects` 可用 `{ effects: [{ op: 'addItem', target: itemId, value: 1 }] }`；每次进入执行未标记 `first` 的条目，效果经过 StateMutationService 发物品 | `src/arona-clicker/services/init-service.ts:applyEntryEffects/travelToArea`、`src/arona-clicker/state/effect-ops.ts:addItem` |
| 真正的 ZIP 导入要求 manifest 与合并后 Datapack 的 `name`、`version` 一致 | `src/data-services/datapack/pack-parser.ts:parsePack` |

## Constraints

- 文件夹 `datapack/area-achievement-demo/`；manifest 使用独立 `modName`，依赖 `base`，正文只引用基础包资源，不引用其它扩展包。
- 初始 Area 提供可持续产出基础信用点的默认设施；资源成就使用 `$InitProducedAmount`，阈值在短时间内可达，完成后发一次起步信用点。
- 第二 Area 起初双向相邻且可见，首次进入前其 Achievement 与 Watch 均不准入；本 Area 用可玩的重复进入效果提供示范收集品，物品成就用 `$InitCollectedAmount`，阈值需玩家实际收集后才达成。
- 两目标互不依赖；作者文案说明玩法线索和奖励，不暴露内部结构。效果仅使用当前真实可执行 op。
- 测试从真实 JSON 读取、合并、连同基础包注册，验证两个目标定义、可达性、进入前后准入与实际玩法完成；不为了测试直接写 PlayerState。

## Allowed Files

- `datapack/area-achievement-demo/datapack.json`
- `datapack/area-achievement-demo/00-world.json`
- `datapack/area-achievement-demo/01-achievements.json`
- tests/data/area-achievement-demo.test.ts（本 Unit 新建）
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u11-receipt.md`

## Explicit Non-goals

- 不创建 ZIP、修改引擎/编辑器/基础内容、加入故事或第三 Area。
- 不修改先前机制测试以迁就示范数据。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若所需可玩收集路径无法只用现有 Area 进入效果实现，停止给出证据。

## Completion Criteria

- [ ] 示例 JSON 与 manifest 可解析、注册，玩家能从初始 Area 走到第二 Area。
- [ ] 资源与物品两个目标均可通过正常玩法达到且奖励各只执行一次；第二 Area 在首访前不显示或监听。
- [ ] 定向测试与 Receipt 记录真实结果。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/data/area-achievement-demo.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
