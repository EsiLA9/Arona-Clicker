# Task 0222 — 玩法 B V1 产品入口与多地点切片

状态：proposed — 等待 Runtime、路线、Datapack 与创作校验能力完成

## 目标

让玩家从 AC 正式 UI 选择并启动一场由默认 Datapack 定义的多地点事件，完整体验学生计划、有限指挥、地点路线和事件结局。

## Why

Runtime、Authoring 和局部 UI 各自可通过测试，并不能证明玩家能从 AC 正式产品入口完成一场事件。此 Task 将已验收能力装配为一个正式发布的可玩内容切片。

本 Task 同时是玩法 B 下一大型体验施工阶段：前序 Task 优先建设并稳定服务/内容接口，不再逐项试做聊天流交互。Task 0222 基于实际 OperationView、命令和 Runtime 重新裁定玩家交互，并形成正式三栏 UI；Task 0216 的单地点界面只证明机制可观察与接口可用，不作为最终布局。

## Scope

- 在现有 AC UI 中提供清楚的 Operation 入口、事件列表、启动和终局返回路径。v1 事件使用内容固定阵容；入口只显示参与者准入摘要与缺失原因，不做选人 UI。
- 依据前序服务/投影/命令接口设计并施工 Gameplay B 正式 Operation Surface。版式必须是左/中/右三栏：左为我方，中心为信息聊天流，右为敌方；只改玩法 B 工作区，不做全 AC UI 重设计。
- 中心信息栏是主阅读区并占可用工作区宽度过半，承载固定事件/地点介绍、已知内容、状态简报和 Resolution 叙述；左/右为较窄但可读的角色/敌方卡片区。
- 左栏以一张我方角色卡对应一名学生，卡内呈现身份、状态、当前计划/行为、行动理由、目标与可用操作；不得把学生计划/行为同时复制成独立多列、平行长列表或一名学生一条聊天消息。
- 右栏以敌方/环境参与者卡呈现状态、Intent、目标和压力。角色计划所用的“角色卡”是其行为与身份的呈现容器，不等于玩家有限 SceneCard 牌组中的卡牌实例。
- 复用 Task 0221 的同一份正式游乐园 Datapack 示例，在 `base:init:schale_office` 提供入口；不复制临时 TypeScript 样例、不另造地图生成器，Event Location 不映射成 Area/Spot。
- 用固定阵容的三地点事件演示一个完整路径：战斗地点出现学生自主行动和一次有限干预；非战斗地点同时覆盖 Individual 与 Global SceneAction、共享 PlayerCost 和一张场景卡；同一 `OperationActionDef` 获得“员工证”持有物；完成地点后通过 Route Gate 进入后续地点，转场统一应用物品消费、maxCarryCost、下一地点 costGain 和抽牌。
- 终点根据已累积的 Event 轨道/事实稳定得到成功或部分成功；随机不独占结果。展示一次终局奖励写入，使用 StateMutationService 且只提交一次。
- 支持在路线中途保存和恢复；恢复后的地点、Cost、持有物、待提交选择、牌区和随机流保持一致，不重抽、不重复发放 Cost。
- 正式 Surface 必须是左/中/右三栏：左为我方角色卡/当前计划/可干预对象，中为聊天流/地点/目标/路线/SceneAction/玩家手牌，右为敌方角色卡/当前 Intent。只改玩法 B Surface，不抽象通用 Widget，不做全 AC 重设计。
- `OperationViewActor` 增加最小 detached 展示字段 `displayName`、`avatarRef`、`hp`、`maxHp`；字段从已冻结到 Run 的参与者展示数据生成，UI 不反查可变 Runtime。
- 固定 Seed 在 1280×720 桌面尺寸完成上述路径；保留卡片 identity、键盘焦点和聊天流阅读连续性。完整 at-cap p50/p95、SaveData 字节基准与扩展设备矩阵标记为 post-v1。

## Gameplay B Demo 卡牌设计审查与 AC 迁移门槛

