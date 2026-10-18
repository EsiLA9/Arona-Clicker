# Draft：Gameplay B 原子场景 Roadmap 阶段 I — V1 修正

状态：completed — G01 的 PB-01～PB-05 已于 2026-10-08 实施并完成定向回归；五份 Task 已归档。本 Draft 保留施工前背景与决策脉络。
> Goal Owner 统一裁定（2026-10-08）：本阶段适用的 PB 默认合同与升级条件见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；本 Draft 中相同主题的早期“待裁定”记录保留为讨论历史，不再阻塞已定默认规则。

## 目标与最终方向

G01 的可独立结果是：玩家能从夏莱办公室启动 Strategy Park，沿一条真实路线完成碰碰车区、烟花排练广场与中央舞台设备井战斗；在非战斗地点读到正确的现场操作；Cost、风险/事实/持有物及学生站位都能看懂。旧旋转木马样例依旧可玩且继续显示自己的事件内容。

本 Draft 只覆盖 PB-01～PB-05 的局部修复。后续统一操作语义、原子 Scene、内容迁移和编辑者能力仍属于 Roadmap 的其他阶段。Roadmap 是需求来源，不能证明其判断已在当前代码中实现。

## 本阶段玩法语义与边界

- 已采纳的目标：移除 Strategy Park UI 对旋转木马平台 ID 的战斗特判；修复会被 Strategy Park 误用的旋转木马文字；让当前余额的槽数准确；让现场事实、轨道、物品及行动状态易读；显示已有站位和行动资格信息。
- 明确暂缓：创建 Scene 抽象；更改玩法规则、自动行动、位置效果、Cost 收支或结案条件；重做人物卡；增加通用叙事系统、通用内容编辑器或存档迁移。
- 责任边界：`OperationRuntimeService` 仍拥有 EventRun、PreparedBeat 与费用状态；`OperationView` 是只读 UI 投影；UI 只渲染投影，不独立判断业务资格或写状态。只有窄阶段投影确有必要时才修改 View 契约。
- Task 建议顺序：PB-01 → PB-02 → PB-03 → PB-04 → PB-05。PB-05 对战斗 UI 的验收依赖 PB-01；多个 Task 会碰到 `operation-workspace.ts`，因此其余 UI Task 也应串行施工，减少同文件冲突。

## 当前事实与待核对问题

> 以下事实表记录施工前的核对快照。G01 实施后的当前事实以源码、测试和 `docs/docs-829/` 机制文档为准；已关闭的问题及结果见本 Draft 的实施结案。

