# Task 0270 / PB-20：Strategy Park 三处战斗迁入 Scene

状态：completed — Strategy Park 三处战斗由各自 Location 的隐式 `main` Scene 身份运行；固定 Seed 的 3 / 3 / 4 Beat 与既有路线回归通过，没有抽取共享 Scene 或重做战斗内容。
> Goal Owner 统一裁定（2026-10-08）：三处战斗 Location 各自拥有独立完整 Scene identity；旧 `interactionSceneId: park:combat` 仍只是行动上下文。未声明 `Location.scenes` 时使用隐式 `main`，Scene identity 仍由 Event / Location / Scene 组合确定。

## 目标

让 Strategy Park 的碰碰车区、烟花排练广场、中央舞台设备井三处原战斗共用 G03 的 Scene 展示、计划 / 目标 / 提交与结果体验，并保持敌方 / 环境行动、角色策略和 3 / 3 / 4 Beat 结算不变。

## Responsibility、依赖与边界

- 唯一责任：Scene / Runtime 投影当前地点的战斗 Scene；Operation Runtime 的现有 PreparedBeat、目标校验与 `commitBeat` 继续负责战斗计划和原子提交；StrategyProfile / CardPool / Actor 内容继续负责既有行动倾向与候选。
- 依赖：G03 Task 0263–0268；PB-19 完成或明确无内容变更；G01 的战斗阶段与角色站位 UI 验收完成。
- 包含：迁移三个既有战斗 Location 与其现有 Scene / Activity 上下文、Actor / Action / 战术 Profile / 自动行动映射；清理这些战斗仍依赖的 Location-ID UI 判断（若未由 PB-01 / G03 处理）。
- 非目标：改变三场战斗目标、beat 数、敌人伤害 / 环境效果、Skill RNG / seed、角色倾向权重、CardPool 合法性、StrategyProfile 或底层 `commitBeat` 命令；不迁移十个非战斗地点。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对 Task 的影响 |
| --- | --- | --- |
| Strategy Park 声明 13 个 Location，其中 `bumper`、`fireworks`、`boss` 以 `interactionSceneId: park:combat` 分类，beat 限额分别为 3、3、4。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts` 的 `scene` / `locations` 数组；`gameplay-b-strategy-park-ids.ts` | 每个战斗地点必须映射到新 Scene 身份；`park:combat` 是旧行动上下文分类，不自动等于共享的唯一 Scene ID。 |
| 样例对手分别为碰碰车冲撞者、烟花骚乱者、舞台设备领头者；各有 target priority / intents。学生候选经 Profile、StrategyProfile、CardPool 与场景 / 站位过滤组合。 | 同文件的 `actionCopy`、`actions`、`participants`、`studentProfiles`、`strategies`、`pools`；`tests/engine/gameplay-b-strategy-park-sample.test.ts` | 迁移须保留既有行动抽取、角色倾向、位置资格、目标与环境行为，不把“同一 Scene UI”解释成同一组规则。 |
| 虚拟游玩以固定 Seed 241024 跑主线和两条凭证支线，断言三处 Beat 数和全 Event success；路径中会先经过非战斗位置。 | `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` | 这是战斗 / 路线行为回归证据，Task 后应按 Scene 投影再加入或扩展集成覆盖；不宣称其本身是玩家点击验收。 |
| 现有 Operation feed 可直接启动 Strategy Park，且地图 / UI 已有 13 地点交互覆盖。 | `src/ui/components/center-panel.ts`；`tests/ui/gameplay-b-strategy-park-map.test.ts`；`tests/ui/gameplay-b-operation-controller.test.ts` | 使用同一入口进行工作区实际验收，不增加新 Event feed 项。 |

## 最小 Read Set

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/05-conventions/testing.md`。
- `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`gameplay-b-strategy-park-ids.ts`、`gameplay-b-strategy-park-map.ts`、`src/arona-clicker/contracts/operation-view.ts`。
- `src/arona-clicker/services/operation-plan-preparation.ts`、`operation-target-selection.ts`、`operation-resolution-planner.ts`、`operation-view-projector.ts`，以及 `src/ui/components/operation-workspace.ts`。
- `tests/engine/gameplay-b-strategy-park-sample.test.ts`、`gameplay-b-strategy-park-virtual-play.test.ts`、`tests/ui/gameplay-b-strategy-park-map.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`。

## 施工切片

### P0：冻结旧战斗行为基线

- 把三个旧 combat Location 的场景身份 / Scene progress、Action offers / prepared plans、Actor / Environment effects、target / beat / route / final outcome 逐一映射到 G03 合同。
- 明确三个地点是否各有独立 Scene ID；不得按共享 `interactionSceneId` `park:combat` 推导为同一 Scene instance。
- 不改用新的 AI / 自动决策逻辑；继续复用已实现的 Profile / StrategyProfile / CardPool 和 Runtime 规划流程。

### P1：迁移并通过同一 Operation 工作区

- 从 Strategy Park feed 启动 `park-inspection`，按原路完成碰碰车、烟花与终战，确认战斗 Scene 状态由 Runtime View 提供。
- 验证三场敌方行动、目标、位置资格与当前策略结果；战后仍按原路线到急救 / 后台 / 出口。

## 回归证据与 Operation 工作区验收

- 现有证据：`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 断言固定 seed 的三场 3 / 3 / 4 Beat 及路线终局；`gameplay-b-strategy-park-sample.test.ts` 核对内容定义；`tests/ui/gameplay-b-strategy-park-map.test.ts` / `gameplay-b-operation-controller.test.ts` 证明可点击 Strategy Park workspace 入口与 Operation 控件。
- [x] Strategy Park 入口 / 地图 / Scene 控件由 `tests/ui/gameplay-b-operation-controller.test.ts` 与 `tests/ui/gameplay-b-strategy-park-map.test.ts` 覆盖；三场战斗的 Runtime 行为由固定 Seed 虚拟路线覆盖。
- [x] `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 断言每个战斗 Resolution 的 `eventId / locationId / sceneId: 'main'`；Location ID 不同，因此三场 Scene identity 独立。主线与两条凭证支线仍成功，Beat 数为 3 / 3 / 4。
- [x] `tests/engine/gameplay-b-strategy-park-sample.test.ts` 保留全 13 Location / 三战斗 / 十个非战斗内容清单和路线图证据；战斗由通用 `currentStage` 投影识别，不依赖 Park 的地点 ID 特判。

## PB-20 证据化关闭（2026-10-08）

- Strategy Park 三个战斗 Location 均未声明 `scenes`，View 与 Commit 使用隐式 `main`；完整身份分别为 `park-inspection / bumper / main`、`park-inspection / fireworks / main`、`park-inspection / boss / main`。共享的旧 `park:combat` 不会合并 Location-local Scene identity。
- `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 以 Seed 241024 重放经典主线、maintenance-pass 和 staff-radio 两条凭证支线，保留三战斗的 3 / 3 / 4 Beat、结局、Route、凭证消费与固定行动语义；测试额外核对每次 Beat Resolution 的 identity。
- 结果：G03 的 Scene / View / Resolution 合同已满足 PB-20。无须为三个地点增加相同的显式 Scene 字段或抽取共享定义。

