# Receipt 0241-U10：Strategy Park 平行玩法实例内容

## 状态

**Completed — U10 数据施工与 Runtime 内容验收通过。** 最初在 Admission 阶段发现的 E1 字段 allowlist 缺口由 Task Owner 在独立 U13 完成；恢复后，本 Unit 没有更改 Engine，标准 Registry / resolver / Admission / OperationEntry 路径启动并走通完整路线。

## 白名单内修改

- `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids.ts`：新样例独立命名空间 `gameplay-b-strategy-park` 的 Event、12 个 Location、角色 Profile、Strategy、Pool、Action、Fact、Item、Track 和 Route ID。
- `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`：新平行 Datapack 实例，声明 12 个可进入节点、三个战斗阶段、服务亭分支、电玩馆 Negotiation、急救/休整/探索场景、摩天轮通行证路线 Gate、地下设备井终局；有同枪同后排的 Hoshino/Serika 双 Profile，不同 StrategyBias，及 back→front 行动和对应 Pool。
- `tests/engine/gameplay-b-strategy-park-sample.test.ts`：经标准 `createAppRuntime`、Registry Datapack 装配与 `operationEntry.start()` 走真实准入/运行时的样例测试。恢复后按最终成功路线手动提交场景选择、战斗行动和路线，完整执行至成功结局；测试覆盖 12 个地点、三战、Negotiation、Strategy Hand、位置重新解析与路线 Gate。

内容验收期间发现并修正样例 Event 漏声明 Actor Teams 的数据错误。其后 U13 修复 Runtime Admission 对 E1 Context / Action Condition 字段的拒绝；恢复后的 D1 测试通过标准 Admission，无 bypass 或 Engine 改动。

## BDemo 对标与实际覆盖

| 原型主要内容 | Strategy Park 对应设计 | 状态 / 限制 |
| --- | --- | --- |
| 01 西门整备、02 林荫连廊线索、03 服务亭活动 | 01 开场、02 轮迹、03 广播登记和分支选择 | **以状态/活动近似复制**；Runtime 测试走过三处并验证 SceneAction 与两条可用路线 |
| 04 代币电玩馆、维修线索 | 04 与维修员 Negotiation 并请求维修通行证 | **用新 Negotiation 场景替代**原型搜索活动；统一 Operation Action/Pool/Strategy，实测 Hand Pool 命中、bias 差异、SceneAction 提交和凭证发放 |
| 05 碰碰车战 | 05 第一战 | **近似复制战斗节点**；Operation Beat 真实结算 3 Beat；不复制原型敌方意图循环/行动配方 |
| 06 急救补给、千世入队 | 06 固定 roster 全队治疗 | **活动以状态恢复替代；动态 Actor 加入未复制**。Roster 在 Run 启动时固定，本样例没有尝试扩展 |
| 07 镜面迷宫活动 | 07 搜索迷宫路线 | **近似复制活动**；SceneAction 写入 Event Fact 并真实提交 |
| 08 摩天轮检修廊与入口 | 08 检查面板；通行证解锁烟花广场路线，也可选后台旁路 | **复制路线选择后果**；测试持有凭证时选择有 Gate 的路线 |
| 09 烟花排练场战 | 09 第二战 | **近似复制战斗节点**；Operation Beat 真实结算 3 Beat；不复制原型烟花手意图候选规则 |
| 10 后台休息、玲奈入队与整备 | 10 全队休息 | **活动以状态恢复替代；动态 Actor 加入、营地对未来战斗的修正未复制** |
| 11 中央舞台设备井 Boss 战 | 11 第三战 | **近似复制终局战斗节点**；Operation Beat 真实结算 4 Beat，不复制完整 Boss AI |
| 12 东出口交接与结束 | 12 交接 SceneAction、Primary Objective 与 success | **复制终局流程结构**；真实完成 objective 并由 EventRun 进入 success |
| 原型可选 node-13 地下控制室支路 | 在 08 以通行证 Gate 与后台旁路表达二选一 | **未复制独立控制室节点**；使用既有 Route Gate 表达相似的入口后果 |
| 原型三种行动配方、同轮伤害/治疗抵消 | 未纳入本样例 | 原型 README 将队形、Click 边界、配方与同轮治疗规则列为确认依据；本样例不声称等价复刻 Combination/同时结算 |
| 原型活动检定、敌方意图、烟花手/Boss 行为、营地数值 | 未纳入本样例 | 原型 README 标记为候选规则，未作为本 Task 裁定的 Engine 需求 |
| 原型 4 人初始队形及后续扩充至 6 人 | 三名固定成员，其中 Hoshino/Serika 同 weapon/position 对照，Shiroko 初始 front | **角色数量及具体队形未复制**；固定 roster 限制和策略对照优先，本样例提供后排→前排运行时状态变化 |
| 角色随机技能、临时 ActionPool | 未纳入本样例 | 本轮使用静态 Event/Location/Profile Pools；Runtime 临时 Pool 注入不受 E1 支持 |

