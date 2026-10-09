# Task 0265：PB-15 统一可执行行为投影

状态：completed — 已新增 UI-safe `OperationViewActionOffer` 联合候选投影，并保留来源身份、费用 / 目标语义和独立提交路径。
> Goal Owner 统一裁定（2026-10-08）：本 Task 原先待裁定的 offer identity / source boundary 由 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]] 明确；施工前问题段落保留为历史。
> 文档说明：事实表、架构门槛、施工切片与“当前核验”保留施工前记录；最终合同、验证结果和后续边界见“实施收尾与证据”。

## 目标

让 Scene 计划 UI 能用一个 UI-safe Offer 形式表达可选的学生行动、SceneAction 和 PlayerSceneCard：来源、执行者要求、目标候选、选择策略、费用、可用状态与失败原因都可读。Offer 只是可呈现与可选择的只读投影，不替换可信 OperationActionDef，也不携带效果执行逻辑。

## 设计边界

- 本 Task 包含：在裁定字段含义后提供统一 Offer projection；在原子场景 Operation 界面中呈现学生行动、SceneAction 与玩家卡的来源、目标和可用性；鼠标与键盘路径保持已建立的可访问性。
- 明确非目标：重做统一角色持牌 UI、改 ActionDef 效果合同、用 UI 判断规则合法性、合并战术和非战术写命令、M/N 选择与库存 / 商店。
- 已裁定来源：draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md；Offer 非 ActionDef 替代品；继承 PB-0245～0248 的投影和交互，不重复实现 performer / target / card interaction。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 战术候选投影为 OperationViewActionOption，含资格、费用、合法目标、阻塞理由。 | src/arona-clicker/contracts/operation-view.ts：OperationViewActionOption；src/arona-clicker/services/operation-view-projector.ts：candidateOptions。 | 可以复用现有合法性 projection，不让 Offer 在 UI 重新计算。 |
| SceneAction 和 PlayerSceneCard 为两种独立 DTO，有自己 scope / selectionPolicy / performerPolicy / PlayerCost / 目标字段。 | src/arona-clicker/contracts/operation-view.ts：OperationViewSceneAction / OperationViewSceneCard；src/data-services/contracts/operation.ts：OperationSceneActionDef / OperationPlayerSceneCardDef。 | Offer 统一含义时保留各来源字段语义，不把 PlayerCost、Actor/Team action cost 混为一项。 |
| 统一角色持牌 UI adapter 已存在，但不是 Runtime Offer 模型。 | src/ui/components/operation-workspace.ts：OperationActorHandCardView、projectOperationActorHand；docs/plan-work/archive/task-0246-gameplay-b-unified-actor-card-interface.md：统一角色归属投影同时保留不同提交边界。 | 不重造角色牌面；Offer 是否只在 Runtime View 层或交互 adapter 层聚合，待裁定。 |
| Scene draft 是 Controller 从 DOM / view 导出的 UI 选择数据；Runtime 命令另行校验。 | src/ui/controller-actions-operation.ts：OperationSceneDraft、saveSceneDraftFromWorkspace、scene command builders；src/arona-clicker/contracts/operation-scene-action.ts：OperationSceneActionBatchCommand。 | Offer 不能成为可变 Runtime 规则或写入口，也不能借 DOM 草稿确认为可信选择。 |
| 0245-0248 完成了 performer / target / cost、actor card mapping、目标语义、optional-student 与 skip batch；Task 0246 明确保留三种 Runtime 事务。 | docs/plan-work/archive/task-0245-gameplay-b-operation-scene-card-performer-target-cost-model.md 至 task-0248-gameplay-b-scene-card-activation-progression-and-links.md；docs/plan-work/00-index.md。 | 继承这些已实现来源，避免回退已完成 UX 或把独立命令混合。 |

## 架构裁定门槛

- Offer identity 关联稳定 Action ID、SceneAction / card instance 或本地候选 ID 的规则；避免对固定物理牌误用定义 ID。
- SelectionPolicy 的 required / fixed、performerPolicy none / optional-student、scope / timing 等字段的共同投影方式；这些枚举含义不可因 UI 统一而改写。
- availability 与 failure reason 的可信来源；哪些仅展示，哪些由 Runtime 命令再次校验。
- 多来源同一 ActionDef 是否作为一个或多个 Offer 呈现，及 Offer version 如何对应 Run / planVersion。

## 施工切片

### P0：Offer 字段裁定

- 审查三个当前 View DTO 与角色卡 adapter 的重复字段；仅提取足以表达 PB-15 行为的公共投影。
- 不将价格/费用的不同 owner 合并；不让 Offer 对象直接产生 StateDelta。

### P1：Operation 界面消费

- 将行动选择 UI 适配为从 Offer 读取来源、执行者和目标提示；运行时分别路由到现有被裁定命令。
- 在同一微型场景中呈现需 performer 与 actorless 动作，并至少各保留一项既有战术 / 玩家卡来源用于验证共同交互语义。

## 测试与验收

- [x] Engine test covers student Action, Location SceneAction, and physical PlayerSceneCard as three separately identified Offers; asserts Scene ID and absence of Action effects/write capability.
- [x] Existing Operation workspace/controller tests cover source-specific performer/target/cost selection and commit behavior; the G03 Registry UI flow clicks the SceneAction and uses its existing Scene batch commit path.
- [x] Offers are read-only data. UI source-specific cards retain their existing submit paths; the G03 change does not merge `commitBeat` and `commitSceneActionBatch`.

## 施工前核验记录（2026-10-08）

- 直接核对 OperationView 的 ActionOption、SceneAction、SceneCard DTO、OperationView projector、Operation workspace adapter、Controller SceneDraft，以及 PB-0245～0248 完成记录与定向 UI / Engine 测试入口。
- 当前无通用 ActionOffer；这不是“现有卡片无法操作”，而是三套投影结构依来源分开。
- 未修改源码、测试或机制文档；未运行测试 / 类型检查。

## 施工前 GALHCG 检索记录

- 发现路径：map EventRun / OperationView 概念，source SceneRuntime 与 sceneInstanceId；再按 UI / View / Controller 路由检查各来源 DTO。地图中 SceneAction 查询无命中不替代源码确认。
- 变更审查：规划文件新增，无实现文件变更，无 review_changes。
- 地图维护：ActionOffer 是 proposed，未登记为 implemented Concept 或映射。

## 实施收尾与证据（2026-10-08）

- `OperationViewActionOffer` is a discriminated read-only union of `student-action`, `scene-action`, and `player-scene-card`, with stable source identity (`sceneId`, Actor / SceneAction / card instance ID) and the corresponding source DTO. It carries no ActionDef, effects, owner reference, or write capability.
- `operation-view-projector.ts` derives Offers from the current Scene and existing UI-safe Actor, SceneAction, and hand-card projections. Multiple sources referencing one ActionDef remain separate Offers.
- `tests/engine/operation-runtime-service.test.ts` asserts all three sources, Scene identity, and no effect field. `tests/ui/operation-workspace-view.test.ts` clicks the formal actorless PlayerSceneCard through the Controller and checks that the public hand says “可就地加入本批” / “点按加入本批”, contains no Performer drag wording, and saves the actorless selection only into the reversible local draft. The union does not introduce a second submission path.

## 后续边界（G04）

- G04 extends the Offer vocabulary for group / purchase cases; current G03 does not add M-of-N or purchasing.

## 相关路由

draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/05-conventions/testing]] · [[docs/ai/context-packs/ui-presentation]]
