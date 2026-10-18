# docs/plan-work — 当前计划与历史材料入口

状态：active — 本文维护当前推进项与必要路由。

> 本目录记录目标、裁定和阶段状态，不是当前机制事实源。系统现状以源码、测试和 [[docs/docs-829/00-INDEX]] 为准。

玩法目标与施工准入见 [[docs/ai/goal-workflow]]。可删除的 Goal Set 入口见 [[goalsets/README]]；正式 Draft、Task 与 ADR 建立在本目录根目录，并在下方登记。

## 当前推进

### 基础地图玩法 P0—P3（completed，2026-10-18）

- [[docs/plan-work/task-0295-gameplay-b-basic-map-p0-p3]]：线性战斗不变量核验 → 单 Node 固定顺序 Battle / Rest / Shop → 单向分叉汇合 → 连续遭遇与条件 Edge。四阶段均已附实际修改、正式 Datapack 样例、可复现命令与结果；P0 未做无关重构，P1—P3 收敛在既有 Map / Node / Activity / Shop / Edge Condition 语义内。另补充 `mapEntryLabel` 作者文案，默认包 6 个地图入口均改为可辨识的“进入 XXX”。引擎 14 项、入口文案 6 项、UI 4 项新增验收与既有 Map 回归通过；未做浏览器人工验收，未运行全量测试，旧 Strategy Park 有 3 项与本 Task 无关的既有失败。

### 当前总控 Task（阶段 A / B / C1 / C1a / C2 / C3、C4 U1–U3 完成；C4 U4 施工中；C5 合同已预备）

- [[task-0287-gameplay-b-semantic-convergence-and-minimal-loop]]：Gameplay B 最终语义收敛、数据结构迁移与最小玩法闭环总控 Task；阶段 A / B / C1 / C1a / C2 / C3、C4 U1–U3 已完成并经主控独立复核；C4 U4 战斗 Workspace 施工中；C5 合同已预备，依赖 C4 验收。
- [[task-0288-gameplay-b-map-node-vertical-slice]]：执行并完成 C1 / C1a；通过正常 Datapack / Registry / Resolver / Spot 入口实现 Map A→B→遭遇→回到 B→C 的最小竖切片。旧 Operation 内容仍留在定向测试夹具，但已从默认 Gameplay B bundle 移除。
- [[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle]]：C2 已完成：固定队伍准入、MapRun 初始 PlayerCost、checkpoint、成功回图与成功终态清理；失败触发与结果 UI 已冻结，待 C4 接入真实 HP。
- [[task-0290-gameplay-b-action-draw-hand-swap-commit]]：执行 C3 Character Hand、Prepared Action、免费 Swap、PlayerCost Command、唯一整轮 Commit 与 MapRun-local Action resource 效果；C3 已完成并通过复核，作为归档实施记录保留。
- [[task-0291-gameplay-b-hp-enemy-ability-item]]：C4 战斗 HP、Enemy、Ability / Item 与失败结算执行合同；默认规则已于 2026-10-18 冻结，U1–U3 已经主控独立验收，U4 Workspace 与失败结果 UI 施工中。
- [[task-0292-gameplay-b-c5-authoring-and-retirement]]：C5 作者入口、Rest / Shop / Edge Branch 样例、Gameplay B 内容重建与旧专属 Operation 退役执行合同；负责人已裁定默认包立即切为 Map-only、旧 Strategy Park bundle 退役，旧 Run 可直接失效并在后续存档时清除，保留长期 PlayerState；其余完整 C5 施工仍依赖 C4 完成及独立复核。
- [[report-0287-gameplay-b-core-migration-investigation]]：只读核对当前 Datapack/Registry、Operation Runtime、三个状态生命周期、UI/样例/存档/测试；附阶段 B 待裁定项与 C1a 早期端到端建议。
- [[draft-0287-gameplay-b-phase-b-contract]]：阶段 B 最终合同；Hand / Swap 与 Map / Encounter / 状态 / 内容 / Save-Resume 规则均已获负责人冻结，作为 C 阶段实施验收依据。
- [[draft-0293-gameplay-b-old-new-entry-ui-comparison]]：Gameplay B 旧 Operation 与新 Map 移植的入口链、当前默认包状态，以及旧三栏 UI 可复用结构与不可复用语义的交接对照。
- [[docs/plan-work/draft-0294-gameplay-b-three-column-ui-first-step]]：负责人确定左我方／中 Talk 式信息流／右敌方与背景、仅按钮、内部滚动与外部统一顶部分割；保留 Luna 参考调查、起始到存档最小承接和第一步方案依据。
- [[docs/plan-work/task-0294-gameplay-b-three-column-button-ui]]：第一阶段已完成三栏按钮 UI、统一顶部／内部滚动、跨栏稳定更新与起始到保存链路验证；记录定向测试、独立审查、桌面与窄屏浏览器结果及后续边界。
- [[docs/plan-work/draft-0296-gameplay-b-and-chat-shared-render-pipeline]]：普通 Chat 与 Gameplay B 信息流的现状调查和共享管线设计来源；现行施工裁定见 Task 0296。
- [[docs/plan-work/task-0296-gameplay-b-shared-talklet-flow]]：implemented（待浏览器验收）；U1—U5 已落地共享条目／reducer／按流实例滚动与 Map 接入（含只读「查看情报」），定向测试与类型／架构／文档检查通过；桌面浏览器验收与既有 Chat/Story Workspace 漂移待后续。