| 问题 | 已核实依据 | 对方案/验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| 战斗阶段由谁识别？ | `src/ui/components/operation-workspace.ts` 的 `projectOperationActorHand()`、`renderMain()`、`renderOperationWorkspace()` 均用 `currentLocationId === SCENE.locations.platform` 判定。`src/arona-clicker/contracts/operation-view.ts` 有 `currentLocationId`、`currentActionMode`、`basePreparedBeat`、`effectivePreparedBeat`，没有明确阶段字段。`src/arona-clicker/services/operation-runtime-service.ts` 的 `refreshPreparedBeat()` 只在 Run 非终局、当前地点未完成且存在战术内容时重算 PreparedBeat；不以战斗/场景分支过滤。 | 不可把现有 PreparedBeat 直接称为战斗阶段。Strategy Park 的三处战斗由 `gameplay-b-strategy-park.ts` 以 `scene.combat` 配置并有 `maxBeats`；非战斗地点通过 `actionMode` / `sceneActionBatches` 配置。PB-01 需在开工时明确一个能由可信 Runtime 内容表达、且对旧样例和 Strategy Park 都成立的窄判定。若现有合同不够，暂停并让上游裁定最小投影/契约，不用 UI ID 特判替代。 | 已查实现状；阶段信号选择待核验 |
| Roadmap 所说“Runtime 已准备战斗阶段信息”是否是现状？ | OperationView 有 PreparedBeat 及 `currentActionMode`，但没有 `stage` / `isBattle`。`refreshPreparedBeat()` 对所有未完成的有战术内容地点刷新准备计划，因此 PreparedBeat 存在本身不能区分战斗。 | 这句话只能当 Roadmap 设计目标，不当当前实现事实；PB-01 仍需提供可靠区分方式。 | 已核实：原主张未证实 |
| Strategy Park 是否确有三处战斗且旧样例共存？ | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts` 中 `IDS.locations.bumper`、`fireworks`、`boss` 均用 `scene.combat`，有 3/3/4 `maxBeats`；`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 的完整确定性路线会访问并结算三处战斗。旧样例由 `gameplayBCarouselDatapack` 提供；`tests/engine/gameplay-b-scene-action-sample.test.ts` 覆盖其战斗/场景行动/结案，`tests/ui/gameplay-b-operation-controller.test.ts` 覆盖两个入口同时可用。 | PB-01 以三处 Strategy Park 战斗和非战斗地点为回归面，兼顾旧 Carousel 入口；该任务不改两份内容规则。 | 已核实 |
| 当前 Cost 是多少、哪个值是上限？ | `OperationEventContentDef.playerRouteState.playerCost` 是初始余额。`operation-runtime-service.ts` 的 `start()` 调 `applyLocationEntryCost()`，West Gate 初始 5 加 `costGain: 1`，所以新 Run 可用余额为 6；`gameplay-b-strategy-park.ts` 同一地点有 `maxCarryCost: 5`。`transitionRoute()` 才按来源地点 `maxCarryCost` 截断，再给目标地点发 `costGain`。`OperationView` 投影余额 `playerCost` 和来源地点 `maxCarryCost`。测试 `operation-runtime-service.test.ts` 还确认允许无事件级上限的非负 Cost。 | 现有 UI `MAX_COST_SLOTS = 5` 把 6 个当前余额槽画少了。`maxCarryCost` 是离场截断值，不是当前余额也不是已定义的场景容量。PB-03 只按 View 余额绘槽并保留这两个已存在的不同概念。Roadmap 的“场景容量”没有对应数据字段，不能在此 Task 新造规则。 | 已核实；容量一词不属于现有契约 |
| 状态名称是否由当前 View / Operation 内容提供？ | `src/data-services/contracts/operation.ts` 的 `OperationTrackDef` 只有 ID 和有界数值；`OperationEventContentDef` 声明 `factIds`、`knownFactIds`、`itemIds`、`heldItemIds`，不带局内 Track/Fact/Item 展示文案。`OperationView` 输出 `tracks: Record<string, number>`、`knownFactIds`、`heldItemIds`。Strategy Park 的物品 ID 是 `operation-item`，非全局 `ItemDef`；`gameplay-b-strategy-park-map.ts` 已为两种通行凭证提供特定名称，但没有 track/fact label 表。 | 当前不能声称这些文字已有通用 Registry 名称。PB-04 可沿现有事件呈现映射补齐 Strategy Park 阶段需要的名称，或在确认后把名字纳入只读 View；不得无裁定扩展 Datapack Schema。事实名称的权威来源和精确文案施工前仍需确认。 | 已查实；呈现来源待选择 |
| 当前错误 / 泛化文字落在哪里？ | `operation-workspace.ts` 的 `renderProgress()` 对未知 track 使用“现场状态”，`renderBackground()` 的已知事实只把旋转木马 fact 特判翻译；结算 `renderResolutions()` 对任何 `knownFact` 仍输出“旋转木马控制台已检查”。Strategy Park 的 action/actor 名称已由 View / `GAMEPLAY_B_STRATEGY_PARK_MAP.actions` 提供；某些 Operation Item 名称仍在 UI 静态映射。 | PB-04 覆盖 track/fact/item 名称和日志；PB-02 覆盖开场、战斗/结案和入口阶段文案，避免两者重复。 | 已核实 |
| 站位与行动资格数据是否存在？ | `OperationActorDef.positionId` 与 `OperationViewActor.positionId` 存在；Strategy Park 初始星野/芹香是 `back`、白子是 `front`，`stepForward` 效果把执行者改到 `front`，`frontGuard` 按 `positionIds: ['front']` 选择，CardPool 会按 front/back 过滤。`OperationViewActionOption` 投影 `selectable`、`blockedReasonIds`、`missingCapabilityIds` 等；`renderStudent()` 目前只显示名字/HP/资源，不显示 position。`renderAction()` 的阻塞文本从旋转木马 REASONS/ABILITIES 表查找，未命中时回退为“当前无法采用”。 | PB-05 只显示 View 中现有 position、当前牌的计划/可替换/不可用状态及已投影理由；不在 UI 重算资格、不改变 Pool/Action 规则。现有 Strategy Park 样例不保证常规手牌每次出现不可选牌，故回归测试需构造明确 blocked option 的 View fixture，不增添假内容。 | 已核实 |
| Roadmap 的“固定行动”是否适用于战斗 Action？ | `OperationViewActionOption` 没有 `selectionPolicy: 'fixed'`；战斗牌由 `projectOperationActorHand()` 标成 `selectionPolicy: 'planned'` 并按当前计划 `selected`，场景 Action / 玩家场景卡才有 `selectionPolicy: 'fixed' | 'required'`。 | PB-05 只给战斗牌显示当前计划、可替换、不可用；保留 SceneAction/Card 自身的 fixed 标记。不把战斗自动计划错误升级成不可替换合同。 | 已核实：Roadmap 用语需按现有合同收窄 |
| 外部粘贴是否包含可恢复的阶段 I SVG 资源？ | 提供的 Roadmap 中出现 GitHub favicon Markdown 占位链接，不含阶段 I 所需的 SVG 源码或资源路径；本阶段验收内容不依赖新增插图。 | 不把 favicon 误登记为项目资产，不影响 G01。 | 已核实到当前粘贴内容 |

## 裁定记录

