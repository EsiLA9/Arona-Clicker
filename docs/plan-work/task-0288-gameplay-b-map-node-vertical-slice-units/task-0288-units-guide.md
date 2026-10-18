# Task 0288 Patch Units

父 Task：[[task-0288-gameplay-b-map-node-vertical-slice]]。  
施工合同：[[draft-0287-gameplay-b-phase-b-contract]]。  
本目录在父 Task 完成并归档时一并归档。

## 执行顺序

### 验证前置

| Unit | 目标 | 依赖 |
|---|---|---|
| [[U0-typecheck-fixture-baseline]] | 修复既有 UI 测试 fixture，恢复严格类型检查 | 独立；可与 U2 并行 |

### C1 / C1a 实施

| Unit | 目标 | 前置 |
|---|---|---|
| [[U1-map-data-contract]] | 定义 Map / Node / Edge / Encounter 的最小静态数据合同与 ID | 无 |
| [[U2-map-registry-and-entry-reference]] | Registry 登记、校验拓扑并检查 Spot → Map 引用 | U1 |
| [[U3-map-resolver-and-sample]] | 为正式 Registry 内容提供 Resolver，并登记真实最小 Datapack 样例 | U2 |
| [[U4-map-run-runtime]] | 建立唯一 MapRun 状态机与移动 / 遭遇规则 | U3 |
| [[U5-map-run-gameinstance-commands]] | 接入 GameInstance、ReadModel 与 GameCommands | U4 |
| [[U6-map-run-save-resume]] | 保存/恢复 MapRun 并拒绝失效内容版本 | U5 |
| [[U7-map-workspace]] | 渲染 Map / Encounter 并展示移动与结果 | U5 |
| [[U8-normal-entry-and-e2e-acceptance]] | 从普通 Spot 进入样例，完成整条游戏链路验收 | U1–U7 |

### 独立复核后追加的 C1 合同收口

| Unit | 目标 | 依赖与关系 |
|---|---|---|
| [[U9-c1-contract-regression-closure]] | 修正 U5 生命周期测试与 U6 Load/Resume 冻结合同冲突，并由 Registry 拒绝无效 Map `resumeVersion` | 基于 U1–U6 独立复核；可与 U8 并行，但 C1 最终验收前必须完成 |

每个 Unit 的 Receipt 存于同目录 `receipts/receipt-<unit-id>.md`；前缀用于满足本仓库计划文档文件名唯一性检查。Agent 开工前须按 `docs/ai/templates/patch-unit.md` 复述 Goal、Allowed Files、Non-goals 与 Stop Conditions。单位之间不得共改同一文件；依赖未完成时不得开始后续写入。