### 本轮归档（2026-10-17）

- 其他根目录 Draft / Report / Task 和已完成 Goal Set 已移入 `archive/`；保留各文档原有状态。归档不代表未完成 Task 已验收或结项。
- [[archive/task-0280-gameplay-b-scene-composition-p1-mixed-scene-ui]]：冻结时仍待人工验收，原剩余事项不变。
- [[archive/task-0285-gameplay-b-core-semantics-reduction-investigation]]、[[archive/report-0285-gameplay-b-core-semantics-reduction]]：只读实现调查与语义复杂度报告，供新 Task 重新核实。
- [[archive/task-0286-gameplay-b-minimal-semantic-target]]、[[archive/report-0286-gameplay-b-minimal-semantic-ruling]]：已完成的最小语义探索；其推荐值可在新 Task 阶段 B 复核。
- 其他 Gameplay B 与 Super Codex 计划及 Goal Set 见下方相应历史索引；本 Task 是唯一当前计划入口。

### 本轮完成（2026-10-15）

- [[archive/task-0282-super-codex-phase-a-reliable-relations]]：阶段 A 可靠引用语义、反向跳转、真实包与缓存边界验收完成；定向数据／Runtime回归29项通过。
- [[archive/task-0283-super-codex-phase-b-friendly-workspace]]：阶段 B 中文图鉴、资料／被引用／技术详情、共享框架与连续导航验收完成；UI／Frame五文件62项通过，桌面1440×900浏览器验收完成。
- [[archive/handoff-0282-0283-super-codex-2026-10-15]]：保留初始交接检查点与最终验收结果；窄屏按用户要求排除在本轮范围。
- [[archive/draft-0282-super-codex-and-authoring-workspace]]：A/B已完成；保留阶段 C 编辑器迁入及阶段 D 扩充的设计来源。

### 已归档未结项（归档时状态：2026-10-09）

- [[archive/task-0280-gameplay-b-scene-composition-p1-mixed-scene-ui]]：Gameplay B 混合 Scene UI、正式 Rest 演示与 Atomic Scene 调查语义修订已完成代码和 Headless 检查；归档时为 **代码待人工验收（Pending Manual Acceptance）**，等待 M01–M08 和视觉/交互检查反馈。

### 已归档讨论材料

- [[archive/draft-0284-gameplay-b-current-system-and-improvement-discussion]]：用通俗语言梳理玩法 B 当前的数据结构、游玩循环、角色行动候选、玩家场景卡组、结算与复杂度，供 SolChat 提出综合改进方案；作为历史讨论材料保存。

### 本轮完成（2026-10-13）

- [[archive/task-0281-exclusive-theme-selection]]：普通游戏页改为单一完整主题选择；场景默认、玩家收集主题与用户主题互斥生效，保留通用堆叠算法。定向回归、类型、文档和架构检查通过。

