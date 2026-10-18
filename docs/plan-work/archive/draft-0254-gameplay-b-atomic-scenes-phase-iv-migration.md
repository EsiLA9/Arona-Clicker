# Draft：Gameplay B 阶段 IV — 真实玩法迁移与复合场景

状态：draft — PB-19～PB-24 均已按 Owner 裁定完成各自内容、行为和验收闭环；G04 已完成。G03 Scene 身份 / 持久化合同及目标组、M 选 N 与临时购买的默认规则已由 Owner 裁定。
> Goal Owner 统一裁定（2026-10-08）：本阶段适用的 PB 默认合同与升级条件见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；本 Draft 中相同主题的早期“待裁定”记录保留为讨论历史，不再阻塞已定默认规则。

## 目标与最终方向

使用现有 Operation 内容证明 Scene 不只是新接口：先把当前旋转木马正式样例和 Strategy Park 的 3 处战斗 / 13 个 Location 映射到 G03 的 Scene 身份、计划与结算入口，再增加一个可从 Operation 工作区启动的复合 Location。复合 Location 连续进行调查和警报处置；警报场景使用关系 / 站位筛选、单体 / 群体目标、M 选 N 和共享 PlayerCost 下的临时购买。

本阶段保留每个现有规则与其权威来源。Operation Runtime / Scene 负责场景进度与结算边界；ActionDef 继续定义效果；Location / Event 保留空间、路线、入口约束与结局。当前 Runtime 注册的 Carousel 正式 bundle 为 `gameplay-b@1.0.0`，Strategy Park 样例为独立的 `gameplay-b-strategy-park@1.0.0`；建议复合 Location 延续 Park feed / bundle，并从 Operation workspace 可点击验收。当前独立 Datapack Editor 没有 Operation 表的作者界面；G04 不把 Registry / 生成 Schema 的存在当作 Editor 能力，PB-25 再规划编辑器入口。

## 本阶段玩法语义与边界

- 保留 Carousel 和 Strategy Park 的现有内容行为；迁移不等于重平衡，不改三处战斗的自动行动 / 角色倾向、成本、敌人效果或既有路线。
- Scene 是 G03 的轻量玩法组织单元。SceneAction、PlayerSceneCard、ActionDef、Route 和 Operation 提交命令不因共享展示而合并成一个新实体或万能事务。
- PB-19 先以**当前正式 Carousel bundle**作为迁移回归。`carousel-safety-slice` 与 `carousel-route-slice` 已存在；正式 `gameplayBCarouselDatapack` 实际从 `carousel-scene-action-slice` 组装。route slice 是另一个 resolver / 事件样例，不能误称为正式 bundle 当前运行内容，也不能照搬重造。
- PB-20 只迁移 Strategy Park 的 3 处原有战斗；PB-21 只迁移其余 10 个原有非战斗地点。多 Scene、群体站位目标与 M/N / 商店分别由 PB-22～24 加入，避免迁移 Task 同时改玩法。
- PB-23 复用 `OperationActionDef` / 目标效果与 Actor 的 `positionId`；不造新 Actor、目标实体或牌堆。PB-24 复用 G03 Offer / Plan / Preview / Resolution、共享 PlayerCost 和已有 Action effect；不接入 Spot 商店 / ShopService。
- PB-22 Owner 已裁定复合样例为独立小型 Registry 测试 Event，含一个有序多 Scene 的复合 Location 和最小出口 Location；它从通用 Registry Event 列表启动，不修改 Strategy Park 的 13-location 主线或 Boss，也不增加入口特判。
- `required` / `fixed` 是当前可选与自动纳入的规则，不等于 M/N。当前玩家 SceneCard 的多选牌区也不能单独证明存在作者可声明的 M/N 候选选择合同。

## 当前事实与待核对问题

