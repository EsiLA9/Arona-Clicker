# Task 0217 — 玩法 B 事件目标与多类结局

状态：in-progress — EventRun 目标/结局与局内 Action 效果已实现并通过定向验证；持有物 Gate、SceneAction/Card 调用与 AC 奖励提交由后续 0218、0224/0225、0222 接入。

## 目标

使战斗和现场行动都能推进事件定义的目标，依据少量局内轨道与事实产生成功、部分成功或失败，而不把击倒全部对手作为统一胜利条件。

## Why

行动循环需要一个超越清空敌方生命值的理由。明确目标与部分结果可以让救援、调查、设施处置和战斗围绕相同的事件状态形成因果。

## Scope

- 为事件定义可读的主/次目标、失败门槛和位置局部终止规则。
- v1 Predicate 只支持数值轨道比较、事实存在/缺失和有限的 all/any 组合。
- 为行动提供少量有限效果：Actor 状态/资源变化、数值轨道变化、事实发现/移除，以及 `{ kind: 'heldItem', itemId, op: 'grant' | 'remove' }`。持有物效果只增删 `EventRun.heldItemIds` 中已声明的 ID，不建设背包、装备或通用物品系统。
- 学生行动、SceneAction 与玩家卡都通过同一个 `OperationActionDef` 执行这些效果；不得为路线卡或场景行为另建一套物品结算器。
- 明确同一 Beat 的效果先从统一快照计算，按稳定规则合并和限幅，再原子写回 EventRun。
- 定义 Location 局部完成/部分完成/失败与 Event 终局结果的区别；地点部分成果结算后可继续走路线。
- 硬失败门槛可在任何 Beat 立即结束 Event；其余 EventOutcome 只在事件终止边界评估，避免尚有路线时因当前部分条件过早结局。
- Event 终止边界优先级：硬失败 → 全部主目标满足时成功 → 明确部分成功条件 → 失败；硬失败与主目标同 Beat 成立以失败为准。
- 让非战斗地点能以环境 Intent 和现场状态产生 Resolution；战斗地点继续共用相同 Commit 管线。
- 每个 Location 必须有明确目标/失败条件或有限 Beat 上限，避免局内循环无界增长。

## Non-goals

- 不引入可执行脚本、任意表达式 DSL 或将现有 ConditionTarget 扩展为通用 EventRun 查询器。
- 不强制每个事件有相同计量项；数值轨道与事实由事件定义选择。
- 不实现路线图和存档，分别由 Task 0218 与 Task 0219 负责。

## Gameplay UI Deferred Scope

- 本 Task 建立 Objective/Outcome 的 Runtime、命令和只读投影，不改 Gameplay B 页面、栏位或聊天流交互。
- 可为 Task 0222 提供结果/进度 View 数据与服务 API；不在本 Task 把目标/日志渲染成多条学生或行动列表。
- 最终呈现遵循 Draft 0212 的我方角色卡 / 中央信息流 / 敌方三栏，并只在 Task 0222 统一设计与验收。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| ConditionSystem 对当前 ConditionTarget 求值且不修改状态。 | `docs/docs-829/03-data-structures/engine-contracts.md`；`docs/docs-829/06-wiki/40-engine/core-contracts.md` | EventRun 临时指标需小型独立 Predicate，避免假定现有 Condition 能读它。 |
| StateMutationService 负责 PlayerState 写入与领域事件，Engine Effect 通过宿主端口消费状态变化。 | `docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md`；`docs/docs-829/04-mechanisms/engine/effect-trigger.md` | 局内结果由 OperationRuntime 原子更新；长期结果在明确边界转交 AC mutation。 |

## Data / API

- LocationObjective/LocationResult 与 EventObjective/EventOutcome 规则：局部 ID、轨道/事实条件、主次标签、部分条件、结果说明和允许提交到 AC 的奖励白名单；嵌入 Event/Location，不建立独立 Registry 表。
- `EventPredicate`：有限比较与 all/any；无任意函数、表达式求值或跨 PlayerState 副作用。
- `OperationActionEffectDef`：Actor/资源/轨道/事实/已声明持有物的封闭变更集合，进入 `Resolution` 后批量应用。`heldItem` 的 `grant` 将 ID 加入 Run 集合，`remove` 将其移除；重复 grant 或移除未持有项不产生重复实例。
- 事实与持有物效果由同一 `OperationActionDef` 声明；SceneAction 和玩家卡后续只包装/引用该定义，不复制效果。
- 一个 Beat 从统一冻结快照计算变化，数值贡献合并限幅；事实/持有物按学生 Action、Combination、技能效果的固定次序应用，同一成员的最后一次声明生效；所有变化一次原子写回 EventRun。

