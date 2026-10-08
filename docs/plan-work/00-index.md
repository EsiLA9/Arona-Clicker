# docs/plan-work — 当前计划与历史材料入口

状态：active — 本文维护当前推进项与必要路由。

> 本目录记录目标、裁定和阶段状态，不是当前机制事实源。系统现状以源码、测试和 [[docs/docs-829/00-INDEX]] 为准。

玩法目标与施工准入见 [[docs/ai/goal-workflow]]。可删除的 Goal Set 入口见 [[goalsets/README]]；正式 Draft、Task 与 ADR 建立在本目录根目录，并在下方登记。

## 当前推进

### GALHCG 节点提取与职责聚合

- [[task-0250-galhcg-node-extraction-and-responsibility-aggregation]]：由 Luna 子代理提取 Operation/Workspace Renderer 的具体职责、聚合领域/Engine/UI 子分区并维护粒度协议；主代理复核映射守恒与查询验收。

### 玩法 B 接入 AC：V1 已完成

- 玩法 B V1 的 Runtime、独立内容包、三栏入口、路线、玩家场景牌、结局、奖励和续局已完成；后续产品扩展另立 Task，不沿用已关闭 Task 的“下一阶段”描述。

### Base 默认内容扩展：施工中

- [[task-0239-base-free-abydos-student-spot]]：在夏莱主厅增加免费手动领取 Spot，领取后通过一次性 Trigger 授予星野、芹香、白子；无 Gacha 随机性、无运行时机制改动。

### 玩法 B 原始 Demo：事实参考

- [[draft-0231-gameplay-b-original-demo-activity-and-battle-round]]：原始 `prototypes/gameplay-b/` 的非战斗场所批次与战斗回合，从三栏 UI、显示反馈、玩法到操作步骤逐项记录并附源码/测试索引；与 AC 移植版分开。
- [[draft-0231-b]]：已完成审阅并转制为 Task 0232；保留 Demo→AC 调查、候选方案与本轮取舍来源。

### 玩法 B Operation 卡牌交互

- [[task-0249-gameplay-b-operation-workspace-panels-and-map-popup]]：已实现经典三栏面板、右栏敌人/背景持有物切换、一次性流内地图卡片和默认关闭/可拖拽的大图浮窗；定向 UI 测试与类型检查通过，待人工视口检查布局和遮挡。

- [[task-0232]]：按用户偏好完成学生行动归属、场景批次卡片交互、中心结果流与路线摘要；U0–U3 实现、当前机制文档和 GALHCG 已分阶段提交。仍待 Edge 实际流程与现场键盘验收；Task 不包含原 Demo 真牌面 / 拖拽复刻。
- [[task-0234-gameplay-b-demo-card-surface]]：U0 检查入口、U1/U2 真牌面与目标交互均已完成并通过独立严格审查；U3 Edge 常规 / 窄窗口与现场键盘验收、最终 GALHCG 写后核验仍待完成。保留现有 OperationView 与 Runtime 批次语义。
- [[task-0236-gameplay-b-typed-action-cards-and-target-layers]]：调查并约束学生战术牌目标集合，改用人物右侧替代真牌层与拖放目标，整理 z 轴并在角色卡显示 HP / sCost；U0/U1 实现、独立严格审查与 IAB 常规 / 窄视口验收已完成，待 Edge 常规 / 窄视口实测后关闭。
- [[archive/task-0248-gameplay-b-scene-card-activation-progression-and-links]]：已实现 optional-student 场景牌、部分选择与空批次跳过、Cost 上限结算，以及按方位择边的卡牌关系线。
- [[task-0240-gameplay-b-operation-card-presentation-and-action-targeting]]：收敛 Operation 行动牌呈现与目标表达，隔离 SceneAction / 战斗候选；主要源码实现已落地，定向测试与浏览器验收待完成。
- [[archive/task-0245-gameplay-b-operation-scene-card-performer-target-cost-model]]：已完成 Operation 场景选项的免执行者/目标/费用分离、fixed/required 语义、内容文案投影和统一卡片表现；保留现有 Scene 批次语义，群体目标、M/N Offer、商店与编辑器体验留后续。
- [[archive/task-0241-gameplay-b-strategy-pools-and-interaction-context]]：已完成 Operation 角色倾向、CardPool 合并、角色 Hand 抽取、12 地点相似玩法实例与无浏览器 headless 虚拟回放；包括 Engine/D1/D2 证据与 GALHCG 闭环。

### Code Review 后续修复：待施工

- [[task-0237-event-bus-flush-exception-recovery]]：修复 EventBus 订阅者在 flush 中抛错后永久停止派发的问题，并定义剩余批次行为。
- [[task-0238-remove-stale-architecture-check-exemptions]]：清除架构检查器对两个已不存在 Engine 路径的整文件豁免。

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
