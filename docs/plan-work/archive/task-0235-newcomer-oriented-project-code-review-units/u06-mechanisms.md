# Unit 0235-U06：包加载、生产与领域生命周期机制

## Goal

将装载、生产、世界线、角色成长和 Gameplay B 运行机制写成可以沿源码/测试继续阅读的流程说明。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `04-mechanisms/data-services/pack-loading.md`、`engine/production.md`、`arona-clicker/world-lifecycle.md`、`gacha-cultivation.md`、`operation-runtime.md` | 当前机制流程和术语 |
| 源码 | PackManager/Runtime coordinator、Tick/GameNum、InitService、GachaService、OperationRuntimeService | 对应机制 owner 与运行步骤 |
| 测试 | `tests/data/pack-manager.test.ts`、`tests/engine/trigger-system.test.ts`、`gacha-service.test.ts`、`operation-runtime-service.test.ts` | 关键结算与拒绝条件证据 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 20k–45k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 五个主题逐页核对；不要展开关联故事/内容数值全文 |

## Optional Read Set

- 各服务直接调用的 effect/query helper，仅在需要核实一个关键跳转时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`、完整 Datapack JSON、无关玩法文案与素材。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 04-mechanisms 有 8 个当前机制页面及分层索引。 | `rg --files docs/docs-829/04-mechanisms` | 每条机制行为需要由当前源码校验。 |

## Constraints

- 以入口、状态 owner、步骤、事件和失败/门禁条件解释，不用一页抽象名词替代流程。
- 只有被实现并测试的能力才写为当前行为；样例内容不代表通用规则。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u06-mechanisms.md`（填写本 Unit Receipt）
- `docs/docs-829/04-mechanisms/data-services/pack-loading.md`
- `docs/docs-829/04-mechanisms/engine/production.md`
- `docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`
- `docs/docs-829/04-mechanisms/arona-clicker/gacha-cultivation.md`
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`

## Explicit Non-goals

- 不改包合同、生产公式、世界线生命周期、招募概率或 Operation 行为。
- 不在机制页重述完整 Datapack 定义字段或内容样例。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；页面声明与相关代码或测试冲突时暂停该机制，不以历史计划定当前行为。

## Completion Criteria

- [ ] 每个机制都有触发入口、owner、主要步骤、订阅/调用关系和后续链接。
- [ ] 被引用的测试能证明该流程或边界；无法覆盖的 finding 留在 Review Receipt。
- [ ] 五页用词和 04 总索引统一且相互可达。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 源码/测试对照 | 按五项机制逐页走读入口与拒绝条件 | 不将规划写成实现事实 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt

- **结果：** 完成包启用与 Registry 应用、Tick 生产、Init/Area 生命周期、招募与培养四条机制页的首轮源码和测试对照；补上面向初读者的步骤概览及上下游阅读链接。
- **源码/测试证据：** PackManager 应用入口 `src/data-services/datapack/pack-manager.ts:applyEnabled()`；Tick 入口 `src/engine/system/tick-system.ts:tick()` 与 `src/engine/runtime/session-service.ts`；世界线入口 `src/arona-clicker/services/init-service.ts`；招募入口 `src/arona-clicker/services/gacha-service.ts:roll()`。检查了 `tests/data/pack-source.test.ts`、`pack-parser.test.ts`、`pack-manager.test.ts`、`tests/engine/arona-runtime-pack.test.ts`、`tick-system.test.ts`、`session-service.test.ts`、`init-global-lifecycle.test.ts`、`gacha-service.test.ts`、`cultivate-system.test.ts`；未运行测试。
- **Wiki 修改：** 更新 `pack-loading.md`、`production.md`、`world-lifecycle.md`、`gacha-cultivation.md`；解释包解析/应用四步、Tick 与界面重画的区别、Init/Area 初学定义和角色获取/培养入口。
- **Review Finding：** 在本 Unit 已核对的四个主题中，未确认除 U05 已记录 EventBus P2 外的 P0–P3 代码缺陷。`TickSystem.tick()` 直接递增 `totalFrames` 是已观察到的状态写入边界；项目规则和架构约定尚未裁定是否构成违规，因此不列为缺陷。
- **Gameplay B Operation 复核：** 只读核对了并行 Task 0236 当前 Runtime 目标规则变更与 `operation-runtime.md` 同步说明。`allowedActorIds` / `allowedActorTypes` 与 relation 求交集；自动计划和手动目标预览共用选择器；内容校验保证 Actor ID / type 属于当前 Event，并拒绝把战术专属过滤 Action 包进只按 relation 解析的 SceneAction / PlayerSceneCard。依据：`src/data-services/contracts/operation.ts`、`operation-target-selection.ts`、`operation-action-content-validation.ts`；检查 `tests/engine/operation-target-selection.test.ts`、`operation-plan-preparation.test.ts`、`operation-runtime-service.test.ts` 中的候选过滤、非法 Actor 和生命周期验证。未运行测试。
- **并行边界：** `operation-runtime.md` 及 Operation UI / 测试路径由 Task 0236 并行修改；本 Unit 只审 Runtime 机制和类型化目标，不覆盖该 Task 尚待 Edge 完成的视觉验收。
- **验证：** 手工核对所列入口、测试位置和 Wiki 导航；未运行 Vitest。最终 `npm run check:docs` 通过（681 Markdown，0 errors），`git --no-pager diff --check` 通过。
