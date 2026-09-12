# docs/0x-plan&work — 计划、路线图与工作记录总入口

> 本目录是项目所有计划、Roadmap、ADR、方案草稿与 Code Review 工作的唯一入口。
> 代码与机制文档仍以 `src/`、`docs/docs-828/01-05` 为准；本目录只管理决策、工作范围、状态和后续行动。

## 当前状态

| 状态 | 含义 | 当前内容 |
| --- | --- | --- |
| ✅ 已完成 | 设计或施工已经完成，文档作为决策/历史记录保留 | 架构整理、GameNum、文档重构、引擎领域内聚、好感、色彩系统 |
| 🟡 进行中 | 已有部分实现或准备工作，仍有明确未完成切片 | Datapack 多包管理、Code Review |
| 🔵 待裁定 | 有目标和设计草案，但尚未形成最终 ADR | Spot 商店、卡池模型、角色拥有体系 |

## 当前整理任务

| 任务 | 目标 | 状态 |
| --- | --- | --- |
| [[docs/0x-plan&work/active/task-0023-project-documentation-normalization]] | 文档职责收敛、机制文件夹建立、逐篇核验与失效链接清理 | 🟡 进行中 |
| [[docs/0x-plan&work/active/roadmap-0024-lobby-pre-init-runtime]] | 未进入 Init 时的 Lobby Runtime 与通用界面服务 | 🟡 收尾验收 |
| [[docs/0x-plan&work/active/task-0025-selector-dynamic-theme]] | Init / GlobalEnh 选择页动态主题与 Init 状态背景 | ✅ 首版已实施并验证，体验项另列 |
| [[docs/0x-plan&work/active/task-0028-presentation-target-inherit-only]] | 新建表现目标在未编辑前保持原有默认外观 | ✅ 已完成 |
| [[docs/0x-plan&work/active/task-0029-button-sequence-rendering-audit]] | 按钮序列表现链路对照审查 | ✅ 调查完成 |
| [[docs/0x-plan&work/active/task-0030-button-rendering-convergence-solution]] | 按钮主题渲染统一与形状参数编辑方案 | 🟡 部分实施：形状参数编辑已落地 |
| [[docs/0x-plan&work/active/task-0031-svg-button-state-color-audit]] | 按钮内 SVG 状态颜色链路审查 | ✅ 已实施并验证 |
| [[docs/0x-plan&work/active/task-0032-passive-story-scheduling]] | PassiveStory P0/P1 与 Pool 分层权重 | 🟡 已裁定，待施工 |
| [[docs/0x-plan&work/active/task-0033-system-color-layer-scope]] | 控件系统颜色层职责收敛与重复背景清理 | 🟡 规划完成，待施工 |
| [[docs/0x-plan&work/active/task-0034-affector-performance-review]] | Affector / GameNum 性能判别与整改排序 | 🟡 静态核验完成，待施工 |
| [[docs/0x-plan&work/active/task-0035-condition-presentation-tree]] | Condition Presentation Tree 条件展示树 | 🟡 方案核验完成，待施工 |
| [[docs/0x-plan&work/active/task-0039-spot-shop-transaction-system]] | Spot 商店与通用交易系统 | 🔵 设计待裁定，尚未施工 |
| [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]] | 统一三栏工作区物理骨架与表现接线 | 🔵 规划完成，待施工 |
| [[docs/0x-plan&work/active/task-0041-character-progression-and-memory]] | 角色成长与记忆体系：Proto/Variant 边界、统一 Effect 投影、跨 Init 追赶 | 🟢 A 段已实施，B 段推迟（见 [[docs/0x-plan&work/active/adr-0008-character-progression-boundaries]]） |
| [[docs/0x-plan&work/active/task-0042-character-workspace-ui-convergence]] | 通讯录学生 Workspace 与一般游戏态 / 商店态 UI 风格收敛 | ✅ 已完成 |
| [[docs/0x-plan&work/active/task-0043-topbar-settings-workspace]] | 顶栏导航与设置 Workspace 统一管理 | ✅ 已完成 |
| [[docs/0x-plan&work/completed/task-0044-ui-geometry-workspace-reshape]] | UI Geometry Contract、Workspace Frame 与视觉基础设施重塑 | ✅ 已完成 |
| [[docs/0x-plan&work/active/task-0045-ui-incremental-update-workspace-isolation]] | UI 增量更新与 Workspace 隔离第一施工片段 | ✅ P0–P4 完成 |
| [[docs/0x-plan&work/active/task-0046-init-lifecycle-boundaries]] | Init 生命周期边界与运行时重建 | 🟢 P0/P1 完成；P2 延期 |
| [[docs/0x-plan&work/active/adr-0009-init-lifecycle-boundaries]] | Init 生命周期边界与运行时重建裁定 | 🟢 P0/P1 已实施；P2 延期 |
| [[docs/0x-plan&work/active/task-0047-contacts-story-workspace-ownership]] | 通讯录 / 故事独立 Workspace 所有权与路由迁移 | 🟢 Contacts / Story 核心迁移完成；通用 Region 与 Character 兼容清理后续收口 |
| [[docs/0x-plan&work/active/adr-0008-character-progression-boundaries]] | 角色成长体系边界与 A 段状态骨架（C0 九项收口；B 段投影/追赶/Chara-Spot 推迟） | 🟢 A 段已实施（133 文件/1248 测试绿） |