本节是本 Task 的强制施工前 Read Set 与设计交付，不是可选灵感参考。开始改 Operation UI 前，先逐项阅读原型文档/源码和当前 AC 对应实现，完成下方“卡牌映射审查表”，据此更新 UI 方案、OperationView 缺口和测试断言；审查表未完成前不得直接照搬 Demo 布局或开始卡片施工。原型只提供行为与生命周期参照，`prototypes/gameplay-b/` 的模型、Runtime、CSS 和规则不能直接变成 AC 的长期数据契约。

### 必读的玩法 B 设计记录

| 必读来源 | 必须核对的设计内容 | 本 Task 的使用边界 |
| --- | --- | --- |
| `docs/plan-work/archive/draft-0183-gameplay-b-ui.md`：`桌面主布局`、`左栏：我方 Chara 数据`、`中栏：场所、预览、聊天与 Click`、`右栏：敌方数量变化` | 三栏职责、角色身份卡信息、卡片稳定顺序、场景/战斗信息分栏，以及原型何种内容应留在中栏 | 只作为三栏和身份卡历史背景；Click 单推进、固定线性路线等旧 UI 假设不覆盖当前 Task 的路线/玩家交互设计 |
| `docs/plan-work/archive/task-0192-gameplay-b-three-column-ui-acceptance.md`：`Patch Unit 0192-U1` 与完成收据 | Demo 已有稳定三栏、角色卡节点 identity 和独立侧栏更新的验收口径 | 参考稳定 roster 节点和连续性；不可据此推定当前 AC 已有三栏 Operation 实现 |
| `docs/plan-work/archive/task-0198-gameplay-b-action-cards-and-hover-targets.md`：`设计边界`、`当前事实与代码落点`、`DOM Budget`、`Interaction Preservation`、`Completion Criteria` | 冻结行动/技能/敌方 Intent 作为所属角色卡内的附着小卡；目标可指向角色卡或其他行动卡；卡片批次、关系来源与清理生命周期 | 参考“行动卡属于行动者身份卡”的对象关系、悬停/键盘焦点关联和旧批次回收；AC 只读取自身 detached OperationView，不消费 Demo 的 FrozenBattleRound 类型 |
| `docs/plan-work/archive/task-0199-gameplay-b-location-cards-and-line-anchors.md`：`目标`、`设计边界`、完成收据 | 个人探索结果挂角色卡；当时的全队场所效果卡放在敌方空区并连向队员 | 属于旧原型的位置选择；当前确定的固定地点信息和 Resolution 进入中心聊天流，不能把其旧侧栏位置方案原样移植。若 AC 有真实作用对象关系，可评估沿用关系表达 |
| `docs/plan-work/archive/task-0200-gameplay-b-card-relation-top-layer.md`：`Constraints`、`Completion Criteria` | 角色卡、行动卡、场所卡之间的关系线、层级、高亮和批次清理 | 仅当 AC 正式交互确实需要关联表达时采用；不能仅为视觉效果新增关系或把 Hover 变成状态重算 |

以下为解释历史分支的补充来源：`docs/plan-work/archive/task-0201-gameplay-b-player-card-targeting-and-reselection.md`、`docs/plan-work/archive/task-0205-gameplay-b-map-and-player-actions.md` 的 Patch Unit 0205-U4B、`docs/plan-work/archive/draft-0207-gameplay-b-low-cognitive-load-ui-and-core-play-acceptance.md`。这些描述了玩家卡选目标/重选、有限玩家 SceneCard 牌区和早期体验约束；只用于辨清概念及其演变，不表示这些交互必须照旧实现。特别是 Task 0201 的拖拽重选不作为默认要求。

### 必读的 Demo 源码与当前 AC 替换点