该表将原型“确认机制”“候选规则”与本样例“相似覆盖”分开。测试实际走过 12 个 Location（初始节点 + 11 次路线转移）、3 场战斗、交涉、活动分支和终局，可支持作者按 Operation View/脚本观察 Hand、Position、Pool、路线与 Resolution；它不声称复刻原型的敌方 AI、随机技能、精确队伍增员或行动配方。

## 启动失败诊断与 U13 处理

以下数量记录的是 U13 validator 修复之前、U11 揭示并补充 `handoff` Pool 之前的 Registry 装配：

| Registry table | 数量 / 查询 |
| --- | ---: |
| `operationEvents` | 1 |
| `operationLocations` | 12 |
| `operationActions` | 20，且 `has(IDS.actions.quickShot) === true` |
| `studentOperationProfiles` | 3 |
| `operationStrategyProfiles` | 3 |
| `operationCardPools` | 6 |

`game.operationEntry.start(IDS.event, roster)` 抛出 `OperationAdmissionError`。Teams 声明修正后，诊断共 142 条：

- 36 条 Location 字段拒绝：对全部 `eventDefinition.locations[0..11]`，validator 各拒绝 `interactionSceneId`、`activityId`、`cardPoolIds`（12 × 3）。示例 `locations[0]` 对应 Location `gameplay-b-strategy-park:operation-location:01-west-gate`，传入值为 `park:exploration`、`park:briefing` 与 `[gameplay-b-strategy-park:operation-card-pool:exploration-options]`。
- 17 条 Action 字段拒绝：对 resolver 合并出的 `actionDefinitions[3..19]`，validator 拒绝 E1 `OperationActionDef.cardCondition`。内容值用于限定 combat、exploration、recovery 和 social/negotiation Context。
- 51 条 Profile 级联引用错误：3 个 Profile × 17 个学生 Action，因为 Action validator 将带被拒 `cardCondition` 的定义过滤掉，随后报告 `candidateActionIds references a missing Action`。
- 38 条 Location 级联引用错误：因同一批 Action 被过滤，Location 的 `enabledActionIds` / `sceneActions[].actionId` 报告 `references a missing Action`。

根因不是 pack/Registry 缺表：Registry 计数证明所有表均可查询；失败发生在 Registry resolver 解析 Location 后、Admission 再校验 resolved Event/Action 时。

## 源码对照与 Engine 缺口

- E1 声明合同 `src/data-services/contracts/operation.ts` 包含 `OperationLocationDef.interactionSceneId`、`activityId`、`cardPoolIds`，以及 `OperationActionDef.cardCondition`。
- `src/arona-clicker/services/registry-operation-content-resolver.ts` 正确从 Registry 按 Event Location IDs 解析这些 Location，并收集池和 Action。
- 之后 `src/arona-clicker/services/operation-participant-admission.ts` 调用 `validateOperationEventDef()` 与 `validateOperationActionContent()`。
- `src/arona-clicker/services/operation-definition-validation.ts` 的 `validateLocations()` closed-field allowlist 没有 E1 三个 Location 字段；`src/arona-clicker/services/operation-tactical-definition-validation.ts` 的 `validateOperationActionDef()` closed-field allowlist 没有 E1 `cardCondition`。该拒绝在 `OperationEntry.start()` Admission 路径可复现。
- 对照旧 Carousel：`gameplay-b-datapack.ts` 和当前 `gameplay-b-scene-action-sample.test.ts` 的 Event Location / Action 未携带 Context selector 与 `cardCondition`，因此它们没有覆盖这条新增字段的 Admission 路径。旧样例 Registry 数量或启动成功不构成新字段闭环证据。

