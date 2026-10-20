# Unit 0299-U8：自主多目标战斗的真实 Runtime 验收

## Goal

在当前 Map-only Gameplay B Datapack 加入可游玩的白子 / 芹香对机器人 A、B、C 样例，并通过 Registry、Runtime、MapRun Commit 与 Save / Resume 实际运行两轮自主战斗。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | Unit 白名单与验证边界 |
| 文档 | docs/docs-829/05-conventions/testing.md | Runtime 集成行为验收 |
| 文档 | docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P5 | 用户指定的最终运行样例 |
| 文档 | docs/plan-work/archive/task-0299-units/receipts/receipt-0299-U1.md 至 receipt-0299-U7.md | 复用已完成合同与回归边界 |
| 源码 | src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts：GameplayMapDef、gameplayBMapDatapack | 当前 Map-only 正式 Datapack 与入口 |
| 源码 | src/arona-clicker/runtime-game-instance.ts：startMap、moveMap、commitMapEncounterRound、save、load | 正常 Runtime 写入与存档路径 |
| 测试 | tests/engine/gameplay-b-map-save-resume.test.ts：createGame、真实 Datapack 装配与恢复 | 本单元集成测试入口 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 3 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 仅扩大到 Runtime Registry 装配或 Workspace 正常入口 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前 Map-only Gameplay B Datapack 已由应用 Runtime 加载，并提供 Map entry；另有与旧 Operation 混合的 carousel fixture。 | gameplay-b-map-datapack.ts；gameplay-b-datapack.ts；runtime.ts | 最终样例只使用前者，不装载或调用 Operation。 |
| `GameplayMapDef` Action、HP / Team resources、Encounter、Enemy、固定 party 与 Entry 可通过真实 Registry / MapRun Runtime 执行。 | gameplay-b-map-datapack.ts；MapRun Save / Resume tests | 本单元新增正式 Datapack Map，而非旁路 Resolver stub。 |
| 手动敌人目标、Swap、Commit 与 Save / Resume 均有 Runtime Owner API 和现有验证入口。 | runtime-game-instance.ts；tests/engine/gameplay-b-map-save-resume.test.ts | P5 要验证同一 Run 的准备稳定和提交结果。 |

## Constraints

- 样例使用当前 Map-only `gameplayBMapDatapack`，固定队伍顺序 Shiroko、Serika，遭遇机器人 A / B / C；不读取、启动或依赖旧 Operation。
- 第一轮不设置目标、不 Swap、不下 Ability / Item / PlayerCommand；Preview 有明确合法自然 Action / Enemy target 后直接 Commit。Shiroko 击败 A 后，Serika 在实际执行时按本 Action 策略对剩余敌人重选。
- 第二轮来自真实 Commit 后的最新 Enemy HP、队员 HP、Resources 和 RNG cursor；通过实际 Runtime 复核 Hand / target，Swap 到掩护后重新解析自身目标，再恢复自然 Action 并手动选择另一合法 Enemy。
- 反复 Preview、Swap / 清除与 Save / Resume 均不重抽 Hand、不推进 RNG、不额外扣费；保存恢复保持相同 Hand、目标、费用余额与提交准备状态。
- 本单元可把正式可玩的 sample Map 加入 Map-only Datapack 与 Map entry；不改生成 Schema、Operation、长期 Strategy Owner 或 Workspace/UI 接线。
- P5 UI / Skip 投影留给 U9；U9 是否可施工仍取决于 Task 0291 U4 Workspace / Runtime View 接口状态。

## Allowed Files

- src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts
- tests/engine/gameplay-b-map-save-resume.test.ts
- 本 Unit 与其 Receipt；必要时更新 Task-0299 的 Patch Unit 状态。

## Explicit Non-goals

- 不更改 Target selector、权重、Commit fee、Receipt 或 MapRun 状态实现；这些由 U1–U7 覆盖。
- 不以测试替身代替 Registry / Map-only Datapack / GameInstance Runtime。
- 不扩大为全游戏量平衡、完整攻略、全量视觉重设计或全量测试。

## Stop Conditions

- 当前 Registry 不能表达该 P0 样例的三敌、角色、Action preference / role 或 HP / resource contract：停止并标明缺失合同，不绕过 Registry。
- 需要改动 Unit 白名单外的 Engine / Runtime / UI 文件，或添加不在 P0 的策略行为：先停止并拆出相应 Unit。
- 任何 Round 1 自然方案不能直接 Commit、自动目标不合法、死敌被后手继续攻击、Round 2 读档变化 Hand / target / costs：停止相应场景并修复后再验收。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] 正式 Gameplay B Map-only Datapack 可在 Registry / Runtime 中启动；样例为 Shiroko、Serika 对 Robot A / B / C。
- [x] 第一轮零干预可 Commit；Shiroko 击败 A，Serika 按当前合法候选重选 B 或其他存活目标，不浪费在 A；Action effects / costs / Receipt 正确。
- [x] 第二轮只在第一轮 Commit 后基于新 HP、存活敌人、Resources 与 RNG cursor 准备；敌人和队伍状态可从 Runtime 读取。
- [x] 第二轮 Swap 到掩护时行动 / target 按新 Action 重算；恢复自然射击后按当前规则恢复默认目标；手动合法改选后重复 Preview 保持不变。
- [x] Save / Resume 后 Hand、manual / automatic target、Resource cost readiness、RNG 和最后 Receipt 保持一致；正常 Commit 后下一轮才重决策。
- [x] 受影响 Runtime / Save / Resume 测试、类型检查与差异检查通过；没有依赖 Operation / relation line / UI infer target。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Runtime / Registry / Save / Resume | npx vitest run --silent tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-resolver.test.ts tests/data/gameplay-b-map-registry.test.ts | 通过：3 files、140 tests；包含完整两轮实战 sample。 |
| 类型检查 | npx tsc --noEmit | 通过 |
| Datapack / Runtime | GameInstance.init([defaultDatapack, gameplayBMapDatapack])，startMap、moveMap、两轮 Commit 与 Save / Resume | 通过；Map-only registry 实际装载，没有加入或启动旧 Operation。 |
| 文档 / 差异 | npm run check:docs；git diff --check | 通过；errors 0、scanned 949；差异检查仅有既有 CRLF 提示。 |
