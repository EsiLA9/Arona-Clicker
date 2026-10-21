# docs/plan-work — 当前计划与历史材料入口

状态：active — 本文维护当前推进项与必要路由。

> 本目录记录目标、裁定和阶段状态，不是当前机制事实源。系统现状以源码、测试和 [[docs/docs-829/00-INDEX]] 为准。

玩法目标与施工准入见 [[docs/ai/goal-workflow]]。可删除的 Goal Set 入口见 [[goalsets/README]]；正式 Draft、Task 与 ADR 建立在本目录根目录，并在下方登记。

## 当前推进


- [[docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives]]：E0-contract-approved；[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]] 已按E0最终批准和行为金样更新为正式E1施工Task，拆分19个依赖明确的产品Unit（均未执行）。只实现E1-COMPAT-1；独立敏捷AG-1合同已批，等待E1产品验收，不提前施工E2–E5。

- [[docs/plan-work/draft-0311-gameplay-b-maprun-engine-integration-investigation]]：draft；当前检出只读调查完成，覆盖 MapRun 本体、外部引擎接线、测试证据与后续分期；完整结论见 [[docs/plan-work/report-0311-gameplay-b-maprun-engine-integration-investigation]]，玩法合同与实施 Task 待后续裁定。

- [[docs/plan-work/task-0309-maprun-staging-and-reentry-workspace]]：proposed；已调查 MapRun 开始／继续、固定队伍准入、局内状态与保存恢复，提出行前／续行准备页、只读队伍和资源信息及入口—现场返回方案；V1 不实现选队，本轮只交接 Task，等待实施。


- [[docs/plan-work/task-0306-area-hero-workspace-and-story-entry]]：proposed，等待其他模型执行；正常游戏 area-hero 进入区域 Workspace，中／右栏联动，统一信息概览、区域故事、主动故事与事项提醒入口，原“故事”收敛为历史重播；进入门控与右上角提示小标的细则在 P0 核实并裁定。
- [[docs/plan-work/task-0308-active-story-area-delivery]]：implementation complete；FollowUp 与 9 个仅依赖故事目录开放的 ActiveStoryEntry 投递到当前 Area，故事页仅保留已完成历史；本次扩展通过类型检查，行为测试未重跑，宽屏体验待确认。


## 本轮归档（2026-10-21）

- [[docs/plan-work/archive/task-0313-gameplay-b-e0-contract-freeze-and-admission]]：E0文档交付complete；U1–U5现状核证/合同回写/敏捷设计/行为用例/准入完成，当前基线78项通过；用户2026-10-21“全部按推荐”批准§9.2全部八项；E1合同准入通过，敏捷等待E1前置实现，尚未实现产品。

- [[docs/plan-work/archive/task-0310-area-map-navigation-service-v1]]：completed；独立 areaMaps 装载与脱敏查询、共享旅行准入、三栏浏览/历史/相机、显式移动与生命周期已实现并通过宽屏浏览器验收；新增 49 项测试通过，最终跨域回归另有 5 个并行 Story 断言失败，见最终 Receipt。

- [[archive/task-0302-standalone-node-graph-ui-demo]]：completed；TypeScript 独立节点探索与子图导航 UI Demo 已实现并装配到根工具台与 Vite 构建，定向类型检查、构建、preview 与 17 步浏览器验收通过；是否适合未来产品待使用者体验后裁定，不接入游戏业务。
- [[archive/task-0303-node-graph-demo-visual-polish]]：completed；桌面视觉增强与世界线偏移表现，提供偏移叠层 / 分歧轨迹 / 相位对照三种可切换方案，保持探索规则；不做手机适配；三种方案与对照已实现并验证。
- [[archive/task-0304-node-graph-spatial-presentation]]：implementation complete, verification pending；保留原有轴测网格、节点交互、空间关系与主 / 子图表现记录；浏览器验收待补，归档不代表验收完成。
- [[archive/task-0305-init-global-enhancement-node-graph-investigation]]：implementation complete；核对 Init / GlobalEnhancement 数据、揭示与命令边界后，已删除双面轮盘并改为单一轴测节点图谱 + 右侧独立工作台；节点 / 连线只作呈现，可见性、拥有、活动态与购买 / 进入 / 移除仍来自既有 RevealStage、只读投影与 GameCommands，未新增存档字段或图边授权规则。

2026-10-21 按请求将 Task 0302–0305 移入 `archive/`；正文末态保留，归档不改变完成或验收状态。

2026-10-19 已将 `docs/plan-work/` 根目录的 Gameplay B Task、Draft、Report 及拆分的 Patch Unit / Receipt 整批冻结归档；未完成事项保留原状态与待续范围，归档不代表结项。后续恢复时先核对当前源码与测试，再另立或更新活动 Task。

## 本轮冻结归档（2026-10-19）

### 冻结时仍有未完成事项