- [[archive/task-0279-gameplay-b-scene-pending-action-default]]：将 Atomic “检查故障设备”标为 fixed SceneAction，使空选择 Commit 自动解析行动与 Ride 目标；修正显式 Skip 绕过固定行动，补充 Engine / UI 回归。33 项定向测试、类型、文档和 GALHCG 检查通过；未做浏览器回放。
- [[archive/task-0278-gameplay-b-unbounded-loop-and-character-autonomy]]：完成无上限循环、角色自动战斗计划、单槽干预与 selectable SceneAction 首选合法目标；U1–U8 已验收。U1–U7 为 15 个定向测试文件、230 项通过；U8 为 4 个 Engine / UI 文件、61 项通过；类型、文档和 GALHCG 检查通过。未做浏览器回放。
- [[archive/task-0277-gameplay-b-three-column-workspace-unification]]：统一 Operation 三栏标题与分割线层级；修复替代行动重复点击收起；补充玩家手牌激活样式；移除执行者旧标记；同场景多行动牌默认铺开并响应式换行。42 项定向 UI 测试、类型检查及桌面/窄屏浏览器验收通过。

### 玩法 B 原子化场景重构

Goal Set：`gs-20261008-gameplay-b-atomic-scenes`（已整体移至 `docs/plan-work/archive/goalsets/`）。G01～G05 均已完成；玩法 B 原子场景重构的 PB-01～PB-26 已完成并归档。

- **G01：V1 可读、可玩（completed）** — [[archive/draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]；[[archive/task-0251-pb-01-runtime-combat-stage-projection]]、[[archive/task-0252-pb-02-event-correct-operation-copy]]、[[archive/task-0253-pb-03-cost-balance-slot-projection]]、[[archive/task-0254-pb-04-readable-operation-state-names]]、[[archive/task-0255-pb-05-actor-position-and-action-eligibility]]。
- **G02：操作语义统一（completed）** — [[archive/draft-0252-gameplay-b-atomic-scenes-phase-ii-operation-semantics]]；[[archive/task-0256-pb-06-card-selection-states]]、[[archive/task-0257-pb-07-click-performer-assignment]]、[[archive/task-0258-pb-08-target-selection-and-count-validation]]、[[archive/task-0259-pb-09-reversible-local-action-plans]]、[[archive/task-0260-pb-10-legality-and-cost-preview]]、[[archive/task-0261-pb-11-confirm-return-and-skip]]、[[archive/task-0262-pb-12-operation-result-timeline]]。
- **G03：原子场景骨架（completed）** — [[archive/draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation]]；[[archive/task-0263-pb-13-scene-identity-lifecycle]]、[[archive/task-0264-pb-14-scene-content-presentation]]、[[archive/task-0265-pb-15-action-offer-projection]]、[[archive/task-0266-pb-16-scene-plan-preview]]、[[archive/task-0267-pb-17-scene-atomic-resolution]]、[[archive/task-0268-pb-18-scene-completion-location-exit]]。
- **G04：真实玩法迁移（completed）** — [[archive/draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]]；[[archive/task-0269-pb-19-carousel-sample-migration]]、[[archive/task-0270-pb-20-strategy-park-battle-migration]]、[[archive/task-0271-pb-21-location-exploration-migration]]、[[archive/task-0272-pb-22-multiple-scenes-per-location]]、[[archive/task-0273-pb-23-group-and-position-targets]]、[[archive/task-0274-pb-24-m-of-n-and-temporary-shop]]。
- **G05：内容作者交付（completed）** — [[archive/draft-0255-gameplay-b-atomic-scenes-phase-v-authoring]]；[[archive/task-0275-pb-25-scene-authoring-and-validation]]、[[archive/task-0276-pb-26-remove-legacy-special-cases-and-regression]]。
- **Goal Owner 统一裁定 / 一次性背景卷** — [[archive/draft-0256-gameplay-b-atomic-scenes-task-rulings]]；2026-10-08 默认规则是当时 PB-01～PB-26 的施工依据，现保留为历史记录；后续方向由 Task 0287 重新裁定。

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
