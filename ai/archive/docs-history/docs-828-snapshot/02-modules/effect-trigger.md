# 02-modules/effect-trigger — Effect 执行 / Trigger 联动 / 响应器

> 一句话：`src/engine/effect/` 是「事件驱动」的基础执行层——Effect 按 op 分发、Trigger 订阅事件跑「侦测→条件→效果」、产品演出类效果经请求事件交给领域宿主。

## 职责边界

- **管**：`Effect[]` 执行分发、`TriggerDef` 挂载/匹配/持久化状态、事件分桶响应器模式。
- **不管**：状态落库细节（委托 mutations）、Affector 持续效果（[[docs/archive/docs-828-snapshot/02-modules/affector]]）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `effect-engine.ts` | `EffectEngine`：状态层落数据经 mutations；**演出/转发类 op**（`setTheme` / `triggerStory` / 聊天流族）只发请求事件（`themeEffectRequested` / `storyEffectRequested` / `chatFlowEffectRequested`），运行期转发表 `runtimeForward` 构造期建表（T5/T7，回调字段已删） |
| `trigger-system.ts` | `TriggerSystem`：以 Runtime Registration 管理 TriggerDef 的事件侦测资格；维护 RegistrationKey、系统分配的单调 token、事件桶、单值 group 与精确 runtime tag 索引，dispatch 逐候选校验 `(key, token)`；兼容 mount/load/unmount；runtime Registration 可携带受限 Reveal action handle，由领域 Adapter 的 typed handler 执行；普通 once 仍按 TriggerId 持久化于 `state.triggersCompleted` |
| `src/arona-clicker/services/information-reveal-adapter.ts` / `milestone-adapter.ts` | 两个窄领域消费者共享 TriggerSystem 的受限 runtime action 路由；Reveal 固化信息可知事实，Milestone 固化 Condition 曾成立事实 |
| `src/arona-clicker/services/milestone-domain.ts` | 按经审计的 Condition capability 派生 Save completed facts 的 desired watches；不维护计数器 |
| `src/arona-clicker/runtime-wiring.ts` / `services/init-service.ts` | 组合 Reveal 与 Milestone action handler，并复用运行时生命周期对账入口 |
| `event-driven-reactor.ts` | `EventDrivenReactor` 基类：分桶订阅模式（多个响应器共用） |
| `src/arona-clicker/services/runtime-effect-reactor.ts` | `RuntimeEffectReactor`：订阅演出请求事件，分派给 ColorSystem / StoryService / ChatFlowService |

## 核心概念

- **Trigger 侦测来源**（`TriggerEventDef.kind`，10 种）：`tick / resource / spotLevel / item / story / init / area / shop / character / cultivated`，均可带过滤 id；全表见 [[docs/archive/docs-828-snapshot/03-data-structures/declarative-dsl]]。
- **EffectOp 25 种**：状态层 14 种落数据（经 mutations），转发类 9 种（`loot` → LootSystem、`triggerStory` / `travelToArea`、`setTheme`、聊天流族 5 种——演出类发请求事件），声明类 2 种（`setSpotMaxLevel` / `removeSpotMaxLevel`，登记在 `DECLARATIVE_EFFECT_OPS`，由 `getSpotMaxLevelOverrides` 动态读取、不进执行流）。
- **扩展纪律**：新增 op = 类型联合 + 注册 1 处（T5）。

### Milestone Listener 与 Achievement

- `MilestoneDef` 保存待观察的 Condition；关联的 `MilestoneListenerDef` 指定 Area，并承载完成后执行的 `then: Effect[]`。Listener 目标只在该 Area 已访问且其 Init 为当前 Init 时进入准入；切换出该 Init 或完成后撤出 Watch。未关联 Listener 的旧 Milestone 保持原有 Watch／完成行为，不执行 `then`。
- Domain 为 Listener 关联目标支持既有精确 resource、spotLevel、story 唤醒源，以及同一 Area Init 下数值 `>=`／`>` 的 `$InitProducedAmount <initId> <resourceId>` 和 `$InitCollectedAmount <initId> <itemId>`；后两者分别由精确 resourceChanged／itemCollected 唤醒，并重验完整 Condition。`alwaysTrue` 可只在准入时检查；其它不能建立可靠 Watch 的条件不准入，首次已访问 Area 对账时记录包含 ID 与不支持叶的 error DevLog。
- 只有 `completeMilestone()` 首次成功提交后，Adapter 才执行 Listener `then`；异常记 error DevLog，不回滚或自动重试。已完成 ID 不因读档、返回 Init 或定义更新重放效果。
- `AchievementDef` 关联 Listener 并提供玩家文案。`buildAchievementView` 只读投影已访问 Area 的目标（当前 Init 用当前访问记录，其它 Init 用存档快照），保留已完成项；单叶的两种 Init 累计 stat 可附带当前／目标进度。未关联 Listener 的旧 Milestone 不进入该 Achievement 投影。

## 测试入口

`tests/engine/effect-engine.test.ts`、`tests/engine/trigger-kind.test.ts`、`tests/engine/anonymous-affector-trigger.test.ts`、`tests/engine/event-driven-reactor.test.ts`

## 相关文档

[[docs/archive/docs-828-snapshot/04-mechanisms/trigger-effect]]（事件目录 + ZoneModifier）· [[docs/archive/docs-828-snapshot/04-mechanisms/state-mutation]]（产品状态效果分发）
