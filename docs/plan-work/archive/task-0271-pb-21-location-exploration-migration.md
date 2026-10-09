# Task 0271 / PB-21：Strategy Park 十处非战斗 Location 迁入 Scene

状态：completed — Strategy Park 十个非战斗 Location 按一地点一 Scene 等价运行；隐式 `main` 保留原 SceneAction、费用、固定行动、Effect 和 Route 语义，没有为显式字段形式改写内容。
> Goal Owner 统一裁定（2026-10-08）：PB-21 按一个非战斗 Location 对应一个 Scene 等价迁移；不改 fixed 行动、费用、Effect 顺序或 Route。若已有测试证明等价，可直接关闭。未声明 `Location.scenes` 时使用隐式 `main`。

## 目标

将 Strategy Park 原有 10 个非战斗地点的探索、交涉、治疗、交接、固定记录与路线结果迁入同一 Scene 机制。玩家从 Operation 工作区走完原 13 地点路线与凭证支线，不丢失每个旧 Location 的 Individual / Global 操作、批次数、PlayerCost、事实、凭证、路线和结束条件。

## Responsibility、依赖与边界

- 唯一责任：Scene / Operation Runtime 提供通用非战斗行动选择、局部 Scene 完成和结果投影；Location / Event 保持路线 / Gate / Cost 入场 / 离场限制、Fact / Item 和 Event Outcome 权威；ActionDef 继续提供效果。
- 依赖：G03 Task 0263–0268；PB-20 0270 完成并稳定 Strategy Park 事件内容映射；复用 PB-19 与 Task 0245–0248 的现有 Actor / Card / Performer / Target / Cost 能力。
- 包含：剩余十个旧地点的场景映射与路线 / 内容回归；修正 `gameplay-b-strategy-park.ts` 中错误的 “12-location” 文件注释为与源码 / 测试一致的 13。
- 非目标：在本 Task 给某一地点增加第二个 Scene；不改变旧 Route、credential Gate、Cost、visit limit、Story / Item / Fact 成果；不实现新目标组、M/N、Shop、Editor UI。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对 Task 的影响 |
| --- | --- | --- |
| 13 个 Location 中 3 个是战斗点，另外 10 个是西门简报、连廊、服务亭、电玩馆、急救站、迷宫、摩天轮廊、后台、东出口和地下控制室。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts` 的 `locations` 数组与 `GAMEPLAY_B_STRATEGY_PARK_IDS`；`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 对全部名称的表 | 明确十地点范围，避免 PB-21 与 PB-20 重复或漏掉控制室支线。源码注释写 12 但实际是 13，需按核实结果修正。 |
| 非战斗位置共用旧 `OperationLocationDef`，含 `interactionSceneId` / `activityId`、Individual 或 Global、`sceneActionBatches`、`sceneActions[]`、Cost gain / carry limit / Route。 | `src/data-services/contracts/operation.ts`；`gameplay-b-strategy-park.ts` | 旧分类 ID 是候选 Action 上下文，不是新 Scene 身份；旧操作包装映射后要保留 Action / Batch 的不同份数、费用与效果。 |
| 地下控制室已有一个 Global batch，含 2 Cost 的队员恢复行动和 0 Cost、actorless、fixed 的控制台记录；它们随同批结算，不是两个 sequential Scene。 | 同一内容源中 `IDS.locations.control`；`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 的控制室支线断言 | 迁移不能误把两项旧行动改成两个 Scene，固定记录的 fact 与原路线 Gate 不变。 |
| 既有虚拟路线跑经典主线、maintenance-pass / staff-radio 两条支线，重复访问 arcade / maze / ferris / control，并断言凭证消费 / Gate / Event success。 | `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` | 复用三条 route scripts 作为跨地点回归；须加 UI 实际探索验收。 |
| 当前地图 Sidecar / UI 测试含原 13 节点、Route gate、访问状态。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts`；`tests/ui/gameplay-b-strategy-park-map.test.ts` | 位置 / Scene 进度 View 迁移不得丢失现有 Route 与地图阅读；新复合 Location 留 PB-22。 |

## 最小 Read Set

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/05-conventions/testing.md`。
- `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`gameplay-b-strategy-park-ids.ts`、`gameplay-b-strategy-park-map.ts`、`src/data-services/contracts/operation.ts`。
- 运行时的 Scene / Operation progress、route evaluator、View projector 与 workspace 目标路径；只跟踪实际改动，不把目录整体读作 Read Set。
- `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts`、`gameplay-b-strategy-park-sample.test.ts`、`tests/ui/gameplay-b-strategy-park-map.test.ts`、`gameplay-b-operation-controller.test.ts`。

## 施工切片

### P0：锁定十个 Location 的一对一初始映射

