# docs/plan-work — 当前计划与历史材料入口

状态：active — 本文维护当前推进项与必要路由。

> 本目录记录目标、裁定和阶段状态，不是当前机制事实源。系统现状以源码、测试和 [[docs/docs-829/00-INDEX]] 为准。

玩法目标与施工准入见 [[docs/ai/goal-workflow]]。可删除的 Goal Set 入口见 [[goalsets/README]]；正式 Draft、Task 与 ADR 建立在本目录根目录，并在下方登记。

## 当前推进

### 玩法 B 接入 AC：Runtime、角色自治与战术指挥

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]：玩法 B 接入 AC 的设计路线与分阶段提案。
- [[task-0216-gameplay-b-command-loop-vertical-slice-ui]]：单地点核心切片与 OperationView 原型；其版式不是正式三栏 UI 规范。

### 玩法 B 接入 AC：目标与结局机制（暂不扩展玩家 UI）

- [[task-0217-gameplay-b-objectives-and-partial-outcomes]]：事件目标、Runtime 结果与只读投影；不施工玩家交互 UI。

### 玩法 B 接入 AC：场景行为与玩家路线经济服务（暂不施工信息流交互）

- [[task-0224-gameplay-b-scene-actions-and-route-cost]]：Individual/Global 批次 API、共享 PlayerCost 与地点入场增量/离场携带上限。
- [[task-0225-gameplay-b-finite-player-scene-card-deck]]：有界玩家场景卡组服务、Seed 抽牌与跨地点牌区状态；交互表现延至 0222。

### 玩法 B 接入 AC：内容合同、续局与正式交付

- [[task-0220-gameplay-b-datapack-contracts-and-registry]]：事件内容的 Datapack / Registry 契约。
- [[task-0219-gameplay-b-event-save-and-resume]]：保存并恢复 EventRun、场景费用/卡组状态、待提交计划与随机流。
- [[task-0221-gameplay-b-authoring-and-content-validation-workflow]]：事件内容创建、诊断、加载与迭代流程。
- [[task-0222-gameplay-b-packaged-event-entry-and-end-to-end-slice]]：下一大型体验阶段；从夏莱办公室启动正式多地点事件，并设计我方/信息/敌方三栏和角色卡交互。

## 近期完成

- [[archive/task-0229-unified-theme-contribution-and-background-rendering]]：统一主题来源、派生画布底层与渲染，提供面向编辑态 Datapack 主题的 owner-aware 预览和保存服务。
- [[archive/task-0228-theme-derived-background-unified-authoring]]：调查主题派生背景与自定义背景图层的模型、合并、渲染及编辑入口差异；后续实现另立 Task。
- [[archive/task-0227-init-theme-selector-only]]：Init 声明主题只用于外部选择页；游戏运行时不再应用 Init 的颜色、背景或 Presentation。
- [[archive/task-0226-ui-theme-color-only-inheritance]]：父子宿主不再回退复用父级背景图层，子级保留主题色作用域继承并使用自身默认表现。
- [[archive/task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]：PreparedBeat、Intent、有限指挥与确定性结算；U1–U9 均已完成，2026-10-05 按 Task Owner 指示归档。
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]：单一 Location/Route 合同、持有物门槛、分支/有界回环、唯一转场入口与固定样例；Runtime/View/文档/GALHCG 闭环完成。
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