| 目的 | Demo 参照（必须实际阅读的路径/符号） | 当前 AC 源码（必须实际阅读的路径/符号） |
| --- | --- | --- |
| 三栏及卡片宿主 | `prototypes/gameplay-b/src/style.css`：`.desk-layout`、`.side-panel`、`.character-card`；`prototypes/gameplay-b/src/view.ts`：`mountRouteGameView`、`createCharacterCard`、`createRoutePartyCard`、`syncParty` | `src/ui/components/workspace-frame.ts`：`WorkspaceComposition`、`renderWorkspaceColumn`、`renderWorkspaceFrame`；`src/ui/components/operation-workspace.ts`：`renderOperationWorkspace`。当前 Operation 设置 `composition: 'center-right'`，该 composition 实际只保留 `left + center` 两个传入列；三栏实现应改用渲染全部 `left/center/right` 的 `'columns'` composition，并给每列稳定且语义明确的 slot/role。不要误用当前 helper 中只返回左列的 `'all'` 分支。 |
| 行动/意图附着卡及关联 | `prototypes/gameplay-b/src/view.ts`：`showPreparedBatch`、`showRouteActivityBatch`、`resolveCardElement`、`drawRelations`、`refreshActiveRelation`；`prototypes/gameplay-b/src/style.css`：`.prepared-action-card`、`.field-effect-zone`、`.battle-relation-layer`；`prototypes/gameplay-b/tests/battle-cards.test.ts`、`route-cards.test.ts` | `src/ui/components/operation-workspace.ts`：`renderStudentPlan`、`renderIntent`、`renderMain`。目前学生计划卡集合与敌方/设施 Intent 均在 `renderMain` 的中心流里组为独立列表；这是本 Task 的明确迁移目标。`src/ui/css/operation-workspace.css`：`.operation-student-list`、`.operation-student-card`、`.operation-intents`、`.operation-intent` 是相应结构/样式替换点。 |
| actor 分类与展示数据 | `prototypes/gameplay-b/src/model.ts`：`RoutePartyView`、`PreparedBattleRound`、`PreparedPlayerAction`、`PreparedEnemyIntent`、`RouteEventRecord`；`prototypes/gameplay-b/tests/route-cards.test.ts`、`battle-cards.test.ts` | `src/arona-clicker/contracts/operation-view.ts`：`OperationViewActor`、`OperationView.actorStates`；`src/arona-clicker/content/operation-samples/carousel-safety-slice.ts`：`eventDefinition.actors`、`participants`、`studentProfiles`；`src/arona-clicker/content/operation-samples/carousel-safety-copy.ts`：当前试玩展示文案/角色名映射。使用正式投影信息区分 student、opponent、environment，环境实体不可误计作敌方。`OperationViewActor` 增加 detached 展示字段 `displayName`、`avatarRef`、`hp`、`maxHp`，由已冻结到 Run 的参与者资料生成；实施时按这一决定补最小字段，不再重新评估 UI lookup。禁止 UI 穿透读取可变 Runtime/EventRun。
| 当前测试/连续性 | Demo：`prototypes/gameplay-b/tests/battle-cards.test.ts`、`route-cards.test.ts`、`route-ui.test.ts` | AC：`tests/ui/operation-workspace-view.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`、`tests/engine/gameplay-b-operation-sample.test.ts`、`tests/engine/gameplay-b-event-runtime-integration.test.ts`。当前 UI View 测试仍断言 `data-composition="center-right"`，必须更新并增加三列职责/卡片归属断言；Controller 测试依赖 `data-operation-student` 节点 identity 和 region 更新，改造后继续保留或提供等价稳定身份标记。 |

### 卡片映射审查表（开工前填写并随 Task Receipt 留证）

每行都记录“Demo 中实际语义 → AC 当前数据/DOM → 沿用、改造或不沿用的决定 → 目标宿主与生命周期 → 对应验收”。不能只写“参考玩法 B”；若发现原型语义无法由 AC 数据准确表示，应先补最小只读投影/测试，不得在 UI 猜测。

