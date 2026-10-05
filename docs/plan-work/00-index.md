# docs/plan-work — 当前计划与历史材料入口

状态：active — 本文维护当前推进项与必要路由。

> 本目录记录目标、裁定和阶段状态，不是当前机制事实源。系统现状以源码、测试和 [[docs/docs-829/00-INDEX]] 为准。

玩法目标与施工准入见 [[docs/ai/goal-workflow]]。可删除的 Goal Set 入口见 [[goalsets/README]]；正式 Draft、Task 与 ADR 建立在本目录根目录，并在下方登记。

## 当前推进

### 玩法 B 接入 AC：V1 已完成

- 玩法 B V1 的 Runtime、独立内容包、三栏入口、路线、玩家场景牌、结局、奖励和续局已完成；后续产品扩展另立 Task，不沿用已关闭 Task 的“下一阶段”描述。

### 玩法 B 原始 Demo：事实参考

- [[draft-0231-gameplay-b-original-demo-activity-and-battle-round]]：原始 `prototypes/gameplay-b/` 的非战斗场所批次与战斗回合，从三栏 UI、显示反馈、玩法到操作步骤逐项记录并附源码/测试索引；与 AC 移植版分开。
- [[draft-0231-b]]：已完成审阅并转制为 Task 0232；保留 Demo→AC 调查、候选方案与本轮取舍来源。

### 玩法 B Operation 卡牌交互

- [[task-0232]]：按用户偏好完成学生行动归属、场景批次卡片交互、中心结果流与路线摘要；U0–U3 实现、当前机制文档和 GALHCG 已分阶段提交。仍待 Edge 实际流程与现场键盘验收；Task 不包含原 Demo 真牌面 / 拖拽复刻。
- [[task-0234-gameplay-b-demo-card-surface]]：将 Operation 当前控件组重塑为原 Demo 式独立牌面、人物 / 场地牌层、叠放与合法目标关系交互；按钮外包卡片容器不算完成。保留现有 OperationView 与 Runtime 批次语义。

## 近期完成

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