## Runtime Flow

Beat Resolution 依据统一快照计算 Actor 与事件效果 → 聚合并限幅 → 一次写回 EventRun → 若硬失败成立则立即产生 Event 终局 → 否则重评当前 Location Objective/Result → Location 终止后如仍有路线继续 Event；无合法路线/达到终止条件时才按优先序评估 EventOutcome → 输出局部结果或事件终局 OperationView。战斗 Action、SceneAction 和 PlayerSceneCard 引用同一 ActionDef 时，使用同一 heldItem 效果语义。

## Acceptance

- [ ] 同一条规则可由战斗 Action 和非战斗/环境 Action 改变 EventState；Runtime 只读投影提供统一的目标进度、结果和日志数据结构，UI 展示延至 Task 0222。
- [ ] 已声明的 `heldItem` Action 效果可由学生行动、SceneAction 与玩家卡调用；`grant/remove` 只更新 EventRun 持有物集合，路线 Gate 可检查该结果，出口可消费它；不新增背包或通用物品系统。
- [ ] Location 部分完成只结算当前问题并更新 EventState；只要仍有合法路线就继续 Event，不触发 Event-level Partial Outcome。
- [ ] 硬失败门槛任意 Beat 成立时立即终止；否则仅在 Event 终止边界按“主目标全满足的成功 → 明确部分条件 → 失败”裁定；硬失败与主目标同 Beat 成立时结果为失败。
- [ ] 部分成功必须满足事件明示条件且有可列举成果；不将所有未归类终局兜底为部分成功。
- [ ] 玩家可通过不同决定稳定达到三种结果，随机不单独决定终局类型。
- [ ] 一次 Beat 同时发生的伤害、治疗和轨道变化依定义的结算顺序合并；异常/越界时不出现半个 EventRun 更新。
- [ ] 只读 View 不改变 EventRun，也不会触发行动结算或消费随机数。
- [ ] 未声明的 track/fact、非法 target 或不支持的 Predicate/Effect 被 Registry/Runtime 校验拒绝并指明来源。
- [ ] 全队失能不是全局硬编码结局；事件规则可将其配置为失败，也可以让救援/撤离/环境行动继续有效。

## Tests

- **Unit：**Predicate、heldItem grant/remove、效果限幅、终局 Outcome 优先级/同 Beat 冲突、奖励白名单。
- **Runtime：**硬失败即时终止；地点局部部分结果在有合法路线时继续；仅在事件终止时判成功/部分/失败；全局与地点局部结算边界。
- **Integration：**Action 效果只改变 EventRun；局内轨道、事实与持有物仍不出现在 PlayerState。SceneAction/Card 包装复用 ActionDef 的接入分别由 0224/0225 验收；长期奖励只在 0222 的产品入口经 StateMutationService 提交一次。
- **Projection/API：**OperationView 目标进度、状态变化与结果摘要同步；不做浏览器 gameplay UI 或信息流交互。

## Dependencies

- 依赖 Task 0213（EventState）、Task 0214–0215（Actor/Action/Resolution）和 Task 0216（可观察切片）。
- Task 0218 使用本 Task 的轨道/事实与 Predicate 门槛。

## Documentation / GALHCG

- 本 Task Receipt 收集实现稳定后的机制页候选、Concept 与证据路径；不在单 Task 收尾时刷新或写 GALHCG。
- Task 0218 收尾已将 0217–0218 的 Objective/Outcome、Location/Route 稳定语义合并更新到 Runtime/OperationView 机制文档与 `concept:operation-event-run-runtime` 的 GALHCG Evidence/maps_to；只维护稳定 Concept，不为 helper 或单条配置建节点。SceneAction/Card 包装与 AC 奖励提交仍由后续 Task 验收。
- Read Set：`docs/docs-829/03-data-structures/engine-contracts.md`、`docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md`、`docs/docs-829/04-mechanisms/engine/effect-trigger.md`、`docs/docs-829/05-conventions/architecture-discipline.md`。

## 当前核验与剩余工作

已实现闭合 Predicate、Location/Event 结局、OperationView 目标进度，以及事实/持有物 Action 效果的纯规划与原子提交；定向 TypeScript 与 Runtime 测试通过。跨 SceneAction/Card 包装和长期奖励提交保留给对应后续 Task，浏览器交互不属于本 Task。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]
- [[docs/docs-829/05-conventions/testing]]