- [[archive/task-0287-gameplay-b-semantic-convergence-and-minimal-loop]]：总控阶段 C4 U4 当时施工中；C5 依赖 C4 验收。
- [[archive/task-0291-gameplay-b-hp-enemy-ability-item]]：U1—U3 已复核，U4 Workspace / 后续验收按原文保留；敌方固定伤害合同已由 Task 0301 的后续实现取代，续作前须核对。
- [[archive/task-0292-gameplay-b-c5-authoring-and-retirement]]：完整 C5 尚未开始，仍依赖 C4；保留默认包退役等已裁定范围。
- [[archive/task-0297-gameplay-b-unified-unit-cards]]：实现完成，浏览器视觉验收待做。
- [[archive/task-0298-gameplay-b-relations-hover-and-target-interaction]]：P0b、P5 / P6 与其余未完成验收项待续。
- [[archive/task-0299-gameplay-b-autonomous-action-target-strategy]]：产品规则已冻结，P0—P5 施工及 Workspace 验收尚未闭环。

### 已完成或保留为裁定 / 调查来源

- [[archive/task-0288-gameplay-b-map-node-vertical-slice]]、[[archive/task-0289-gameplay-b-maprun-state-and-encounter-lifecycle]]、[[archive/task-0290-gameplay-b-action-draw-hand-swap-commit]]、[[archive/task-0294-gameplay-b-three-column-button-ui]]、[[archive/task-0295-gameplay-b-basic-map-p0-p3]]：已完成阶段记录。
- [[archive/task-0296-gameplay-b-shared-talklet-flow]]：正文记录 U1—U6 自动化与 DOM 验收完成；旧索引的“待浏览器验收”状态已纠正。
- [[archive/task-0300-gameplay-b-reusable-card-interaction]]：正文标记 completed；P4 多目标与 P5 作用线仍作为后续独立范围，旧索引的 proposed 状态已纠正。
- [[archive/task-0301-gameplay-b-enemy-autonomous-action-cards]]：P0—P5 已完成；既有检查问题见其 U5c Receipt。
- [[archive/draft-0287-gameplay-b-phase-b-contract]]：已批准冻结的阶段 B 合同；[[archive/report-0287-gameplay-b-core-migration-investigation]]：阶段 A 只读调查报告。
- [[archive/draft-0293-gameplay-b-old-new-entry-ui-comparison]]、[[archive/draft-0294-gameplay-b-three-column-ui-first-step]]、[[archive/draft-0296-gameplay-b-and-chat-shared-render-pipeline]]：分别保留交接调查、已实施 UI 设计依据和共享呈现流调查草案；细节及原裁定以归档正文为准。

本批所有相关 Unit 与 Receipt 一并位于 `archive/` 下对应的 `task-*-units/` 或 `task-*-units/receipts/` 目录。

## 近期完成