机制正文已从 `docs/docs-828/04-algorithms` 迁移到 `docs/docs-828/04-mechanisms`；旧目录仅保留迁移说明。

## 按机制阅读

计划文档原位按生命周期存放；若需要按功能机制连续阅读，请从 [[docs/0x-plan&work/mechanisms/00-index]] 进入。该层只聚合链接，不复制计划正文或改变 active/completed/docs/newPlan 状态。

## 已完成

| 文件 | 内容 | 状态 |
| --- | --- | --- |
| [[docs/0x-plan&work/completed/adr-0001-architecture-consolidation]] | T1-T7 架构整理 | ✅ 已完成 |
| [[docs/0x-plan&work/completed/adr-0002-gamenum-tree]] | GameNum 生产树与 Affector 修复 | ✅ 已完成 |
| [[docs/0x-plan&work/completed/adr-0003-docs-restructure]] | docs-824 → docs/docs-828 文档体系重构 | ✅ 已完成 |
| [[docs/0x-plan&work/completed/adr-0005-engine-domain-boundaries]] | 基础引擎与 AronaClicker 领域内聚决策 | ✅ 已完成 |
| [[docs/0x-plan&work/completed/roadmap-0005-engine-domain-consolidation]] | 引擎/数据服务/领域层/UI 内聚施工记录 | ✅ 已完成 |
| [[docs/0x-plan&work/completed/affection-planning]] | 好感数值、台阶剧情、羁绊尾巴 | ✅ 已实现 |
| [[docs/0x-plan&work/completed/color-system-plan]] | ColorGroup / ColorEquipment 系统 | ✅ 已实现 |
| [[docs/0x-plan&work/completed/roadmap-overview-history]] | 原 Roadmap 总览 | 📦 已归档，由本文取代 |

### 已完成但待归档的活动路线

以下文档已经完成主要施工，但仍保留在 `active/` 记录渐进迁移或后续非阻塞清理；在归档前不得把它们当作未实施方案：

| 文件 | 当前状态 | 保留原因 |
| --- | --- | --- |
| [[docs/0x-plan&work/active/roadmap-0008-theme-color-system-refactor]] | ✅ 主要目标已完成 | 保留 CSS 渐进迁移记录 |
| [[docs/0x-plan&work/active/roadmap-0013-presentation-editor-ux]] | ✅ E0–E5 已完成首版 | 保留既存 UI 环境限制与后续增强 |
| [[docs/0x-plan&work/active/task-0025-selector-dynamic-theme]] | ✅ 首版已实施并验证 | 保留专项复核、背景预览、动态开关与归档整理 |
| [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]] | 🟡 H0–H2 完成，H3/H4 未完成 | 服务工作区宿主仍在施工 |

## 未完成：按语义分组

### 数据包生态

- [[docs/0x-plan&work/active/adr-0004-datapack-management]]：多包读取、启用集、惰性存档和包管理决策权威。
- [[docs/0x-plan&work/active/roadmap-0001-datapack-management]]：对应实现切片与状态追踪。
- [[docs/0x-plan&work/registry&saves/00-index]]：Registry、启用集与多包存档的完整施工计划。