| 对象/关系 | Demo 要核对的行为 | AC 本 Task 的明确方向 | 必须记录的实现裁定 |
| --- | --- | --- | --- |
| 我方身份卡 | `createCharacterCard` / `createRoutePartyCard` 的稳定角色宿主、身份和状态字段、`syncParty` 对 ID 的复用 | 左栏一名学生对应一张稳定身份卡；状态、身份和本回合计划都从 OperationView/只读展示投影读；保留稳定 actor ID 与局部更新 | 说明哪些身份/HP/resource/profile/头像字段可直接取用，缺字段是否增加只读投影，以及 roster 变化时如何保住未变化卡片节点和焦点 |
| 我方附着计划/行动卡 | `showPreparedBatch` 中冻结普通行动、观察/等待、特殊技能卡的卡主、费用、效果短句、目标和批次时序 | 学生当前计划及可用干预控件归属对应身份卡，作为卡内附着行动表现；禁止在中栏保留第二份学生计划列表/长条目或将每人计划复制成聊天消息 | 定义身份卡与附着行动卡的 DOM owner、当前计划/修订/理由如何分层、玩家控件位置、更新范围和稳定 key；不得把玩家有限 SceneCard 当学生行动卡 |
| 敌方 Intent 卡 | `showPreparedBatch` 中每个行动者的单独 Intent 卡及真实 target 关系 | 右栏一名 opponent 一张稳定身份卡；当前 Intent/目标附着在所属 opponent 卡上，不留中心 Intent 清单 | 写明 actor 分类规则、卡片所属 opponent ID、无 Intent/失能状态、目标信息来源和清理时机 |
| Environment/Facility | Demo `.field-effect-zone`、`showRouteActivityBatch` 与 Task 0199 的环境/地点效果及受影响对象 | 与 opponent 分开呈现为右栏独立的“场景/设施”区或具备明确 owner 的场景卡；环境 actor 不计入敌方人数，也不得伪装成敌方身份卡。固定地点介绍和已发生 Resolution 仍在中心流 | 记录哪些环境实体有独立身份卡、哪些只是中心场景叙述、各自的真实作用目标来源；标明 Task 0199 的旧“敌方空区”位置方案是沿用、改造还是舍弃 |
| 固定信息与 Resolution | Demo 场所叙述、Click 结果与路线事件如何进入事件流；与 Task 0199 侧栏结果卡区分 | 中栏是主要阅读面，按时间承载固定事件/地点信息、线索、状态简报、玩家决定摘要与 Resolution；不得重复左右卡已承载的完整计划/Intent | 定义哪些数据成为中心消息、如何排序/去重、摘要长度及新增 Resolution 后保留日志滚动位置的方式 |
| 有限 PlayerSceneCard | `prototypes/gameplay-b/src/model.ts`：`RoutePlayerCardDefinition`、`RoutePlayerDeckDefinition`、`RoutePlayerDeckView`、`RouteSceneChoiceView`；`prototypes/gameplay-b/src/view.ts`：`syncSceneChoices`、`playerCardInstanceLabel`、`playerCardSelectionSummary`；Task 0205-U3/U4B | 它是玩家有限场景牌组里的独立卡牌实例，不是学生/敌方身份卡，也不是身份卡上附着的当前行动卡。AC V1 的卡牌包装只引用 OperationActionDef；打出牌 hand→discard。 | 记录其命令/API、drawPile/hand/discard 投影、费用与合法目标展示位置，以及为何不会被误认成所属角色的计划卡；使用 `route-cards.test.ts`/`route-ui.test.ts` 追踪其 UI 语义。Task 0201 和 `battle/player-card-edit.ts` 是战斗行动目标重选，不可误读为 PlayerSceneCard 数据契约 |
| 关系、Hover 与焦点 | Demo `resolveCardElement`/`drawRelations`/`refreshActiveRelation` 和关系目标实际从冻结数据或场所事件解析；Task 0200 的层级/清理口径 | 只有当前投影明确给出的 target 才显示连线/高亮；身份卡与行动卡层级可读，键盘 focus 等价于 hover。若新 OperationView 没有可证明的关联数据，则本 Task 不补造视觉关系 | 标注关系的只读来源、端点 ID 映射、behavior/region 刷新等级、批次/地点切换/终局清理和键盘可访问测试；明确沿用、改造或本阶段不采用关系线 |

### 本 Task 卡片验收约束

