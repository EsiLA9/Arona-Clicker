# docs-830 与 GALHCG 概念覆盖调查

本文回答：当前新 Wiki 对 GALHCG 图中的机制概念覆盖到什么程度，后续哪些主题需要补页。

状态：已完成首轮节点盘点与 Wiki 建设后的复核；作为后续增补依据。

日期：2026-10-25。项目身份：`acprogram`；图修订：`42070`。

## 调查范围

GALHCG 汇总快照包含 24 个 Module、94 个 Concept。按完整分页枚举 Concept，并与当前 `docs/docs-830/` 页面逐项核对：88 个 lifecycle 为 `implemented`，5 个为 `historical`，1 个为 `unspecified`。历史节点不作为现行机制覆盖目标；未定状态的 Goal/Task 工作流属于协作流程，不属于基础游戏机制。

图的最近成功清单刷新时间为 2026-10-24，早于 docs-830 页面创建时间。因此本调查用图中概念、当前 Wiki 正文和源码做人工对照，没有用图内 `maps_to` 关系推断覆盖，也没有刷新或修改图。

## 结论

首轮建设后，docs-830 已扩展到 34 篇，涵盖系统/包生命周期、数据服务、通用 Engine、领域流程、UI 表现与工具链。按模块和 Concept 名称、摘要、关系逐项对照，**没有仍然整组缺页的现行模块簇**；88 个 implemented Concept 均能路由到 docs-830 页面，项目协作相关概念则链接到 `ai/guide/` 权威页。5 个 historical Concept 明确排除在当前机制 Wiki 外。

“有路由”不等于每个 Concept 都有独立长文。按机制说明深度判断，页面需说明职责、主要调用/数据流及关键边界；概念只在段落中出现时属于合并覆盖。当前整体结构已成形，但概念粒度的详细程度仍不均匀，尚不能称为 88 个 Concept 都有完整专项说明。

| 图中主题组 | 新 Wiki 页面 | 覆盖状态 |
| --- | --- | --- |
| 应用组合与 Registry | `01-architecture/`、`02-data-and-state/` | 包 I/O、定义来源层、作者策略、目录浏览、图片资源、存档与 Registry 均有说明 |
| Engine | `03-engine/`、`03-runtime/` | 事件/效果/Trigger/Affector、条件/可见性、Value/GameNum、Stats 与 Tick 已有成组页面 |
| 世界与状态 | `02-data-and-state/`、`05-domains/world-and-spots.md` | Init / Spot、状态写入、Information Reveal、Milestone 和 Runtime 世界内容协调已覆盖 |
| 角色与经济 | `05-domains/` | 抽卡、Roster、培养、好感、Gear、商店、物品、强化、PassivePool 已有流程说明 |
| 剧情、主题与表现 | `05-domains/story-and-effects.md`、`04-presentation/` | Story 推进、StoryContentTable、Effect 事件桥接、聊天/主题/实体表现已覆盖 |
| Map / Operation | `05-domains/maps-and-operations.md` 及两篇 Operation 专题 | Run、准入、保存恢复、行动规划、手牌/Scene、Route/Outcome、View 与 Observation 已有专题 |
| UI 与工具链 | `04-presentation/`、`07-tooling/` | Workspace、增量刷新、焦点/滚动、样式、编辑器、Schema、诊断与测试入口已覆盖 |
| 项目协作 | `ai/guide/` 链接 | Goal / Task、Read Set 与 GALHCG 查询仍由协作协议页负责，不在产品机制页重复 |

## 仍需细化的概念

- `CharacterSystem`、`ColorEquipmentSystem` 与 `ColorUnlockReactor` 已接入角色/主题页，但目前集中在短小段落，可在实际编写角色界面或表现需求时扩展。
- `ThemeContentEditorService`、`UserThemeService` 与 `OperationObservation` 已说明职责和所有权边界；编辑冲突、主题图层合成和 Observation 查询字段尚未拆成字段级参考。
- 部分广域页（如内容构建、Runtime 内容协调）解释了主路径；若后续要改变其合同，再按具体流程补充示例和失败语义。

这些是专题深度的后续扩展项，不影响从索引定位当前机制的主路径。历史节点仍按原归档保留；Goal Workflow 与项目地图协作概念由 `ai/guide/goal-workflow.md`、`task-read-set-routing.md` 和 `galhcg-project-map.md` 提供入口。

后续按需求深化时，继续按职责与协作链合并相邻 Concept，不按节点机械地一概一页。完整图节点清单以 GALHCG 当前项目查询结果为准。
