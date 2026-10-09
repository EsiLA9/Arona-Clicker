# docs/plan-work — 当前计划与历史材料入口

状态：active — 本文维护当前推进项与必要路由。

> 本目录记录目标、裁定和阶段状态，不是当前机制事实源。系统现状以源码、测试和 [[docs/docs-829/00-INDEX]] 为准。

玩法目标与施工准入见 [[docs/ai/goal-workflow]]。可删除的 Goal Set 入口见 [[goalsets/README]]；正式 Draft、Task 与 ADR 建立在本目录根目录，并在下方登记。

## 当前推进

### 当前执行（2026-10-09）

无。

### 本轮完成（2026-10-09）

- [[archive/task-0279-gameplay-b-scene-pending-action-default]]：将 Atomic “检查故障设备”标为 fixed SceneAction，使空选择 Commit 自动解析行动与 Ride 目标；修正显式 Skip 绕过固定行动，补充 Engine / UI 回归。33 项定向测试、类型、文档和 GALHCG 检查通过；未做浏览器回放。
- [[archive/task-0278-gameplay-b-unbounded-loop-and-character-autonomy]]：完成无上限循环、角色自动战斗计划、单槽干预与 selectable SceneAction 首选合法目标；U1–U8 已验收。U1–U7 为 15 个定向测试文件、230 项通过；U8 为 4 个 Engine / UI 文件、61 项通过；类型、文档和 GALHCG 检查通过。未做浏览器回放。
- [[archive/task-0277-gameplay-b-three-column-workspace-unification]]：统一 Operation 三栏标题与分割线层级；修复替代行动重复点击收起；补充玩家手牌激活样式；移除执行者旧标记；同场景多行动牌默认铺开并响应式换行。42 项定向 UI 测试、类型检查及桌面/窄屏浏览器验收通过。

### 玩法 B 原子化场景重构

Goal Set：`gs-20261008-gameplay-b-atomic-scenes`（阶段导航位于 `docs/plan-work/goalsets/`；正式 Draft / Task 可独立阅读）。G01～G05 均已完成；玩法 B 原子场景重构的 PB-01～PB-26 已完成并归档。

- **G01：V1 可读、可玩（completed）** — [[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]；[[archive/task-0251-pb-01-runtime-combat-stage-projection]]、[[archive/task-0252-pb-02-event-correct-operation-copy]]、[[archive/task-0253-pb-03-cost-balance-slot-projection]]、[[archive/task-0254-pb-04-readable-operation-state-names]]、[[archive/task-0255-pb-05-actor-position-and-action-eligibility]]。
- **G02：操作语义统一（completed）** — [[archive/draft-0252-gameplay-b-atomic-scenes-phase-ii-operation-semantics]]；[[archive/task-0256-pb-06-card-selection-states]]、[[archive/task-0257-pb-07-click-performer-assignment]]、[[archive/task-0258-pb-08-target-selection-and-count-validation]]、[[archive/task-0259-pb-09-reversible-local-action-plans]]、[[archive/task-0260-pb-10-legality-and-cost-preview]]、[[archive/task-0261-pb-11-confirm-return-and-skip]]、[[archive/task-0262-pb-12-operation-result-timeline]]。
- **G03：原子场景骨架（completed）** — [[archive/draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation]]；[[archive/task-0263-pb-13-scene-identity-lifecycle]]、[[archive/task-0264-pb-14-scene-content-presentation]]、[[archive/task-0265-pb-15-action-offer-projection]]、[[archive/task-0266-pb-16-scene-plan-preview]]、[[archive/task-0267-pb-17-scene-atomic-resolution]]、[[archive/task-0268-pb-18-scene-completion-location-exit]]。
- **G04：真实玩法迁移（completed）** — [[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]]；[[archive/task-0269-pb-19-carousel-sample-migration]]、[[archive/task-0270-pb-20-strategy-park-battle-migration]]、[[archive/task-0271-pb-21-location-exploration-migration]]、[[archive/task-0272-pb-22-multiple-scenes-per-location]]、[[archive/task-0273-pb-23-group-and-position-targets]]、[[archive/task-0274-pb-24-m-of-n-and-temporary-shop]]。
- **G05：内容作者交付（completed）** — [[draft-0255-gameplay-b-atomic-scenes-phase-v-authoring]]；[[archive/task-0275-pb-25-scene-authoring-and-validation]]、[[archive/task-0276-pb-26-remove-legacy-special-cases-and-regression]]。
- **Goal Owner 统一裁定 / 一次性背景卷** — [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；2026-10-08 默认规则作为 PB-01～PB-26 当前施工依据，四项升级条件除外；五份阶段 Draft 与各 Task 的历史“待裁定”措辞以该文裁定为准。

### 本轮冻结归档（2026-10-08）

- [[archive/active-work-freeze-2026-10-08-gameplay-b-atomic-scenes]]：冻结根目录原有全部活动 Draft / Task，逐项保留冻结时的最后已知状态；未完成验收不因移入 `archive/` 而关闭。

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