- 最终 Operation 工作区必须实际渲染左、中心、右三个 slot；左列只承载我方学生身份卡及其计划/行动，右列承载 opponent 身份卡及其 Intent，并将环境/设施清楚独立分类；中心承载 AC 风格聊天信息流。测试需断言三个 slot/role 都存在，而不能只检查三栏 CSS class。
- `renderStudentPlan` 的内容必须迁入并归属单个学生卡；`renderIntent` 的内容必须迁入并归属对应 opponent/环境 owner。中心不得继续输出 `.operation-student-list` 或 `.operation-intents` 作为角色计划/Intent 的第二份表达；行动摘要确需进入日志时只陈述已发生决定/结果，不重复卡片上的完整计划内容。
- 给当前角色卡/Intent 卡使用的名字、短描述、HP 上限、头像等字段必须能从当前正式内容 copy 或 detached read projection 稳定解析；若本 Task 扩展 OperationView，测试其 detach/分类映射，并禁止由 UI 直接读 `OperationRuntime`/`EventRun`。
- 环境/设施 actor 按环境展示且从 opponent 总数中排除。确需表现统一场景效果时，场景卡只连向 Runtime/OperationView 明确声明的实际目标；固定场景描述和结算仍遵从中心信息流方向。
- 每个 actor 卡与每个附着计划/Intent 卡均有稳定且无歧义的 actor/action 标识；更新计划、改目标、Commit、Roster/地点更新后，未变角色卡不因重排到三栏而丢失 DOM identity。卡片消失、地点切换或终局时，清理其事件委托/目标引用/关系层状态；普通 hover/focus/scroll 不触发 Resolver 或全量 render。
- `tests/ui/operation-workspace-view.test.ts` 更新现有 `center-right` 断言：覆盖 `columns` 三 slot、我方/信息/敌方 roles、学生行动卡归属学生、敌方 Intent 归属 opponent、environment 不误计入敌方、中心不存在重复计划/Intent 清单且 Resolution 仍在中心。`tests/ui/gameplay-b-operation-controller.test.ts` 保持当前稳定学生卡 ID、计划修改与单个相关 region 更新语义；新增投影字段时同步覆盖相应 engine/integration 测试。

## Non-goals

- 不新增核心 Runtime 机制、通用剧情引擎、程序化地图或额外成长系统。
- 不创建专用 Runtime Editor、地图画布或全局 UI 重设计。
- 不制作阵容选择器、泛化卡片/Widget 框架或新的作者编辑器。
- 不以单一通关率或美术完整度替代玩家可理解的现场判断与状态因果。
- 不为窄屏内容移位单独扩大验收；三栏信息在目标桌面尺寸内同时可读即可。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| 游戏 UI 使用 Workspace/Controller/Runtime 命令和只读 GameView/Context。 | `docs/docs-829/02-modules/ui.md`；`docs/docs-829/06-wiki/50-ui/controller-commands.md`；`read-model-context.md` | 事件入口、Roster 选择和 Operation 操作由产品 UI 命令驱动。 |
| 正式应用内容从 AronaClicker 默认 Datapack 入口提供，测试 Datapack 与产品默认内容分离。 | `AGENTS.md`；`src/arona-clicker/content/default-datapack.ts` | 正式可玩样例放产品内容层，验证夹具留在测试包。 |
| Area/Spot 是世界线空间和功能设施，Runtime Editor 负责现有世界内容编辑会话。 | `src/data-services/contracts/world.ts`；`src/arona-clicker/services/runtime-content-coordinator.ts`；`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md` | Event 入口另立操作导航，不伪装成 Spot 功能。 |

## Data / API

- `OperationCatalogView`：可启动事件摘要、固定参与者准入摘要、锁定原因与入口状态；来源于 Registry/产品规则的只读投影。
- UI 命令：选择可用 Event、开始固定阵容 Event、返回事件目录或主 Workspace。
- Task 0221 的正式示例是唯一内容来源；本 Task 只将其接入默认 Datapack/产品入口，不复制另一份 Event/Location/Action/Profile。
- 角色卡所需 `displayName`、`avatarRef`、`hp`、`maxHp` 均来自已冻结的 Run 参与者展示快照并进入 detached OperationView；UI 不读取 Runtime owner。
- 不增加平行的 UI 写模型或单独的 Spot/Area 关联字段。

## Runtime Flow

默认 Datapack 加载并验证 → Registry 生成事件目录与固定参与者摘要 → 玩家启动 Event → OperationRuntime 建立 EventRun → 三栏 Surface 消费 OperationView、SceneAction、Route 与玩家卡命令 → 通过唯一 `transitionRoute(routeId)` 完成地点/Cost/抽牌转场 → 主 SaveData 中途保存并恢复 → 成功或部分成功结局 → StateMutationService 写入一次奖励 → 返回事件目录。

## Acceptance