- 按旧 Location 分列 Scene ID、`activityId`、旧可选 / fixed SceneAction、performer / target、batch 次数、各项 Cost、Effect / Fact / Item、出边 Route 与访问上限。
- 建议先保留“每个旧非战斗 Location 对应一个可见 Scene”的等价进度，不让旧 Location 已有多 SceneAction 变成多个顺序 Scene；确认后再交 PB-22 增加 Location 内顺序 Scene。
- 把 Location complete、Scene complete、Route availability 拆开验证；不由 Scene 自动做 Route transition。

### P1：迁移并从 Operation 工作区探索

- 使用 Park feed 完成一轮经典主线，并任选一条凭证支线通过控制室；在 UI 对照相同的费用、Item / Fact、路线 gate、回访次数和最终结果。

## 回归证据与 Operation 工作区验收

- 现有证据：`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 的主线和双凭证支线；`tests/ui/gameplay-b-strategy-park-map.test.ts` 的地图 / 路线交互；`tests/ui/gameplay-b-operation-controller.test.ts` 的 SceneAction performer / batch controller 回归。
- [x] `tests/ui/gameplay-b-strategy-park-map.test.ts` 和 `tests/ui/gameplay-b-operation-controller.test.ts` 覆盖 Strategy Park 的入口、地图与 Scene 操作控件；Engine 虚拟游玩覆盖主线中的非战斗行动。
- [x] `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 重放 maintenance-pass / staff-radio 两条控制室分支，检查 Gate、凭证消费、访问次数、结局与 Route，并断言 `controlRecord` 与 `controlPower` 同一 Resolution 批次结算、玩家费用仍为 2。
- [x] Park 当前 13 个 Location 均未声明 `scenes`；View / SceneAction Resolution 对每个实际操作地点使用该地点自己的隐式 `main` identity。`tests/engine/gameplay-b-strategy-park-sample.test.ts` 保留 13 节点地图与 20 条 Route 图证据。
- [x] G03 已将 Scene 完成、Location progress 和 Route 可用性分开投影；本 Task 不新增 Location ID 操作分支，也不修改内容数据。

## PB-21 证据化关闭（2026-10-08）

- Park 十个非战斗 Location 与三个战斗 Location 一样使用隐式 `main`，但各自完整身份由 Event / Location / Scene 组合区分。`interactionSceneId` / `activityId` 继续作为旧行动上下文，不升级为 Scene 身份。
- `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 对主线与两条凭证支线进行固定 Seed 重放；本轮断言 13 个 Location 的 implicit Scene identity 覆盖完整、战斗仍为 3 / 3 / 4 Beat，并确认控制室固定记录和付费恢复行动仍同批结算。
- Strategy Park map test 保持 13 Location / 20 Route graph；源文件注释当前为 `13-location`，没有缩减地图。费用、Action / Effect、Fact / Item、Gate、回访与 Event success 沿用已有回归。
- 结果：旧内容满足 PB-21 的一地点一 Scene 等价目标，不增加显式 `scenes: [{ id: 'main' }]`，也不拆分控制室的同批固定行动。

## 裁定前记录（已由 Owner 统一裁定覆盖）

- G03 Scene 定义 / Instance / State owner / 保存语义先冻结；对每个旧 Location 指定新 Scene 身份。不可从 `interactionSceneId` 或 `activityId` 猜测同一 Scene ID。
- 建议 PB-21 首轮采用一旧非战斗 Location ↔ 一个 Scene 的最小迁移；如果产品选择由多个旧 Location 共享 Scene Definition，需明确 Scene instance / state 是否仍随 Location visit 分开，不得无裁定共享 progress。
- 固定 `controlRecord` 是 Scene 内不可撤销行动并与 `controlPower` 同一批结算；确认迁移后的统一 Offer 是否保留 fixed scope / actorless rules，不能借多 Scene 改其时序。

## 本轮核验（2026-10-08）

- 定向 Engine 测试 4 个文件 / 14 项通过；Operation UI 入口、Controller 与 Park 地图测试 3 个文件 / 43 项通过；`npx tsc --noEmit` 通过。
- `git diff --check` 对本轮变更路径通过。
- 本 Task 没有改变 Strategy Park 内容字段；回归仅补充 `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 的 implicit Scene identity 和 fixed 同批断言。

## GALHCG 影响闭环

- `concept:operation-sample-content` 与 `concept:operation-character-hand-resolution` 的 Park 虚拟路线测试 Evidence 已更新；`concept:goal-workflow` 已映射本 Task 的归档文件。
- 直接路径 `review_changes` / `preview_many` 覆盖相关 Engine 测试和 Task / G04 文档；9 条 `maps_to` 更新经 plan、valid dry-run 后提交，写后复核无 stale Evidence。

## 后续边界

- PB-22～24 的多 Scene、位置群体目标及 M/N / 临时购买仍属后续范围；Editor 作者入口 / 旧清理留 G05。

## 相关路由

[[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[archive/task-0263-pb-13-scene-identity-lifecycle]] · [[archive/task-0268-pb-18-scene-completion-location-exit]]