## 裁定前记录（已由 Owner 统一裁定覆盖）

- G03 最终 Scene 身份 / 生命周期和 PB-19 迁移基线；特别要明确是否“每场战斗一 Scene”而由 Runtime 共享机制，或内容是否会显式复用一个 Scene Definition。旧 `park:combat` 只是上下文标签，不能替代裁定。
- G01 PB-01 计划新增的战斗阶段字段是否成为最终通用 View 投影，还是 G03 Scene status / mode 完全接管。PB-20 不重复添加两套 stage 字段。
- 如果 G03 的计划 / 结果 view 统一但保留 `commitBeat`，如何在 UI 上做到相同玩家体验而不合并战斗和 SceneBatch 事务；默认遵循 G03 Task 0267 的薄适配边界，具体以冻结合同为准。

## 本轮核验（2026-10-08）

- 定向 Engine 测试 4 个文件 / 14 项通过；Operation UI 入口、Controller 与 Park 地图测试 3 个文件 / 43 项通过；`npx tsc --noEmit` 通过。
- `git diff --check` 对本轮变更路径通过。
- 本 Task 没有改变 Strategy Park 内容字段；回归仅补充 `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 的 implicit Scene identity 覆盖。

## GALHCG 影响闭环

- `concept:operation-sample-content` 与 `concept:operation-character-hand-resolution` 的 Park 虚拟路线测试 Evidence 已更新；`concept:goal-workflow` 已映射本 Task 的归档文件。
- 直接路径 `review_changes` / `preview_many` 覆盖相关 Engine 测试和 Task / G04 文档；9 条 `maps_to` 更新经 plan、valid dry-run 后提交，写后复核无 stale Evidence。

## 后续边界

- PB-21 的十个非战斗地点另行闭环；PB-22～24 新增复合 Scene、位置群体目标与 M/N / 临时购买仍属后续范围。

## 相关路由

[[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[archive/task-0263-pb-13-scene-identity-lifecycle]] · [[archive/task-0265-pb-15-action-offer-projection]] · [[archive/task-0267-pb-17-scene-atomic-resolution]]