- [ ] 固定阵容可从夏莱办公室启动；入口显示参与者准入摘要，不出现选人界面；未满足准入时说明缺失角色。
- [ ] 同一正式 Datapack 样例可从头到尾运行：战斗中可干预一名学生；场景中可完成 Individual/Global 行为和玩家卡；场景行动或卡牌通过同一 ActionDef 获得员工证。
- [ ] 员工证开启后续 Route Gate，转场可消费员工证；自动单出口与显式多出口都走 `transitionRoute(routeId)`，Cost 截断、下一地点 costGain 和入场抽牌一次提交，任何失败不改变 Run。
- [ ] PlayerSceneCard 与 SceneAction 共用 PlayerCost 且费用只校验/扣除一次；场景卡仅用于非战斗；打出后 hand→discard、不回洗、不再引入 played 分区。
- [ ] 正式 Surface 三栏职责符合左/中/右定义；学生计划/敌方 Intent 附着于所属角色卡，固定地点内容与结算留在中心聊天流，没有重复的中央计划/Intent 清单。
- [ ] 角色卡使用 detached `displayName/avatarRef/hp/maxHp` 展示快照；操作 UI 不读取可变 Runtime。
- [ ] 固定 Seed 的输入可稳定到达成功和部分成功两种结局；结果与目标/事实/轨道相符，不由随机单独决定。
- [ ] 路线中途保存再恢复后，地点、EventRun、持有物、PlayerCost、牌区、RNG 和待提交状态一致；兼容版本不符时拒绝恢复，不重复抽牌或入场 Cost。
- [ ] 终局摘要清楚说明结果，允许的长期奖励只经 StateMutationService 提交一次。
- [ ] 浏览器在 1280×720 下完成上述流程；焦点、日志滚动和未变化角色卡节点保持连续。hover/scroll 不调用 Resolver 或全量 render。

## Tests

- **Unit：**固定阵容准入、ActionDef/CardDef 引用、resumeVersion 校验和奖励幂等。
- **Runtime/Integration：**正式 Datapack 示例经 Registry、Run、SceneAction/卡牌、`transitionRoute`、Save/Resume 到 Mutation 的单条路径。
- **UI：**浏览器完成最小固定 Seed 路径；检查三栏角色卡、中心聊天流、两类 SceneAction、Cost/卡牌/Route、保存恢复和焦点/滚动连续性。
- 不把 at-cap p50/p95、硬件矩阵或全局基准报告列为 V1 发布阻塞项；保留 Task 0220 的基本内容上限校验。

## Dependencies

- 依赖 Task 0216 的 OperationView/Controller/Runtime 边界（不沿用其界面布局）、Task 0218 的因果路线、Task 0219 的 Save/Resume、Task 0220 的 Datapack/Registry、Task 0221 的内容校验流程，以及 Task 0224/0225 的 SceneAction、PlayerCost 与有限场景卡组服务。
- 这些能力分别依赖 Task 0213–0215 与 Task 0217。

## Documentation / GALHCG

- Task Receipt 记录本次实际改变的入口、View 和 UI 事实；维护直接受影响的权威机制页。全图 freshness 扫描、额外 Concept 扩展和完整 GALHCG 批次维护为 post-v1，不阻塞最小可玩闭环。
- Read Set：`docs/docs-829/02-modules/ui.md`、`docs/docs-829/01-architecture/data-flow.md`、`docs/docs-829/06-wiki/50-ui/controller-commands.md`、`read-model-context.md`、`refresh-update.md`、`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md`、`docs/docs-829/05-conventions/testing.md`、`docs/ai/frontend-design-project-overlay.md`、Task 0213–0221 与目标源码/测试。

## 当前核验与剩余工作

当前已核对 UI/Workspace、默认 Datapack、Area/Spot 和 Runtime Editor 边界；未实现正式内容或产品入口、未进行浏览器验收。此 Task 负责将前序稳定能力组合成可交付的游戏内事件切片，并首次正式裁定、施工 Gameplay B 三栏和玩家交互。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0216-gameplay-b-command-loop-vertical-slice-ui]]
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]
- [[task-0219-gameplay-b-event-save-and-resume]]
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]
- [[task-0221-gameplay-b-authoring-and-content-validation-workflow]]
- [[task-0224-gameplay-b-scene-actions-and-route-cost]]
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]
