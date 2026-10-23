# Unit 0320-U13a：E2 Effect RNG 与 Planner 随机 TargetSet

## Goal

实现 U08 已冻结的 `counter-addressed-murmur3-fmix32-v1` Effect RNG 与无偏无放回部分 Fisher–Yates 抽样，并让纯 Effect Planner 可对 `order: 'random'` 的 damage/heal TargetSet 和 `forTargets` 消费、返回同一显式随机状态。随机目标身份顺序及游标前后进入 Trace，供后续 Owner/Receipt Unit 接线。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → production context pack、`docs/ai/PROJECT-CONSTITUTION.md` | Effect 与 Patch Unit 纪律 |
| 上游合同 | Task 0320 P2、U08 §E2R Random TargetSet、U12a/U12b Receipts | 算法、过滤、循环、来源状态语义已冻结 |
| RNG 合同 | `src/arona-clicker/contracts/map/map-effects.ts`：Planner SourceInput/SourcePlan/Trace | 增加独立 Effect Random state 形状 |
| Planner | `src/arona-clicker/services/map/map-effect-planner.ts`：`resolveSet`、`forTargets`、damage/heal | 在过滤后的稳定候选上抽样并共享状态 |
| RNG 测试 | `tests/engine/gameplay-b-effect-rng.test.ts`（新增） | 固定算法向量、边界、拒绝采样与无放回行为 |
| Planner 测试 | `tests/engine/gameplay-b-effect-planner.test.ts` | 验证 Random TargetSet/循环 trace、共享游标与错误原子性 |
| 项目地图 | `graph_project(acprogram)` 与定向 Effect RNG/Planner 路径搜索 | 核实项目身份和直接影响；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k tokens；限纯 RNG、候选抽样、Planner state/trace 与定向测试 |
| 文档 Read Set | 3 篇/节；源码路径见上表 |
| 历史文档 | 0 篇；U08 当前冻结合同为唯一算法权威 |
| 超预算处理 | 需要 MapRun Owner、scheduler、Receipt/Save/Restore、Hand RNG 或 additionalTarget 时停下并另立 Owner Unit |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 随机 TargetSet 必须有 `limit: 1..32`，先按 side/filter 定候选，空集合不消耗游标，候选不足时取实际人数 | U08 §E2R；作者 AST 与 Syntax | 作者结构已同步，当前纯 Planner U12a 明确拒绝随机 |
| RNG 使用固定 counter-addressed fmix32 算法、拒绝采样与部分 Fisher–Yates | U08 §E2R | Effect RNG 与 Hand RNG 完全分离 |
| Planner 每个来源是纯 detached 计划，可由调用方传入 `MapEffectSourceInput` 并读取返回 `MapEffectSourcePlan` | `map-effects.ts`、`map-effect-planner.ts` | 当前无 Owner 输入/输出 state 接线 |
| U12a TargetSet 解析固定候选顺序；forTargets 每次到达解析一次并输出完整身份 trace | U12a Receipt、Planner `resolveSet` / Loop | 随机抽样必须位于过滤之后，trace 顺序即执行顺序 |

## Constraints

- 精确执行 U08 算法：所有运算按 uint32 回绕；`fmix32(k)` 按冻结顺序执行；Effect seed 由初始 Hand seed 经 `(handInitialSeed ^ 0x45464658) >>> 0` 后再 `fmix32` 派生；在 cursor `c` 处以冻结的 low/high 域计算 raw word。解释器不得调用 `Math.random`。
- cursor 是下一个 raw word 索引；每个 raw word（包含拒绝的 word）消费后前进一格。非负 safe integer 校验；到达冻结安全上限时拒绝，不回绕或降精度。
- 无偏抽样用 `limit = floor(2^32 / n) * n` 拒绝 `word >= limit`，返回 `word % n`。抽取按确定候选顺序执行部分 Fisher–Yates：从位置 0 开始，每次在未选区间取一个随机索引并交换到当前位置；返回前 `min(TargetSet.limit, 候选数)` 项的顺序。
- 仅在 `resolveSet` 已过滤、已执行任何确定性排序后抽样；random selector 不允许和 HP ratio sort 复合。需要显式 limit，即使 runtime 收到绕过 Syntax 的手工 AST 也必须拒绝缺失/非法 limit。
- 同一次 Planner 调用中所有 random TargetSet/Loop 共用一个 detached cursor；每次抽样接前一次 next state，不得按语句重置。空候选集不消费游标；候选不足时只抽实际人数。
- SourceInput 接收可选 Effect Random 状态；遇到随机选择而状态缺失时明确失败。成功计划返回 next state；确定性计划保持传入状态不变。任何错误/预算拒绝不得变更调用方输入。
- 随机 TargetSet/forTargets Trace 记录 selector、最终完整身份顺序及状态前后（包含 raw word cursor 前后）；确定性 trace 不伪造随机消耗。State/Trace 均深拷贝或冻结，不暴露可变输入引用。
- 不把 Effect state 放进 Hand RNG 或 MapRun。本 Unit 仅固定算法和 Planner 消费结构，Owner 负责 Encounter 派生/持有/提交与 scheduler v3。

## Allowed Files

### 施工实现白名单（Agent）

- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/services/map/gameplay-b-effect-rng.ts`（新增）
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `tests/engine/gameplay-b-effect-rng.test.ts`（新增）
- `tests/engine/gameplay-b-effect-planner.test.ts`

### Task Owner 维护的施工记录

- 本 Unit、对应 Receipt、Task 0320 与 `docs/plan-work/00-index.md`

施工实现最多 5 个文件，目标净改动约 300–500 行；子 Agent 不得编辑 Unit/Receipt/Task/index。

## Explicit Non-goals

- 不改 `map-run.ts`、`map-run-service.ts`、scheduler v2/v3、Hand RNG、Owner/Commit、Receipt Validator、Save/Resume/Restore 或测试 Map `resumeVersion`。
- 不安装/推进任何 MapRun RNG；不宣称 random AST 已能提交或恢复。
- 不实现 additionalTarget 运行时身份、additionalActor 账户、资源写账户或 E3 候选抽取。
- 不改 Schema/Registry/Context/UI/作者示例，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若算法文档与当前 U08 文本有冲突、无法在纯 Planner 保持输入不变、候选稳定顺序无法确定，或必须修改 Owner/Receipt 文件，停止并上交证据和拆分建议。

## Completion Criteria

- [x] RNG 算法有固定向量测试；uint32、高 cursor、拒绝采样、cursor 耗尽均正确。
- [x] 部分 Fisher–Yates 无放回、保留抽取顺序；空集合零消耗、候选不足正确。
- [x] Planner 能执行随机 damage/heal Set 与 forTargets；多次抽样共享更新 cursor；Trace 包含 identity 顺序和前后 state；无 state/失败时明确拒绝且输入不变。
- [x] 已有 Planner 测试、RNG/Planner 新测试、`npx tsc --noEmit`、`npm run check:docs` 与 `git --no-pager diff --check` 通过并记录 Receipt。
- [x] 不声称 MapRun Owner、跨来源 RNG、scheduler v3、Receipt/Save/Restore 已接入。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| RNG + Planner | `npx vitest run --silent tests/engine/gameplay-b-effect-rng.test.ts tests/engine/gameplay-b-effect-planner.test.ts` | 算法固定向量与 Planner 随机抽样/trace 通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