该问题属于 E1 Datapack 合同到 Runtime Admission 验证缺口。Task Owner 将两处字段纳入 closed-field validation 并补 Engine 回归后，本测试在不改数据合同、不绕过 Admission 的条件下通过。历史 142 条错误仅作 U13 修复前的诊断，不再是当前结果。

## 抽象玩法独立审阅

- **Context 决定候选范围：** Event/Location/Profile 静态引用的 Pool 通过 combat、exploration、recovery、social 与 activity/position selector 匹配；测试分别观察 combat 与 negotiation Pool 命中，位置变更后 frontline/backline Pool 变化。
- **Pool 提供候选、Action 定义行为：** 每个 Pool Entry 指向同一个 `OperationActionDef`；战斗中通过 Character Hand/Intervention/Beat Commit 消费行动，非战斗场景通过 Location SceneAction wrapper 选择该 Action 的既有目标和效果合同。没有第二套 combat/social AI。
- **Strategy 只调权：** 同位置/武器/context 的 Hoshino 与 Serika 共用战斗池；固定 seed 下 Hand 行动实际不同，cover 与 quickShot 的 finalWeight 朝各自 bias 方向改变。Negotiation 的 `deescalate` 同样复用 StrategyProfile，Hoshino 的 Strategy factor 高于 Serika；未增加行动、绕过目标、地点或费用检查。
- **状态变化自然触发重新解析：** Hoshino 以 Hand 中的 `stepForward` 提交从 back 到 front；Commit 后 Hand 重新解析，frontline Pool 和 `frontGuard` 生效，backline Pool 消失，无 deck switch 或动态 roster 操作。
- **显式 Pool 闭环覆盖终局：** 东门交接 Location 保持 `social/handoff` Context，引用 selector 同时匹配这两项的 `handoff` Pool；Runtime 测试确认三名学生都命中该池，handoff 候选来自该池且 `legacyFallback=false`。
- **人工验收可解释性：** `OperationView.characterHand` 提供 action IDs、命中 Pool、合法状态、过滤原因、基础及策略权重。U11 负责把这些字段展开为路线 Transcript 与人手可编辑的决策脚本；本 Unit 不将 Vitest 测试声称为交互式 CLI。

U11 第一轮转录发现 `social/handoff` Location 曾错误引用 `exploration` Pool，导致终局使用 E0 的 legacy fallback。D1 白名单内已新增精确匹配的 handoff Pool，并扩充集成断言；当前终局不再使用 legacy candidate。

## 验证与结论

- 命令：`npx vitest run tests/engine/gameplay-b-strategy-park-sample.test.ts --silent`
- 结果：**通过（1 test）**。U13 完成后同一标准 pack 路径 `OperationEntry.start()` 成功，并执行下面列出的整条 Runtime 路线。初次失败的 142 条诊断仅保留在上文作为修复依据。
- Runtime 行为证据：Registry 正确载入 1 Event、12 Locations、20 Actions、3 Student Profiles、3 StrategyProfiles、7 CardPools；EventRun 转移覆盖所有 12 个节点并以 success 结束，Primary Objective 达成。Hoshino/Serika 在相同 back+sg+combat Context 下产生不同 Hand，权重差异符合 bias；选择 `stepForward` 后 Hoshino 转为 front 并获得 `frontGuard`；Negotiation 同一 Pool/Action/Strategy 生效并取得 maintenance pass；三场战斗分别完成 3、3、4 个 Beat，路线凭证 Gate 和后台分支可见；`social/handoff` 终局由专属显式 Pool 提供候选，不走 legacy fallback。
- 命令：`npx tsc --noEmit`；结果：通过。
- 命令：`git --no-pager diff --check`；结果：通过，无 whitespace error；Git 输出工作树中其他文件的 CRLF→LF 警告。
- 未执行浏览器、Editor 或 GALHCG 更新；这些不属于 U10。数据阶段地图等待 U11 完成、内容人工验收后分批维护。
