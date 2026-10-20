# Unit 0301-U2a：共用敌我双方 Hand 策略

## Goal

扩展 `drawGameplayBHands()`，让 Character 与 Enemy 使用相同 Hand 容量、合法性、显式倾向修正、确定性加权抽取和自然 Team cost 预留算法，返回各 Enemy 的只读 Hand 草案。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`：P0 / P2 | 双边策略规则与准备顺序 |
| 文档 | `docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md`：P0 / P2 / P3 | 已冻结的倾向、合法目标、费用和随机稳定规则 |
| 源码 | `src/arona-clicker/services/gameplay-b-hand-resolver.ts`：drawGameplayBHands / resolveCandidates | 唯一现有策略实现 |
| 源码 | `src/data-services/contracts/gameplay-map.ts`：GameplayEncounterEnemyDef / ActionCandidate | P1 新输入合同 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`：Hand draw / preference / resource reservation | 回归与新增双边策略用例 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 先拆分策略与状态接线，不扩大白名单 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前 resolver 的 `HAND_LIMIT` 是 3；Party 顺序不放回抽取，并对自然 `Hand[0]` 虚拟预留 MapRun Team cost。 | `gameplay-b-hand-resolver.ts` | Enemy 复用该值和抽取函数。 |
| 情境权重当前只读取 Character HP / Enemy roster，且在 `resolveCandidates()` 中把 role-target 解释为 Character 语义。 | 同文件 `resolveCandidates()` | 需显式传入候选 actor side 与双方 HP / 资源表。 |
| P1 Enemy pool 已由 Registry 校验 Action 引用和 owner-side tendencyRole。 | Task 0301 U1b Receipt | Resolver 仍需校验运行输入结构和当前目标资格。 |

## Constraints

- Draw order 固定为 `Map.partyCharacterIds`，随后 `Encounter.enemies` roster 顺序。
- 每个存活 Enemy 都获得独立的最多 3 张 Hand；已倒下 Enemy 与空候选 Enemy 保留空 Hand 行，不消耗随机游标。
- Target kind 继续使用 `partyCharacter` / `enemy` collection；Character target `enemy` 与 Enemy target `partyCharacter` 表示对手单位。
- recovery 的 25% HP loss、defense 的 50% HP、attack 的合法对手存在仍按 Task 0299 的 1x / 2x 显式规则计算；从当前 actor side 读取 HP。
- Enemy Actor 与 Enemy Team 资源输入独立于 MapRun Character / Team 资源；Enemy 自然 Action Team cost 按敌方 roster 顺序作虚拟预留。
- RandomState 使用同一已版本化算法；Preview / UI 不调用抽卡。
- Action eligibility：Character 继续校验 `eligibleCharacterIds`；Enemy 由已验证的自己的候选池授权。

## Allowed Files

- `src/arona-clicker/services/gameplay-b-hand-resolver.ts`
- `tests/engine/gameplay-b-map-run.test.ts`
- `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`
- 本 Unit 与其 Receipt

## Explicit Non-goals

- 不修改 MapRun / Save snapshot 类型或调用方；由 U2b / U2c 处理。
- 不修改 Commit / Enemy fixed damage；由 U3 / P5 迁移。
- 不创建第二 Hand resolver、AI service 或 UI-only action data。

## Stop Conditions

- 必须更改冻结的 draw order、Hand limit、weight modifier、target legality、Team reserve 或 RNG 算法。
- 现有 Action 契约不能区分 Enemy Actor / Team resource 值而必须改源类型。
- 需要修改 Allowed Files 外文件。
- 直接 Hand tests、类型检查或随机重演测试失败且无法归因。

## Completion Criteria

- [x] 同一 resolver 生成 Character 和 Enemy Hand，按 Character → Enemy roster 消耗同一确定性 RNG stream。
- [x] Enemy recovery / defense / attack 情境权重在自己的 HP 与合法队友 / 对手上生效；不能把 Enemy Team cost 预留给玩家 Team。
- [x] Enemy actor / team affordability、零目标过滤、空 Hand、下倒单位和替代候选均有定向测试。
- [x] 相同输入与 seed/cursor 得到相同双方 Hands / randomState；现有 Party 手牌算法回归通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Hand / Engine | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 通过 |
| 差异 | `git diff --check` | 无空白错误 |

## 实施结果

- `drawGameplayBHands()` 使用现有 weighted-without-replacement 流程依次抽取固定 Party 和 Enemy roster 的 Hand；每名倒下或没有合法可负担自然行动的 Enemy 保留空 Hand 行，不推进 RNG。
- Enemy candidate legality 使用现有 `enemy` / `partyCharacter` 目标集合，Action 倾向按 Enemy 的 HP、友方 Enemy HP 与存活我方角色判断；情境乘数沿用现有 1x / 2x。
- Enemy Actor / Team 资源与我方余额分别建表；仅 Enemy 自己的虚拟 Team 预算限制 Enemy 自然行动。
- Resolver 的新增 Enemy 输入是可选的，因此现有 MapRun 调用仍保持原 Character Hand 结果。Encounter 快照持久化和真实调用接线留给 U2b / U2c。