- [[archive/task-0246-gameplay-b-unified-actor-card-interface]]：统一 Operation 角色持牌投影与 SceneAction / PlayerSceneCard 执行者分配、目标预览、拖放和键盘路径；保留三种牌源的 Runtime 费用与结算边界，定向测试、类型检查、机制文档和 GALHCG 闭环完成。
- [[archive/task-0247-gameplay-b-card-drag-target-and-semantic-audit]]：外部牌挂靠后以经典卡牌拖放选择合法目标、单击退出；全量核对 36 个 ActionDef 的语义、效果和目标，并修正已确认的内容错配。
- [[archive/task-0244-gameplay-b-demo-graph-map-near-complete-port]]：移植并接通 13 地点 Strategy Park 地图与 Office 入口，展示全图及分支/Gate/访问上限，保留三场经典 Operation 战斗并完成确定性无浏览器回放。
- [[archive/task-0243-gameplay-b-carousel-action-replacement-and-reentry]]：修复目标型备选行动的鼠标替换路径，并移除无重置规则的旋转木马重复战斗回路。
- [[archive/task-0242-gameplay-b-carousel-entry-and-scene-submit]]：修正正式旋转木马样例的 Hand/OperationView 投影不一致，增加受限返回战斗路线，标明流程阶段，并将现场行动收敛为一次确认提交。
- [[archive/task-0235-newcomer-oriented-project-code-review]]：完成 15 个并行 Patch Unit，按源码与测试证据修订架构、模块、数据、机制及六区 Wiki；建立从总入口可达的人类与 Agent 共用新人首读路线，并另立 EventBus P2 与架构检查 P3 修复 Task。
- [[archive/task-0233-mini-console-content-grants]]：为 Gameplay B 本地测试扩展严格三段式 `getValue modid:typeid:itemid [valueNum]`，支持 resource/chara/spot；定向测试、类型检查与浏览器验收通过。
- [[archive/task-0230-contacts-story-workspace-titlebar-convergence]]：通讯录与故事复用默认中栏等高标题区，以本地 SVG 返回键替代长文本并移除 eyebrow；定向测试与类型检查通过。
- [[archive/task-0229-unified-theme-contribution-and-background-rendering]]：统一主题来源、派生画布底层与渲染，提供面向编辑态 Datapack 主题的 owner-aware 预览和保存服务。
- [[archive/draft-0212-gameplay-b-ac-native-design-roadmap]]：Gameplay B V1 设计身份、规则裁定与阶段来源；实现以当前机制文档为准。
- [[archive/task-0222-gameplay-b-packaged-event-entry-and-end-to-end-slice]]：Gameplay B V1 从夏莱办公室固定阵容入口，经战斗、场景行动/玩家卡、路线、结局/奖励与 Save/Resume 完成端到端闭环。
- [[archive/task-0218-gameplay-b-causal-locations-and-route-selection]]：单一 Location 合同、路线选择/自动转场、持有物 Gate、有界回环、路线投影与固定样例。
- [[archive/task-0217-gameplay-b-objectives-and-partial-outcomes]]：闭合 Predicate、Location/Event 结局、heldItem Action 效果与目标进度投影。
- [[archive/task-0216-gameplay-b-command-loop-vertical-slice-ui]]：单地点核心切片与 OperationView 原型；其版式不是正式三栏 UI 规范。
- [[archive/task-0221-gameplay-b-authoring-and-content-validation-workflow]]：用正式游乐园 Datapack 验收 validate/apply/reload、无效引用保护和 `resumeVersion` 更新。
- [[archive/task-0219-gameplay-b-event-save-and-resume]]：主 SaveData 中保存并恢复有界 EventRun checkpoint、场景费用/卡组、待提交计划与随机流。
- [[archive/task-0220-gameplay-b-datapack-contracts-and-registry]]：Operation 四张 Datapack 表、Registry 引用校验、正式示例内容与 Schema 同步。
- [[archive/task-0228-theme-derived-background-unified-authoring]]：调查主题派生背景与自定义背景图层的模型、合并、渲染及编辑入口差异；后续实现另立 Task。
- [[archive/task-0227-init-theme-selector-only]]：Init 声明主题只用于外部选择页；游戏运行时不再应用 Init 的颜色、背景或 Presentation。
- [[archive/task-0226-ui-theme-color-only-inheritance]]：父子宿主不再回退复用父级背景图层，子级保留主题色作用域继承并使用自身默认表现。
- [[archive/task-0225-gameplay-b-finite-player-scene-card-deck]]：有限玩家场景牌组、独立派生初始牌序、地点抽牌与 hand→discard 原子结算。
- [[archive/task-0224-gameplay-b-scene-actions-and-route-cost]]：Individual/Global 场景批次、共享 PlayerCost、入场收益/离场上限与统一路线转场。
- [[archive/task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]：PreparedBeat、Intent、有限指挥与确定性结算；U1–U9 均已完成，2026-10-05 按 Task Owner 指示归档。
- [[archive/task-0214-gameplay-b-student-participation-and-autonomy]]：完成学生准入、Actor/Profile 快照及机制文档与 GALHCG 收尾。
- [[archive/task-0213-gameplay-b-event-runtime-and-session-state]]：EventRun 状态 owner、GameInstance 生命周期与机制文档/GALHCG 闭环完成；为 Task 0214 提供稳定 Runtime 基础。
- [[task-0223-ai-collaboration-docs-and-galhcg-discovery]]：整理 AI 协作文档入口及 GALHCG 查询、维护协议。
- [[task-0211-gameplay-b-cost-consumption-slot-preview]]：完成玩家 Cost 消耗槽的预览表现。
- [[task-0210-gameplay-b-player-cost-action-dock-meter]]：在 Action Dock 展示玩家 Cost 持有量。

各 Task 的验收证据和剩余事项以 Task 正文为准；更早的完成与归档状态留在对应归档文档，不在此重复维护。

## 本轮归档（2026-10-04）

- [[active-work-freeze-2026-10-04]]：冻结玩法 B 独立 Demo 与早期原型材料、GALHCG 内容维护 Draft，以及 RuntimeEditor 内容覆盖 Task；各项最后已知状态保留在原文。

## 归档与目录

- [[archive/active-work-freeze-2026-09-25]]：2026-09-25 冻结归档批次中工作文档的最后已知状态；不代表所有事项已完成。
- `archive/`：冻结的 Draft、Task、ADR 与其他过程材料。
- `mechanisms/`：从当前机制反查设计理由和历史来源的索引。
- `goalsets/`：可整组删除的目标与阶段讨论地图。

恢复历史方向时，回到原文重新核实并另立 Draft / ADR / Task；不要把归档文档直接恢复为当前计划。

## 当前机制事实

- [[docs/docs-829/00-INDEX]]：项目文档总入口。
- [[docs/docs-829/05-conventions/architecture-discipline]]：架构依赖与职责边界。
- [[docs/docs-829/05-conventions/doc-maintenance]]：文档分层、路由与归档规则。
- [[mechanisms/00-index]]：按机制组织的历史反向索引。
