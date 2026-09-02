# 02-modules/effect-trigger — Effect 执行 / Trigger 联动 / 响应器

> 一句话：`src/engine/effect/` 是「事件驱动」的基础执行层——Effect 按 op 分发、Trigger 订阅事件跑「侦测→条件→效果」、产品演出类效果经请求事件交给领域宿主。

## 职责边界

- **管**：`Effect[]` 执行分发、`TriggerDef` 挂载/匹配/持久化状态、事件分桶响应器模式。
- **不管**：状态落库细节（委托 mutations）、Affector 持续效果（[[docs-828/02-modules/affector]]）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `effect-engine.ts` | `EffectEngine`：状态层落数据经 mutations；**演出/转发类 op**（`setTheme` / `triggerStory` / 聊天流族）只发请求事件（`themeEffectRequested` / `storyEffectRequested` / `chatFlowEffectRequested`），运行期转发表 `runtimeForward` 构造期建表（T5/T7，回调字段已删） |
| `trigger-system.ts` | `TriggerSystem`：`TriggerDef` 事件侦测 + 条件判定 + 效果执行；`on.kind` 9 种与 `ON_KIND_TO_EVENT` **双向锁合**（`Record<TriggerEventKind, GameEvent['type']>`，T4）；once/maxRuns 语义；状态持久化 `state.triggerState`；匿名 Trigger 派 `anon:` 确定性 id |
| `event-driven-reactor.ts` | `EventDrivenReactor` 基类：分桶订阅模式（多个响应器共用） |
| `src/arona-clicker/services/runtime-effect-reactor.ts` | `RuntimeEffectReactor`：订阅演出请求事件，分派给 ColorSystem / StoryService / ChatFlowService |

## 核心概念

- **Trigger 侦测来源**（`TriggerEventDef.kind`，9 种）：`tick / resource / spotLevel / item / story / init / area / character / cultivated`，均可带过滤 id；全表见 [[docs-828/03-data-structures/declarative-dsl]]。
- **EffectOp 23 种**：状态层 13 种落数据（经 mutations），转发类 8 种（`loot` → LootSystem、`triggerStory` / `travelToArea`、`setTheme`、聊天流族 4 种——演出类发请求事件），声明类 2 种（`setSpotMaxLevel` / `removeSpotMaxLevel`，登记在 `DECLARATIVE_EFFECT_OPS`，由 `getSpotMaxLevelOverrides` 动态读取、不进执行流）。
- **扩展纪律**：新增 op = 类型联合 + 注册 1 处（T5）。

## 测试入口

`tests/engine/effect-engine.test.ts`、`tests/engine/trigger-kind.test.ts`、`tests/engine/anonymous-affector-trigger.test.ts`、`tests/engine/event-driven-reactor.test.ts`

## 相关文档

[[docs-828/04-algorithms/trigger-effect]]（事件目录 + ZoneModifier）· [[docs-828/04-algorithms/state-mutation]]（产品状态效果分发）
