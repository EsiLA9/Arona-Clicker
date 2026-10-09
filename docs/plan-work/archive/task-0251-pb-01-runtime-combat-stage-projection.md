# Task：PB-01 — 由 Runtime 投影 Operation 战斗阶段

状态：completed — 已用必填 Location stage 契约和 Runtime View 投影替代 UI 地点 ID 判定。
> Goal Owner 统一裁定（2026-10-08）：PB-01 的施工默认规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；其中规则覆盖本 Task 在该裁定前写成“待定 / 待确认”的历史措辞。仅符合总裁定列出的升级条件时暂停。
> 实施状态（2026-10-08）：已按裁定完成；实现和自动化验收见“实施结案”。

## 目标

让 Operation UI 按当前 Runtime/Location 内容投影显示战斗计划、可替换行动和提交入口。Strategy Park 的碰碰车区、烟花排练广场、中央舞台设备井都能操作战斗回合；探索、交涉、补给地点显示其场景行动，不能因地点 ID 误显战斗按钮。旧旋转木马战斗继续正确识别。

本 Task 覆盖 G01 中“进入各战斗地点后可计划、替换并提交一回合”的部分，不负责本阶段的文字、费用和站位呈现。

## 设计边界

- 本 Task 包含：确定现有 Operation 内容中可靠的战斗阶段信号；若当前只读 View 没有该信号，增加最小 Runtime → `OperationView` 投影；让所有战斗/场景表面读取同一投影；保持 Location / EventRun 的权威归属。
- 本 Task 不包含：新的 Scene 身份与生命周期、场景/战斗规则更改、Operation 命令重构、卡牌目标系统、通用作者可定义阶段编辑器。
- 已裁定来源：[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]。Roadmap 中“Runtime 已准备的战斗阶段信息”不是已证实现状：`basePreparedBeat` 对未完成的有战术内容地点都会刷新，不能单独作为战斗判据。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| UI 在三处根据旧 Carousel 平台 ID 决定当前是否战斗。 | `src/ui/components/operation-workspace.ts`：`projectOperationActorHand()`、`renderMain()` 的 `canBattle`、`renderOperationWorkspace()` 的 `battle`。三处都比较 `SCENE.locations.platform` 和当前地点完成状态。 | 修复必须替换同一语义判断的三个消费者，不能只隐藏底部按钮却继续用旧 ID 按不同卡面。 |
| OperationView 有准备计划和当前场景模式，但没有显式 battle/scene stage。 | `src/arona-clicker/contracts/operation-view.ts`：`OperationView` 字段 `currentLocationId`、`currentActionMode`、`basePreparedBeat`、`effectivePreparedBeat`。 | 判断信号要由现有 Runtime/Location 内容可靠投影；不能以“OperationView 已经有 PreparedBeat”代替核验。 |
| PreparedBeat 不是 battle 专属现有信号。 | `src/arona-clicker/services/operation-runtime-service.ts`：`refreshPreparedBeat()` 只检查 Run status、当前 Location 完成状态及 `tacticalContent`；符合时调用 `prepareOperationBeat()`，没有按 `actionMode` 或 combat 分支限制。`operation-view-projector.ts` 将其投影为 `basePreparedBeat`。 | 在 Draft 未确认新来源前，不得拿 PreparedBeat 非空作为阶段判断。 |
| 两个实际内容包都声明了战斗位置；Strategy Park 有三处。 | `src/data-services/contracts/operation.ts`：`OperationLocationDef.interactionSceneId`、`actionMode`、`sceneActionBatches`、`maxBeats` 是不同字段，类型中没有 `phase`。`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`：`scene.combat` 下的 bumper/fireworks/boss Location 分别有 3/3/4 `maxBeats`；非战斗地点声明 `actionMode` / `sceneActionBatches`。 | 可用作制定现有内容判据的候选证据，但不能未经验证就把某一字段重新定义为通用 Battle 契约。 |
| 当前测试覆盖 Runtime 策略园路线，但没有证明三个 UI 地点的分类。 | `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts`：`classicRoute` / `playScenario()` 会依 `interactionSceneId === 'park:combat'` 结算战斗；`tests/ui/gameplay-b-operation-controller.test.ts`：策略园入口按 Event ID 启动并到地图起点，未覆盖三处战斗 UI 阶段。 | 增加 Operation UI 回归，覆盖三处战斗与至少一个非战斗地点；保留 Runtime 路线回归。 |

## 责任迁移与不迁移