当前重点：完成跨包启用集统一校验与正式应用回滚边界，再实现惰性存档和通用残留管理；包库快照恢复接线已完成。

### 世界经营玩法

- [[docs/0x-plan&work/active/roadmap-0002-spot-shop]]：Spot 商店、货架发现与购买集。

当前状态：待设计裁定，尚无独立 ADR。

### 招募与角色成长

- [[docs/0x-plan&work/active/roadmap-0003-gacha-pool-model]]：Banner 与角色候选池解耦。
- [[docs/0x-plan&work/active/roadmap-0004-chara-ownership]]：角色拥有体系 Init 化与追赶统计。
- [[docs/0x-plan&work/active/task-0041-character-progression-and-memory]]：把 RosterEntry/培养/好感/色彩装备提升为统一角色成长领域，并新增跨世界线 CharacterMemory 追赶；是 roadmap-0004 归属翻转的配套答案（其 C0-2 依赖 0004 裁定）。
- [[docs/0x-plan&work/active/adr-0008-character-progression-boundaries]]：0041 的 C0 裁定与分段（A 段状态/记忆骨架可施工；B 段投影/追赶/Chara-Spot 推迟，强依赖 roadmap-0004 与 S1c）。

上述角色域目标应联合裁定，因为池候选、拥有状态、养成进度和跨世界线统计互相影响。

### 全量理解与审查

- [[docs/0x-plan&work/review/code-review-roadmap]]：按数据、数值、写入、领域、UI、Datapack 顺序完成全量 Review。

- [[docs/0x-plan&work/active/task-0034-affector-performance-review]]：记录 Affector → ConditionDepIndex → GameNum/flow → Tick 性能审查的逐条真实性与紧迫性判定。

- [[docs/0x-plan&work/active/task-0035-condition-presentation-tree]]：记录条件展示树建议的逐条真实性、可行性与 UI 施工边界。

当前状态：路线已建立，但检查清单尚未全部打勾；应以当前源码路径重新执行，而不是沿用旧目录假设。

### UI 表现层

