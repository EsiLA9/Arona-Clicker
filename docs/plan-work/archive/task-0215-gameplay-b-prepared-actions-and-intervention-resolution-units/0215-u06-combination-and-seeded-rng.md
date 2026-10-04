# Unit 0215-U6：二输入协同与确定性战术 RNG

## Goal

建立有限、确定的 Location Combination 匹配器和可由 seed/cursor 重建的战术随机流。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md` | Combination 次序和 RNG 成本口径 |
| 源码/测试 | `src/arona-clicker/contracts/operation.ts`、src/arona-clicker/contracts/operation-action.ts、src/arona-clicker/contracts/operation-beat.ts | 输入计划、规则、Skill 结果类型 |
| 源码/测试 | tests/engine/operation-plan-preparation.test.ts | Event Actor 声明顺序的现有约定 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token；算法说明可长于默认代码行预算 |
| 文档 Read Set | 1 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | Combination 与 RNG 独立文件、独立测试，不扩展至一般配方系统 |

## Optional Read Set

- `src/arona-clicker/services/operation-runtime-service.ts`：只在确认 EventRun 随机字段名时读取。

## Do Not Read by Default

- Gacha、全局 `Math.random` 包装、遗留 Gameplay B 原型、UI、Registry 与 Save。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| EventRun 只有随机 seed/cursor 槽，没有 Operation 消费器。 | `src/arona-clicker/contracts/operation.ts:EventRun.random` | 本 Unit 新增产品局部可重建流。 |
| Task 0215 的组合限于当前地点与两个学生行动。 | 所属 Task “Combination”裁定 | 组合输入不能重复消费。 |

## Constraints

- RNG 使用 counter-addressed SplitMix64 v1、BigInt、算法 ID `splitmix64-counter-v1` 与固定 `operation:tactical:v1` stream tag；`wordAt` 由 seed/tag/cursor O(1) 得到。
- 算法常量固定：`MASK=2^64-1`、`GAMMA=0x9E3779B97F4A7C15`；`mix64(z)` 依次执行 `z ^= z >> 30; z *= 0xBF58476D1CE4E5B9; z ^= z >> 27; z *= 0x94D049BB133111EB; z ^= z >> 31`，每步乘法后与 MASK 按位 AND。逻辑 tactical tag 固定映射为 `0x746163746963616c`（ASCII `tactical`）；`wordAt = mix64((mix64(uint64(seed) XOR tag) + GAMMA * (cursor + 1)) AND MASK)`。
- 整数区间用 64-bit rejection sampling，无偏取值；cursor 记录已消费 raw word 数，包含拒绝样本。cursor 的临时推进只有 U8 原子 Commit 成功后写回。
- Skill roll 固定无偏取 `[0,10000)`，再与 integer `chanceBps` 比较；只有干预应用后的最终学生 Action ID 命中 Rule trigger 时才检查，检查顺序在 Combination 消费前；每个满足条件的 Actor/Rule 每次有效 Commit 检查一次，`0` 与 `10000` 也各消耗一次 sample；不满足 trigger 条件时不抽取。不得依赖 `runId`、时间、遍历偶然顺序或 `Math.random`。
- Combination 只读取当前 Location 内嵌规则与 PreparedBeat；tag slots 有序，slot A/B 分别匹配 pair 中先/后声明的 Actor。候选按 `(priority 升序, rule ID code-unit ordinal, slot A Actor index, slot B Actor index)` 总序处理；每名学生最多被消费一次。
- 配对规则只要求输入标签槽及 `same-target` / `no-target`；命中时原始两个 Action 效果不重复结算，费用与独立 Student Skill 保留。

## Allowed Files

- src/arona-clicker/contracts/operation-action.ts
- `src/arona-clicker/contracts/operation.ts`
- src/arona-clicker/services/operation-combination-resolver.ts（新增）
- src/arona-clicker/services/operation-tactical-rng.ts（新增）
- tests/engine/operation-combination-resolver.test.ts（新增）
- tests/engine/operation-tactical-rng.test.ts（新增）
- docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/0215-u06-combination-and-seeded-rng-receipt.md

## Explicit Non-goals

- 不写 EventRun、不提交游标、不把抽牌 RNG 接入战术流。
- 不增加多输入搜索、任意条件、随机 Intent 或回合外抽取。
- 不完成 Actor/Team/Track 效果聚合；纯 Resolution batch 由 U7 负责。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件默认六条执行；算法变更若影响已有向量/未来存档恢复，先升级版本决策并上报。

## Completion Criteria

- [ ] 固定算法测试向量覆盖 seed、stream tag 与 cursor；同 seed/cursor 可重建同一 64-bit word。
- [ ] rejection path 也准确推进 raw-word cursor；空区间/越界/溢出不产生部分推进。
- [ ] Combination 的规则优先、pair 顺序、输入消费一次与不匹配行为有单测。
- [ ] 准备/预览路径没有调用战术 RNG；流接口只返回临时结果和新 cursor。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-combination-resolver.test.ts tests/engine/operation-tactical-rng.test.ts` | 算法向量、rejection、排序与单次配对通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 人工验收 | 不同 stream tag/cursor 的样本独立复算 | 不读取运行时随机全局 |