- 迁移：将“当前地点是否是战斗”的唯一判断责任交给可信 Operation Runtime/内容阶段投影；`operation-workspace.ts` 只按 View 显示表面和按钮。
- 不迁移：EventRun、PreparedBeat、Action 合法性、Beat Commit 仍归 `OperationRuntimeService` 和既有 Runtime；UI 仍不持有写状态引用；不修改内容中的 Actor、Action、目标或费用规则。

## 施工切片

### P0：冻结阶段判据

- 开工前核对 `interactionSceneId`、`maxBeats`、`actionMode` 与其它现有 Location 字段在当前所有目标内容中的真实使用，选出一个可读、可测的 Runtime 判据。
- 若没有一项现有内容契约能无歧义区分战斗与场景，停止并请上游裁定是否增加最小字段/投影；不自行发明跨内容的隐式约定。

### P1：投影并统一消费

- 通过 Runtime/View 投影窄阶段信息，移除三个 UI 判断中的 `SCENE.locations.platform` 比较。
- 保留 Location 完成状态与 Run status 的提交门禁；阶段标记不能让已完成地点继续显示可提交回合。

## 测试与验收

- [ ] 从夏莱办公室打开“游园巡查：策略园”，沿西门 → 连廊 → 服务亭 → 电玩馆 → 碰碰车区路线推进；在碰碰车区从学生卡打开计划、点选一张可替换的无目标行动并点击“提交本回合”。
- [ ] 继续到烟花排练广场与设备井，分别重复替换行动和提交；三处都显示战斗计划/替代卡/战斗提交入口。
- [ ] 在服务亭或一个非战斗地点切回 Operation UI，能选场景行动/提交场景批次，且没有战斗回合提交入口。
- [ ] 按相同可点击路径启动旧旋转木马样例，完成一回合战斗；旧样例仍显示自己的非战斗操作。
- [ ] 增/改 `tests/ui/gameplay-b-operation-controller.test.ts` 与 `tests/ui/operation-workspace-view.test.ts`，以 UI 断言覆盖三处战斗和非战斗；保留 `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 对 Runtime 真实路线的覆盖。
- [ ] 在 Edge 实际操作完整路径；UI 变化不可只用 DOM 静态断言代替。

建议的定向回归命令：`npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/operation-workspace-view.test.ts tests/engine/gameplay-b-strategy-park-virtual-play.test.ts tests/engine/gameplay-b-scene-action-sample.test.ts`。

## Read Set

- `docs/docs-829/00-INDEX.md`、`docs/docs-829/02-modules/00-index.md`、`docs/docs-829/02-modules/arona-clicker.md`、`docs/docs-829/02-modules/ui.md`
- `docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/05-conventions/architecture-discipline.md`、`docs/docs-829/05-conventions/testing.md`
- `docs/ai/context-packs/ui-presentation.md`、`docs/ai/PROJECT-CONSTITUTION.md`
- `src/data-services/contracts/operation.ts`、`src/arona-clicker/contracts/operation-view.ts`、`src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/services/operation-view-projector.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`src/ui/components/operation-workspace.ts`
- `tests/ui/gameplay-b-operation-controller.test.ts`、`tests/ui/operation-workspace-view.test.ts`、`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts`、`tests/engine/gameplay-b-scene-action-sample.test.ts`

## 明确非目标

- 不建立 Scene / SceneRuntime 类型，也不重做 Location / EventRun。
- 不让 UI 读取地点 ID、`interactionSceneId` 或 Raw Runtime owner 来自行判定战斗。
- 不修改对手行动、自动计划、伤害、路线、Cost、奖励、保存和恢复机制。
- 不删除旧 Carousel 样例内容；不触及 Datapack Editor 或其 Schema，除非 P0 证明现有契约不足并先回到上游重划范围。

## 实施结案（2026-10-08）

- 在 OperationLocationDef 加入必填 stage: combat | scene，由 OperationView.currentStage 投影；UI 不再从 PreparedBeat 或 Location ID 推断战斗。
- Strategy Park、Carousel 内容及测试夹具均显式标注阶段；Registry / Runtime 定义校验拒绝缺失或非法阶段。生成 Schema 已同步。
- 定向回归：operation-view-projector、registry、gameplay-b-strategy-park-sample 与 Schema 同步测试通过。整组 9 文件定向套件共 133 项通过；类型检查通过。
- GALHCG：Task 已移至 docs/plan-work/archive/；迁移后路径映射已复核。
## 相关路由

[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/05-conventions/testing]]
