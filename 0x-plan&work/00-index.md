# 0x-plan&work — 计划、路线图与工作记录总入口

> 本目录是项目所有计划、Roadmap、ADR、方案草稿与 Code Review 工作的唯一入口。
> 代码与机制文档仍以 `src/`、`docs-828/01-05` 为准；本目录只管理决策、工作范围、状态和后续行动。

## 当前状态

| 状态 | 含义 | 当前内容 |
| --- | --- | --- |
| ✅ 已完成 | 设计或施工已经完成，文档作为决策/历史记录保留 | 架构整理、GameNum、文档重构、引擎领域内聚、好感、色彩系统 |
| 🟡 进行中 | 已有部分实现或准备工作，仍有明确未完成切片 | Datapack 多包管理、Code Review |
| 🔵 待裁定 | 有目标和设计草案，但尚未形成最终 ADR | Spot 商店、卡池模型、角色拥有体系 |

## 已完成

| 文件 | 内容 | 状态 |
| --- | --- | --- |
| [[0x-plan&work/completed/adr-0001-architecture-consolidation]] | T1-T7 架构整理 | ✅ 已完成 |
| [[0x-plan&work/completed/adr-0002-gamenum-tree]] | GameNum 生产树与 Affector 修复 | ✅ 已完成 |
| [[0x-plan&work/completed/adr-0003-docs-restructure]] | docs-824 → docs-828 文档体系重构 | ✅ 已完成 |
| [[0x-plan&work/completed/adr-0005-engine-domain-boundaries]] | 基础引擎与 AronaClicker 领域内聚决策 | ✅ 已完成 |
| [[0x-plan&work/completed/roadmap-0005-engine-domain-consolidation]] | 引擎/数据服务/领域层/UI 内聚施工记录 | ✅ 已完成 |
| [[0x-plan&work/completed/affection-planning]] | 好感数值、台阶剧情、羁绊尾巴 | ✅ 已实现 |
| [[0x-plan&work/completed/color-system-plan]] | ColorGroup / ColorEquipment 系统 | ✅ 已实现 |
| [[0x-plan&work/completed/roadmap-overview-history]] | 原 Roadmap 总览 | 📦 已归档，由本文取代 |

## 未完成：按语义分组

### 数据包生态

- [[0x-plan&work/active/adr-0004-datapack-management]]：多包读取、启用集、惰性存档和包管理决策权威。
- [[0x-plan&work/active/roadmap-0001-datapack-management]]：对应实现切片与状态追踪。
- [[0x-plan&work/registry&saves/00-index]]：Registry、启用集与多包存档的完整施工计划。

当前重点：先完成 Registry 全量校验与启用集恢复接线，再实现惰性存档和残留管理。

### 世界经营玩法

- [[0x-plan&work/active/roadmap-0002-spot-shop]]：Spot 商店、货架发现与购买集。

当前状态：待设计裁定，尚无独立 ADR。

### 招募与角色成长

- [[0x-plan&work/active/roadmap-0003-gacha-pool-model]]：Banner 与角色候选池解耦。
- [[0x-plan&work/active/roadmap-0004-chara-ownership]]：角色拥有体系 Init 化与追赶统计。

两项应联合裁定，因为池候选、拥有状态、保底和跨世界线统计互相影响。

### 全量理解与审查

- [[0x-plan&work/review/code-review-roadmap]]：按数据、数值、写入、领域、UI、Datapack 顺序完成全量 Review。

当前状态：路线已建立，但检查清单尚未全部打勾；应以当前源码路径重新执行，而不是沿用旧目录假设。

### UI 表现层

- [[0x-plan&work/active/roadmap-0006-ui-background-layering]]：背景图片、渐变与 SVG 装饰叠层服务。
- [[0x-plan&work/active/adr-0006-ui-background-layering]]：背景层数据结构、合并规则与安全边界裁定。
- [[0x-plan&work/active/roadmap-0008-theme-color-system-refactor]]：主题色双轨、语义节点、UI 作用域继承与颜色迁移。
- [[0x-plan&work/active/roadmap-0009-theme-control-backgrounds]]：按钮与控件的多背景层、定位、状态和作用域继承。
- [[0x-plan&work/active/roadmap-0010-presentation-layer-service]]：统一表现层服务、系统颜色层排序与来源模型。
- [[0x-plan&work/active/roadmap-0011-ui-component-layer-backgrounds]]：将背景图层服务扩展到面板、按钮、Tab、卡片、气泡与弹窗。
- [[0x-plan&work/active/roadmap-0012-flat-presentation-targets]]：平级表现目标、级别筛选弹窗与统一图层编辑器。
- [[0x-plan&work/active/roadmap-0013-presentation-editor-ux]]：自定义表现控件编辑器体验、目标卡片与颜色/图片变换参数（E0-E5 已完成，保留全量 UI 测试环境问题）。
- [[0x-plan&work/active/roadmap-0014-theme-editor-convergence]]：主题编辑器信息架构、表现模型收束、来源可视化与预览画布重构（P0-P1 完成，P2 首版完成，P3-P4 待实施）。
- [[0x-plan&work/active/roadmap-0015-ui-dom-recalculation]]：正常游玩过程 DOM 重算收敛，区分局部更新与必要结构刷新（待实施）。
- [[0x-plan&work/active/roadmap-0016-cluster-region-context-overrides]]：簇默认与当前区域状态覆盖，统一三栏宿主表现关系（待实施）。
- [[0x-plan&work/completed/roadmap-0019-presentation-text-color]]：表现宿主文字颜色统一、四态解析与验收（✅ 已完成）。

当前状态：B0–B3 已完成，B4 待实施。

### 强化与服务权限

- [[0x-plan&work/active/roadmap-0007-enhancement-reveal]]：GlobalEnh 揭示、资源观察与 0 成本服务权限语义。

当前状态：主题编辑权限暂时免费赠送；未观察青辉石时的可见性异常待后续修复。

### 新策划汇总（待评审）

- [[0x-plan&work/newPlan/00-index]]：学生获取与关系资产化方案总览。

该目录按模块/玩法簇收录 Sol 策划回复，当前属于方案草案；评审后再分别沉淀为正式 ADR、Roadmap 与实现任务。

## 工作规则

1. 新的架构级决策先写入本目录的 ADR，再拆成 Roadmap 切片。
2. Roadmap 只记录目标、切片、状态和验收结果，不复制机制正文。
3. 方案已实现后保留在 `completed/`，在文首和索引中标记完成，不删除历史决策。
4. 未完成方案按主题拆分为独立文件，避免一个总计划同时承载多个不相干问题。
5. 每个代码切片完成后至少更新对应 Roadmap 状态，并记录类型检查、专项测试和全量测试结果。

## 其他文档分区

- `docs-828/01-architecture`：当前系统架构与运行逻辑。
- `docs-828/02-modules`：当前模块卡片。
- `docs-828/03-data-structures`：当前数据结构与边界审计。
- `docs-828/04-algorithms`：当前机制和算法说明。
- `docs-828/05-conventions`：协作与代码规范。
- `docs-828/07-audit`：设计审查问题与整改记录。
- `abstract.md`：面向玩法策划聊天的游戏概念摘要。