| 待裁定问题 | Roadmap 建议 | 本项目决定 | 依据/待验证项 |
| --- | --- | --- | --- |
| PB-01 的 UI 阶段来源 | 读取 Runtime 准备好的战斗阶段；必要时扩充 OperationView；去除地点 ID。 | 采纳“只读 Runtime 阶段、UI 不判地点 ID”目标；未采纳“该阶段数据已存在”的事实表述。 | 需先确认当前内容契约中是否有可靠共用判据；PreparedBeat 并非此判据。 |
| PB-03 容量词义 | 当前可用值、场景容量、离场携带上限分开表达。 | 采纳当前余额与离场上限要区分；当前代码没有独立场景容量，PB-03 不添新容量状态。 | 西门新 Run 的余额确为 6、离场上限为 5；若产品要求第三个数值，另作裁定。 |
| PB-04 名称来源 | 先使用注册表、View 投影和内容表现信息。 | 采纳“先找既有来源”；对于 Operation 局内事实/轨道的通用来源暂不作假设。 | 当前契约没有对应局内 label；检查现有 presentation maps 后选最小方案。 |
| Task 0250 与阶段 I | Task 0250 的责任提取作为 PB-13 后施工参考，不阻挡 PB-01～PB-05。 | 采纳。 | Task 0250 的范围是 UI/Runtime 职责映射，不是阶段 I 的技术依赖。 |

## Draft → Task 准入

- [x] 语义和明确非目标已裁定：阶段 I 是现有玩法展示和识别修复，不做原子场景抽象。
- [x] PB-01 阶段信号已实现为必填 Location `stage`，并投影为 `OperationView.currentStage`；不再使用 `PreparedBeat` 或地点 ID 推断。
- [x] PB-04 局内 Track/Fact/Item 标签使用 Event-local presentation map；未新增全局实体字典或 Datapack Schema 字段。
- [x] 各 Task 有独立玩家验收与回归入口，并已写明责任归属、Read Set、有限边界和非目标。
- [x] G01 五个 Task 与旧 Carousel 自动化交叉回归已完成；后续 Scene 架构、操作语义和内容迁移仍属于 Roadmap 其他阶段。

本 Draft 的施工前裁定记录保留为背景；Task 已实施并归档，Owner 裁定仍由 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]] 统一约束。

## G01 实施结案（2026-10-08）

- [[archive/task-0251-pb-01-runtime-combat-stage-projection]]：必填 Location stage 与 Runtime View 阶段投影。
- [[archive/task-0252-pb-02-event-correct-operation-copy]]：Event-local 标题/简介与正确的阶段、路线、结案文案。
- [[archive/task-0253-pb-03-cost-balance-slot-projection]]：余额槽准确对应 `playerCost`，高余额紧凑显示；`maxCarryCost` 仍是离场上限。
- [[archive/task-0254-pb-04-readable-operation-state-names]]：Event-local Track / Fact / Item 与结果标签。
- [[archive/task-0255-pb-05-actor-position-and-action-eligibility]]：站位、当前计划、可替换/不可用状态和 View 原因显示。
- 验证：9 个定向测试文件、133 项通过；类型检查通过；Schema 由生成器同步。未单独记录浏览器手动游玩会话。
- 下一阶段按 Goal Set 推进 G02；G01 完成不表示整个原子场景 Roadmap 完成。

## GALHCG 发现记录

- `resolve_project` 使用本工作树绝对路径，返回 `project_id=acprogram` 且 `workspace_path` / `root_path` 与工作目录相同。`project_info` 返回 `metadata_status=absent`、空 `map_scopes` / `source_scopes`；本轮不假定项目自定义默认范围。
- `overview` 返回了含 `module:domain-operation` 与 Operation View 概念的导航页，但 `complete=false, stop_reason=page_limit`，不当作全图枚举。`lookup("OperationView")` 命中 `concept:operation-view-projection` 的摘要；`context()` 显示地图 Evidence freshness 为 unknown，所以此地图只用作导航。
- 术语检索：`lookup("Strategy Park")`、`lookup("PlayerCost")`、`lookup("SceneAction")` 为 0 命中；随后 `lookup("Operation Character Hand Resolution")` 精确命中已实现 Concept。零命中没有被当作不存在。`search(mode=path, query="operation-workspace")` 完整返回 8 个相邻文件。
- 精确源码搜索均返回完整、未截断结果：`SCENE.locations.platform` 命中 Presentation 和 UI 中的三处判断；`旋转木马` 命中入口标签、fact/log、战斗标题与出口说明；`MAX_COST_SLOTS` 命中常量和绘槽；`OperationTrackDef`、`positionId`、`park:combat`、`Math.min(playerCostBeforeExit` 定位到对应契约/投影/样例/Runtime。
- G01 源码、测试和当前机制文档已按实现更新；五份 PB Task 已从 `docs/plan-work/` 移至 `docs/plan-work/archive/`。移动后的旧/新路径与归档 Task 映射已按 GALHCG 协议复核；地图只作导航，当前实现事实仍以源码、测试和 `docs/docs-829/` 为准。

## 相关路由

[[docs/ai/goal-workflow]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/galhcg-project-map]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]
