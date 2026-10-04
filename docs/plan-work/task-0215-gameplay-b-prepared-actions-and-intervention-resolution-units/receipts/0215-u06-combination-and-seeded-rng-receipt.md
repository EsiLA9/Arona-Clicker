# Receipt 0215-U6

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 在 Operation 合同中增加有序 Combination 结果、固定算法版本的纯战术随机状态和 Skill roll 结果；新增独立 `operation-combination-resolver.ts` 与 `operation-tactical-rng.ts`，各有独立定向测试。 |
| Combination 次序 | 只读取 PreparedBeat 所在 Location 的规则，只配对两个不同学生的 `studentAction`。候选依 `(priority 升序, rule ID UTF-16 code-unit 顺序, slot A Actor 声明索引, slot B Actor 声明索引)` 排序；slot A 必须早于 slot B。第一个不冲突候选占用两个学生，每名学生在一 Beat 最多参与一次；后续仍可形成互不重叠的组合。 |
| 目标与隔离 | `same-target` 要求两个非空 Actor target 相等且两项 Action 都是 Actor-target；`no-target` 要求两项 Action 无目标且 plan target 均为 null。Wait、Intent、反向 tag 顺序、不同 target、其他 Location 的规则均不匹配。匹配只返回 rule/pair/action/target 投影，不结算效果或行动费用。 |
| RNG 算法 | 固定 `splitmix64-counter-v1` 与 ASCII `tactical` tag `0x746163746963616c`；用 `BigInt.asUintN(64, seed)` 处理含负 seed 的安全整数输入。`wordAt` 按 Task 固定公式进行模 `2^64` 计算。`sampleOperationTacticalIntegerRange` 在半开整数区间内按 `2^64 % width` 拒绝低端样本；每个拒绝 word 都计入临时 cursor。cursor 必须为非负 safe integer，到达无法再安全递增的位置时拒绝，不回绕。 |
| Skill 抽取 | `rollOperationStudentSkills` 按 Event Actor 声明序读取 Profile 的 `randomSkillRuleId` 和干预后的 PreparedBeat；仅当学生 Action 命中规则 `triggerActionIds` 时抽取 `[0,10000)`。`chanceBps=0` 与 `10000` 仍各消费一个样本；未命中、Wait、非学生 Intent 不抽取。结果只返回 checks 与 provisional `nextRandomState`，不写 Run。U7/U8 必须以最终干预计划运行此检查，并只在有效 Commit 原子成功后存回 cursor。 |
| 运行时交接 | 本 Unit 新增纯 `OperationTacticalRandomState { algorithm, seed, tacticalCursor }` 合同，不接 EventRun owner。当前 Run 的 seed/cursor 初始化、Commit 内 provisional state 接线及成功写回由 U8 完成；准备与 U5 预览不调用战术 RNG。 |
| GALHCG 影响闭环 | 项目 `acprogram` 的 contracts、services、tests/engine 与 plan-work 范围已定向刷新；7 个 U6 路径均由 `resolve_paths` 成功解析。新增 contracts/services/tests 与 receipt 路径均未映射。`src/arona-clicker/contracts/operation.ts` 有两个既有 Concept 映射及其 Evidence；6 个 owners 已完整分页核阅，四条直接 Evidence/edge 因文件 `content_changed` 仍为 stale。`verify_freshness` 同时发现这些 Concept 的其他既有来源也有并行内容变化。U9 需在完整机制语义稳定后统一复核、更新相关 Evidence 并补入 Combination/战术 RNG 语义映射。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-combination-resolver.test.ts` | 通过 | 1 个文件，5 tests passed；覆盖总序、ordered slots、同目标/无目标、Wait/Intent 排除、单次消费、多组 disjoint pairs 与当前 Location。 |
| 定向测试 | `npx vitest run tests/engine/operation-tactical-rng.test.ts` | 通过 | 1 个文件，7 tests passed；含 seed/cursor 固定向量、负 seed、rejection vector、拒绝 word cursor、空范围、算法/输入错误与溢出、触发顺序和 0/10000 bps 消耗。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无 TypeScript 错误。 |
| GALHCG | `refresh`、`resolve_paths`、`review_changes`、`verify_freshness`（项目 `acprogram`） | 部分完成，U9 收尾 | 7 条路径全部解析；operation.ts 的 6 个既有 owners 已完整分页，4 条 direct evidence/edge 与关联 Concept 的多项来源因内容变化显示 stale，需在 U9 统一更新。 |
