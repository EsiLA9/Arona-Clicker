# docs/plan-work — 当前计划与历史材料入口

状态：active — 本文维护当前推进项与必要路由。

> 本目录记录目标、裁定和阶段状态，不是当前机制事实源。系统现状以源码、测试和 [[docs/docs-829/00-INDEX]] 为准。

玩法目标与施工准入见 [[docs/ai/goal-workflow]]。可删除的 Goal Set 入口见 [[goalsets/README]]；正式 Draft、Task 与 ADR 建立在本目录根目录，并在下方登记。

## 当前推进

### 玩法 B 接入 AC：运行时基础与核心指挥循环

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]：玩法 B 接入 AC 的设计路线与分阶段提案。
- [[task-0213-gameplay-b-event-runtime-and-session-state]]：EventRun / EventState 生命周期与状态归属。
- [[task-0214-gameplay-b-student-participation-and-autonomy]]：连接角色身份与局内 Actor/Profile，形成可解释的学生自主行动。
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]：PreparedBeat、Intent、有限指挥与确定性结算。
- [[task-0216-gameplay-b-command-loop-vertical-slice-ui]]：核心可玩切片与只读 OperationView。

### 玩法 B 接入 AC：目标结局、多地点与产品化

- [[task-0217-gameplay-b-objectives-and-partial-outcomes]]：事件目标及成功、部分成功、失败结局。
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]：多地点因果路线与路线选择。
- [[task-0219-gameplay-b-event-save-and-resume]]：保存并恢复 EventRun、待提交计划与随机流。
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]：事件内容的 Datapack / Registry 契约。
- [[task-0221-gameplay-b-authoring-and-content-validation-workflow]]：事件内容创建、诊断、加载与迭代流程。
- [[task-0222-gameplay-b-packaged-event-entry-and-end-to-end-slice]]：正式玩家入口与端到端产品切片。

## 近期完成

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