| 问题 | 已核实依据 | 对方案 / 验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| PB-19 Carousel 是否需要字段式搬迁？ | 正式包仍由 `gameplay-b-datapack.ts` 从 `carousel-scene-action-slice.ts` 组装；其三个 Location 都未声明 `scenes`。`gameplay-b-scene-action-sample.test.ts` 已断言 View / Resolution / 存档 / Route 使用隐式 `main`。 | 只验收正式 `gameplay-b@1.0.0`；三地点已由 Runtime implicit `main` Scene 满足，不添加 `scenes: [{ id: 'main' }]`。 | completed：等价迁移已关闭 |
| Carousel 路由切片是否就是正式事件？ | `carousel-route-slice.ts` 是独立的 4-Location resolver 事件；`tests/engine/gameplay-b-route-sample.test.ts` 导入独立 `carouselRouteSliceResolver`。正式 Datapack wrapper 没有导入它。 | PB-19 仅迁移正式 Carousel；独立 `carousel-route-slice` 保留为测试样例，不并入正式包。 | completed：Owner 已裁定 |
| Strategy Park 是否覆盖三处战斗和 13 个地点？ | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts` 的 `locations` 定义西门、连廊、服务亭、电玩馆、碰碰车、急救站、迷宫、摩天轮、烟花、后台、中央舞台设备井、东出口、地下控制室共 13 个；`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts` 明列 13 个名称并断言战斗分别 3 / 3 / 4 Beat、主线及两条凭证支线成功。 | PB-20 / 21 必须覆盖原有 3 个战斗点与 10 个非战斗点；虚拟游玩测试是 Runtime 路线证据，不代替 Operation UI 实操。 | 已核实 |
| 源码对地点数是否一致？ | `gameplay-b-strategy-park.ts` 的当前注释与 `locations` 数组 / 虚拟游玩表均为 13；Strategy Park map test 也断言 13 Location 和 20 Route。 | 保留完整 Strategy Park 13-location map；不得以历史错误注释缩减。 | completed：现行代码 / 测试一致 |
| 当前是否有独立 Scene 或 Location 内连续 Scene？ | `OperationLocationDef.scenes` 是可选的有序 Scene 列表；未声明时由 Runtime 生成隐式 `main` Scene。`EventRun` 保存 Scene 进度，View / Resolution 以 Event + Location + Scene 确定 identity。 | PB-19～PB-21 的现有 Location 均不必添加显式 `main` 字段；PB-22 已用独立测试 Event 验证同一 Location 内 A→B 与 checkpoint 恢复。 | PB-19～PB-22 completed |
| Action target 是否只支持一个 Actor？ | `OperationActionTargetDef` 为 `none` 或单一 `actor` 关系 / Actor ID / type 过滤；`OperationInterventionDraft` 是单目标。SceneAction / SceneCard 命令却有 `targetActorIds[]`：Individual 必须恰好一个，Global 当前可选一个以上，Planner 对每个所选 ID 验证关系并对目标逐个应用效果。 | 应准确表述为“Action target 合同没有位置 / 群体描述符和数量规则”；不能说所有场景结算只能作用于单 Actor。PB-23 新增范围是可复用的组 / 位置语义，不重复造多目标数组或 fan-out 结算。 | 已核实 |
| 当前是否已有站位？ | `OperationActorDef.positionId`、Actor `actorPosition` Effect 和 `OperationViewActor.positionId` 已存在；Strategy Park 的 `positionIds` 用于候选牌筛选，`operation-target-selection.ts` 不按目标 `positionId` 筛选。 | 位置是 Actor 状态和角色行动资格输入，但不是当前 Action target 规则。PB-23 必须定义目标位置过滤并确保和 `relation` / `allowedActorIds` / `allowedActorTypes` 取交集。 | 已核实 |
| selectionPolicy 是否表达 M 选 N？ | `OperationSceneActionDef` / `OperationPlayerSceneCardDef` 与 View 的 `selectionPolicy` 只有 `required | fixed`；`required` 为玩家可选，`fixed` 自动纳入。 | PB-24 新增 scene-local exact-N 候选组；fixed 自动纳入但不计数。 | 已实施并验收 |
| Operation 内是否已有小商店？ | EventRun 有共享 `playerCost`；SceneAction / PlayerSceneCard 费用与 Action Actor / Team 资源费用在 SceneBatch preview / commit 联合处理；Action effect 有 `heldItem` grant。`src/data-services/contracts/operation.ts` 没有 Shop / stock / purchase 定义，Operation Runtime 未调用 Spot `ShopService`。 | 可复用现有费用与 Action 效果形成购买候选，但“临时”的库存、购买次数 / 结果语义尚不存在；不能把全局 ShopDef 或 Spot 商店说成 Operation 商店。 | 已核实；产品语义待裁定 |
| 当前运行包与独立编辑器是否都有同样的作者入口？ | `src/data-services/contracts/datapack.ts`、`src/data-services/registry/registry.ts` 和 `operation-content-validation.ts` 支持 Event、Location、Action、StudentProfile、StrategyProfile、CardPool 六个 Operation 表；`src/arona-clicker/runtime.ts` 分别注册 `gameplay-b@1.0.0` Carousel 和 `gameplay-b-strategy-park@1.0.0` Strategy Park bundle。生成 Schema 当前列有六个 Operation 表，但 `tools/datapack-editor/schema/types.ts` 的 `TableKey` 与 `editor-extras.ts` 的 `TABLE_META` 没有这些表；`engine-schema.sync.test.ts` 只检查四个。 | G04 的可点击作者样例经 Runtime bundle / Operation feed；建议新复杂 Location 延续 Strategy Park bundle，不要把 Registry / 生成字段推成独立 Editor 可编辑或已具备 round-trip。Editor 作者体验留 G05。 | 已核实 |
| 当前 Operation 入口是否为任意事件目录？ | `src/ui/components/center-panel.ts` 保留 Carousel 与 Strategy Park 两张内置卡，并将其余当前 Init 的 Registry Event 投影为通用入口。 | PB-22 独立测试 Event 已通过通用 Registry Event 卡启动；没有新增硬编码 Event-ID 卡片。 | 已用 Controller 点击回归核验 |
| Task 0245–0248 与 Task 0250 如何用作事实？ | 0245–0248 已归档，当前源合同 / UI / Planner 仍可见其 performer、目标、费用、SceneCard、fixed / required、可跳过与手牌语义。Task 0250 当前已冻结归档。 | 0245–0248 是待复用的已实现能力线索；0250 只作最后已知导航候选。所有能力事实均由当前源代码 / 测试核实。 | 已核实 |

## 裁定记录

| 待裁定问题 | Roadmap 建议 | 当前决定 / 提案 | 依据 / 施工前门槛 |
| --- | --- | --- | --- |
| PB-19 是否重做 Carousel 样例？ | 迁移正式包的战斗、通道行动、出口行动和玩家牌。 | 已关闭：正式内容未声明 Scene list，隐式 `main` 满足 Runtime Scene identity；`carousel-route-slice` 作为独立测试样例保留。 | Scene Action sample、Save/Resume 和 Route 定向回归通过。 |
| 13 个 Strategy Park Location 如何划 Scene？ | 三战斗迁移及其余地点按类型迁入 Scene。 | 已关闭：13 个 Location 各自使用 implicit `main`；三战斗的 `locationId` 不同，构成独立身份。十非战斗地点每处一个 Scene 等价进度；不把 `interactionSceneId` / `activityId` 当新 identity。 | 固定 Seed 3 / 3 / 4 Beat、13 identity、地图 / route / fixed batch regression 通过。 |
| 新复合样例在哪里？ | 设备 Location 内调查后处理警报。 | PB-22 已实现为独立小型测试 Event `atomic-scene-demo`，含复合 Location 与最小出口 Location；A→B 不作 Route 转场，B 成功后独立地点目标和完整 Scene 序列使唯一 Route 自动转场，不改 Strategy Park 13-location map；通用 Registry Event 列表可点击启动。 | Engine / Registry UI 定向测试与浏览器验收见 PB-22 收尾记录。 |
| 多 Scene 顺序与存档 | 同一 Location 内调查 → 警报，不转移位置。 | Scene 按 Location 有序定义；只有有效提交满足当前 completion 才记录完成，空 skip / 被拒绝提交不推进；Run progress 沿用既有 EventRun checkpoint 与重访边界。不新增独立 Save owner 或迁移层。 | `gameplay-b-multiscene-location.test.ts` 验证 A→B、skip、失败提交与 checkpoint 恢复。 |
| 目标过滤和选择数量 | 前排 / 后排、单体 / 群体；位置变化后合法目标更新。 | PB-23 已裁定：Position 是 Action target 合法性一部分；`select` 与 `all-eligible` 明确选择模式；Relation / Type / ID / Position 过滤取交集，空组不可执行，不静默换目标。 | PB-23 后续实现；无需在人类确认同一规则。 |
| M 选 N 与临时商店 | 在 Offer 选择上限制候选数并按 PlayerCost 购买临时物品。 | PB-24 实施了同一批 M 个 required 候选恰选 N 个；fixed 不计数。购买默认每 Run 一次，复用 PlayerCost 与 Action Effect，不建 ShopService / 独立货币。 | PB-24 已完成并归档。 |
| Operation 内容作者体验 | 新内容包不需专属 UI 按钮或地点判断。 | G04 只要求在已注册 Gameplay B 内容 bundle 中提供可点击样例，并由通用 Scene UI 展示；不承诺独立 Datapack Editor 无 TypeScript 编辑 Operation。 | Editor DSL 当前没有 Operation TableKey / TableMeta；PB-25 才是编辑器准入。 |

## 阶段 Task 切分与准入状态

| Task | 独立交付边界 / Operation 工作区验收 | 前置 / 未完成裁定 | 状态 |
| --- | --- | --- | --- |
| 0269 / PB-19 | 正式 Carousel 三 Location 使用 implicit `main`；保留战斗、通道、出口行动、牌、路线与结案。 | G03、G01 已完成；`carousel-route-slice` 保留独立测试样例。 | completed / archived |
| 0270 / PB-20 | 三处战斗以不同 Location identity 使用 implicit `main`；固定 Seed 三场 3 / 3 / 4 Beat 与路线不变。 | G03、PB-19 已完成；不抽共享 Scene Definition。 | completed / archived |
| 0271 / PB-21 | 十个非战斗 Location 每处一个 implicit Scene；固定项 / 费用 / Effect / Route 等价。 | G03、PB-20 已完成；保留 Strategy Park 13-location map。 | completed / archived |
| 0272 / PB-22 | 一个复合 Location 内先调查再处置警报；A 后地点不变，B 后依地点目标与完整 Scene 序列成功，并按唯一 Route 自动转场；Run / Map 保留来源进度。 | G03、0271；按 Owner 的独立测试 Event、线性 Scene、checkpoint 与重访规则实施。 | completed |
| 0273 / PB-23 | 警报 Scene 中关系 + 位置目标过滤及单体 / 群体操作在 Operation 中可见且可结算。 | 0272、PB-05 站位显示；按 Goal Owner 对位置过滤、群体 fan-out / 子集及空目标规则施工。 | completed / archived |
| 0274 / PB-24 | 同一复合 Location 提供 M 选 N 候选及两件不同价位的临时购买；用户能预览、撤销与结算。 | 0272–0273、G03 Offer / Plan / Preview / Resolution；按 Owner 的 exact-N、Run-local marker、共享 PlayerCost 和同批原子结算合同施工。 | completed / archived |

PB-19～PB-24 的闭环证据同时使用 Engine 行为回归、UI 入口 / 控件点击测试和对应真实工作区验收；没有为了满足字段形状而改写 Carousel 或 Strategy Park 正式路线。PB-22 验证同地点多幕与唯一 Route，PB-23 验证位置 / 群体目标，PB-24 验证 M/N、双价格购买、marker 与 Run 行为。归档证据见 PB-22～PB-24 对应 Task。Task 表的 `proposed` 仅表示尚未施工，不表示需重复征求 Owner 已批准的默认合同。

## 最小 Read Set

- 通用：[[docs/plan-work/00-index]]（只核对当前任务状态）、[[docs/ai/goal-workflow]]、[[docs/ai/task-read-set-routing]]、[[docs/ai/galhcg-project-map]]、[[docs/ai/PROJECT-CONSTITUTION]]、[[docs/docs-829/05-conventions/testing]]。
- Operation：[[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]、[[docs/docs-829/03-data-structures/operation-view]]；Operation 没有单独上下文包，按任务只读目标契约、服务、UI 和定向测试。
- Carousel：`gameplay-b-datapack.ts`、`carousel-scene-action-slice.ts`、`carousel-safety-slice.ts`、`carousel-route-slice.ts`、`operation-workspace.ts`、对应 scene / route / Operation Controller 测试。
- Strategy Park：`gameplay-b-strategy-park.ts`、`gameplay-b-strategy-park-ids.ts`、`gameplay-b-strategy-park-map.ts`、Runtime / View / Workspace 目标文件、虚拟路线与 UI 地图 / Controller 测试。
- 多 Scene / 目标 / M/N：`data-services/contracts/operation.ts`、Operation Action / SceneAction / View 合同，`operation-target-selection.ts`、`operation-resolution-planner.ts`、Operation 定义校验 / projector / controller / workspace 目标路径及定向测试。
- 内容合同发生变化时，按影响追加 [[docs/ai/context-packs/datapack-schema]]、[[docs/docs-829/05-conventions/schema-sync]]、Registry 内容校验和实际 Schema 同步测试；不读独立 Editor UI，除非任务明确跨入 PB-25。

## Draft → Task 准入

- [x] 语义：保留既有玩法迁移与新复合地点终态，明确 G04 只要求 Operation 可试玩，不代替 PB-25 的 Editor 作者交付。
- [x] 事实：核对 Carousel 当前 bundle / route slice 区别、Strategy Park 13 Locations / 3 场战斗、Scene / target / position / selection / cost 边界，以及 Runtime / Editor 的真实入口差异。
- [x] Task：六项均有责任归属、依赖、范围、最小 Read Set、回归证据和真实 Operation 工作区验收。
- [x] Owner 默认合同：G03 Scene identity / Save owner 已冻结；PB-22 独立测试 Event 与线性 Scene 顺序、PB-23 Position / group target、PB-24 exact M/N 与受限购买均有默认施工规则。
- [x] 后续边界：编辑器入口与最终旧代码删除分别留 G05 / PB-25、PB-26。

## 下一步

PB-19～PB-24 已按各自内容 / 行为边界完成，G04 已关闭。后续进入 G05：先完成 PB-25 的独立作者无损链路，再以替代证据推进 PB-26 清理。

## GALHCG 发现与证据闭环

- 项目绑定：`resolve_project` 用工作区绝对路径确认 `project_id=acprogram`、`workspace_path` / `root_path` 与当前 ACProgram 一致；`project_info` 为 `metadata_status=absent`、没有专属 map / source scope。项目图是候选导航，不是代码事实。
- 查询：`lookup("Operation")` 的首 6 / 16 候选含 `concept:operation-action-planning`、`concept:operation-event-run-runtime`、`concept:operation-route-outcome` 等；按精确名查 `Operation Run Lifecycle`、`Operation Action Planning`、`Operation View Projection` 可读候选。`lookup("SceneAction")`、`lookup("Scene Card")`、`lookup("Carousel Safety")` 零命中只用于继续查源码，不能证明机制不存在。
- 路径 / 源码导航：`search(path, "gameplay-b-strategy-park")` 返回源码与两项测试；`search(path, "carousel-safety")` 返回 Carousel safety / ID / scene-action 文件。宽泛 `selectionPolicy`、`targetActorIds`、`positionId` source 搜索因结果 / 预算截断；之后以本地精确搜索和直接读取合同、Planner、内容与测试补足，不以截断结果推断全貌。
- 版本状态：Task 0250 已由主任务冻结归档；不把它的摘要用作能力事实。0245–0248 只作已实现能力候选，按当前源代码和测试复核。
- G03 冻结后，对本轮 7 个直接变更路径执行 `refresh`、逐路径 `review_changes` 与 `preview_many`；全部预览均有可用 current token。
- 按现有 owner 更新 9 条 `maps_to`：Carousel sample test → `concept:operation-scene-deck` / `concept:operation-sample-content`；Park virtual-play test → `concept:operation-character-hand-resolution` / `concept:operation-sample-content`；Phase IV Draft、G04 card 与 PB-19～21 归档 Task → `concept:goal-workflow`。
- `plan_map_updates` 完整，9 个 Evidence references / 7 个路径；`update_map(dry_run=true)` 返回 `valid=true` 且完整后提交同一批。写后逐路径 `review_changes` 与 owner context 确认映射及 Evidence。
- 本轮 focused Engine tests 4 文件 / 14 项、UI tests 3 文件 / 43 项、`npx tsc --noEmit` 均通过；`git diff --check` 通过。
- PB-24 对 29 条直接变更路径完成 GALHCG 写后复核：stale Evidence 为 0；63 个更新后的 node / edge owner 均 fresh / complete。更新了 14 个节点、45 条现有关系并新增 4 条 `maps_to`；4 批均完整且 dry-run valid，共提交 95 条 owner Evidence references。未开展全图质量审计。

## 相关路由

[[AGENTS.md]] · [[docs/ai/goal-workflow]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/galhcg-project-map]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/05-conventions/schema-sync]] · [[docs/docs-829/05-conventions/testing]]