- [[docs/0x-plan&work/active/roadmap-0006-ui-background-layering]]：背景图片、渐变与 SVG 装饰叠层服务。
- [[docs/0x-plan&work/active/adr-0006-ui-background-layering]]：背景层数据结构、合并规则与安全边界裁定。
- [[docs/0x-plan&work/active/roadmap-0008-theme-color-system-refactor]]：主题色双轨、语义节点、UI 作用域继承与颜色迁移。
- [[docs/0x-plan&work/active/roadmap-0009-theme-control-backgrounds]]：按钮与控件的多背景层、定位、状态和作用域继承。
- [[docs/0x-plan&work/active/roadmap-0010-presentation-layer-service]]：统一表现层服务、系统颜色层排序与来源模型。
- [[docs/0x-plan&work/active/roadmap-0011-ui-component-layer-backgrounds]]：将背景图层服务扩展到面板、按钮、Tab、卡片、气泡与弹窗。
- [[docs/0x-plan&work/active/roadmap-0012-flat-presentation-targets]]：平级表现目标、级别筛选弹窗与统一图层编辑器。
- [[docs/0x-plan&work/active/roadmap-0013-presentation-editor-ux]]：自定义表现控件编辑器体验、目标卡片与颜色/图片变换参数（E0-E5 已完成，保留全量 UI 测试环境问题）。
- [[docs/0x-plan&work/active/roadmap-0014-theme-editor-convergence]]：主题编辑器信息架构、表现模型收束、来源可视化与预览画布重构（P0-P2 首版完成，P3-P4 待实施）。
- [[docs/0x-plan&work/active/roadmap-0015-ui-dom-recalculation]]：正常游玩过程 DOM 重算收敛，区分局部更新与必要结构刷新（✅ 首版已实施，保留后续专项回归）。
- [[docs/0x-plan&work/active/roadmap-0016-cluster-region-context-overrides]]：簇默认与当前区域状态覆盖，统一三栏宿主表现关系（🟡 首版已实施，P2 验收收尾）。
- [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]]：UI Host Registry、服务面板自动表现接入与主题编辑器发现机制（🟡 首版已接入，完整服务发现与验收待补）。
- [[docs/0x-plan&work/active/roadmap-0020-service-workspaces]]：存档、数据包、图鉴与统计服务工作区交互目标（🟡 工作区首版已接入，存档/统计/图鉴/完整失败恢复待补）。
- [[docs/0x-plan&work/active/roadmap-0024-lobby-pre-init-runtime]]：Lobby/Pre-Init Runtime、Init 选择与通用界面服务（🟡 运行时已落地，文档/浏览器验收收尾）。
- [[docs/0x-plan&work/active/task-0025-selector-dynamic-theme]]：Init / GlobalEnh 选择页动态主题、轮盘聚焦背景与 Init 返回状态表现（✅ 首版已实施并验证，体验项另列）。
- [[docs/0x-plan&work/active/roadmap-0026-presentation-inset-decoration]]：表现宿主删除外部包线，改用数据驱动的内嵌装饰线（✅ 已实施）。
- [[docs/0x-plan&work/active/task-0027-theme-switch-cleanup-and-user-theme-isolation]]：主题切换遗留清理与用户自定义主题独立选择（✅ 已实施）。
- [[docs/0x-plan&work/active/task-0029-button-sequence-rendering-audit]]：按钮序列表现链路对照审查（✅ 调查完成）。
- [[docs/0x-plan&work/active/task-0030-button-rendering-convergence-solution]]：按钮主题渲染统一与形状参数编辑方案（🟡 部分实施：形状参数编辑已落地）。
- [[docs/0x-plan&work/active/task-0031-svg-button-state-color-audit]]：按钮内 SVG 状态颜色链路审查（✅ 已实施并验证；全量检查受既有基线问题影响）。
- [[docs/0x-plan&work/active/task-0033-system-color-layer-scope]]：控件系统颜色层职责收敛、隐式重复背景清理与全局开关解耦（🟡 规划完成，待施工）。
- [[docs/0x-plan&work/completed/task-0044-ui-geometry-workspace-reshape]]：Workspace Frame 几何契约、Panel/Region/Host 边界、滚动与响应式收敛（✅ 已完成）。
- [[docs/0x-plan&work/completed/roadmap-0019-presentation-text-color]]：表现宿主文字颜色统一、四态解析与验收（✅ 已完成）。

当前状态：B0–B4 的运行时、字段映射与编辑器接入已完成；剩余专用可视化预览与多设备视觉回归。

### 强化与服务权限

- [[docs/0x-plan&work/active/roadmap-0007-enhancement-reveal]]：GlobalEnh 揭示、资源观察与 0 成本服务权限语义。

当前状态：主题编辑权限暂时免费赠送；未观察青辉石时的可见性异常待后续修复。

### 新策划汇总（待评审）

- [[docs/0x-plan&work/docs/newPlan/00-index]]：学生获取与关系资产化方案总览；PassiveStory 评审已裁定，施工任务见 [[docs/0x-plan&work/active/task-0032-passive-story-scheduling]]。

该目录按模块/玩法簇收录 Sol 策划回复，当前属于方案草案；评审后再分别沉淀为正式 ADR、Roadmap 与实现任务。

## 工作规则

1. 新的架构级决策先写入本目录的 ADR，再拆成 Roadmap 切片。
2. Roadmap 只记录目标、切片、状态和验收结果，不复制机制正文。
3. 方案已实现后保留在 `completed/`，在文首和索引中标记完成，不删除历史决策。
4. 未完成方案按主题拆分为独立文件，避免一个总计划同时承载多个不相干问题。
5. 每个代码切片完成后至少更新对应 Roadmap 状态，并记录类型检查、专项测试和全量测试结果。

## 其他文档分区

- `docs/docs-828/01-architecture`：当前系统架构与运行逻辑。
- `docs/docs-828/02-modules`：当前模块卡片。
- `docs/docs-828/03-data-structures`：当前数据结构与边界审计。
- `docs/docs-828/04-mechanisms`：当前机制正文与总入口。
- `docs/docs-828/04-algorithms`：旧目录，仅保留迁移说明。
- `docs/docs-828/05-conventions`：协作与代码规范。
- `docs/docs-828/07-audit`：设计审查问题与整改记录。
- `abstract.md`：面向玩法策划聊天的游戏概念摘要。
