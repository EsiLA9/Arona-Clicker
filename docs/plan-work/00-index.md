# docs/plan-work — 计划、讨论与冻结历史入口

状态：active — 当前计划与讨论路由持续维护；历史层于 2026-09-15 冻结

> **本目录不是当前事实源。** 项目当前事实一律以 `src/` 与 `docs/docs-828/` 为准。
> 这里的根目录承载当前确实推进的 Task / ADR / Draft；`archive/` 与 `mechanisms/` 保存冻结过程文档。归档文件保留完成或中断时的边界与证据，不能因位置推定其已完成。

> 当前推进项在本索引登记；本轮已将原有工作文档冻结归档，逐项状态见 [[active-work-freeze-2026-09-25]]。

玩法需求由 [[docs/ai/goal-workflow]] 路由：可删除的最终目标集与阶段 Goal 放在 [[docs/plan-work/goalsets/README]] 所述目录；进入正式讨论后建立滚动 Draft，满足准入再建独立可验收的 Task。具体 Goal Set 不登记到本索引，也不作为正式文档的依赖。

当前讨论：[[draft-0159-agent-observability-query-contract]]（Agent 观测工程 G01：操作后状态结果切片）。

## 当前推进

新建待施工 Task：[[task-0160-agent-operation-result-slice]]（经 Spot 升级命令捕获有界操作结果、状态差异和现存日志）。

待后续处理的 UI 主题切换调查记录：[[task-0158-ui-theme-workspace-transition-refresh-audit]]（主题工作区、Lobby/Init 与 GlobalEnh 间的图层主题刷新问题）。

## 本次完成（2026-09-26）

- [[task-0157-area-achievement-demo-v1]]：双区域独立数据包、Area 首访成就、累计进度、一次性效果与玩家可见 Records 页已交付；玩法裁定见 [[draft-0156-area-achievement-demo]]。

## 冻结约定

- `archive/` 与 `mechanisms/` 冻结为**单一考古层**：原 `active/`、`completed/`、`newPlan/`、`review/`、`registry&saves/` 已全部合并进 `archive/`，不再按生命周期分目录维护；
- 根目录 `task-*.md` / `adr-*.md` / `draft-*.md` 是当前施工入口，只保留确实要推进的工作；完成或按用户要求冻结后移入 `archive/`，不得在根目录长期保留已完成文档；
- `00-index.md` 继续维护活跃任务、未决方向和历史路由；`archive/` 与 `mechanisms/` 内的历史正文不做状态准出，只允许按需追加「更正（日期）」标注；
- 每份文档文首的 `状态：` 行保留**冻结时的最后已知状态**（`done` 已完成 / `closing` 仅差准出 / `active` 在推进 / `proposed` 待开工 / `draft` 未裁定）。这些取值现在只用于阅读时区分「做完了」与「没做完」，**不再被任何检查器强制**；
- 目录内文件只做链接完整性检查（`npm run check:docs`）。

## 目录结构

| 路径 | 内容 |
| --- | --- |
| `archive/` | 全部冻结的过程文档（ADR / Roadmap / Task / 草案 / 审查记录 / 数据包施工计划） |
| `mechanisms/` | 按机制的**反向索引**：从当前机制出发找它的设计理由与历史来源 |
| `goalsets/` | 可整组删除的最终目标与阶段 Goal 讨论地图；使用说明见 [[docs/plan-work/goalsets/README]] |
| 根目录 `task-*.md` / `adr-*.md` / `draft-*.md` | 当前正在推进的任务或裁定，完成后移入 `archive/` |
| `00-index.md` | 本文 |

## 怎么用这一层

```text
想知道系统现在是什么        → docs/docs-828（唯一当前事实源）
想开始一个新方向            → 在 docs/plan-work/ 根目录新建 Task / ADR / Draft，并同步本文
想知道某个机制为什么这样设计 → docs/plan-work/mechanisms/<机制> → 再跳 archive 原文
想知道还有什么没做          → 本文「未决方向」（下列）
想恢复某个方向              → 从 archive 原文重新激活，另立 ADR / Task，不要就地续写
```

**不要**从本目录判断系统现状。ADR 中写「应如此」但源码未实现的地方，见 [[docs/docs-828/01-architecture/design-constraints]] 末节「尚未落地的纸面约束」。

## 未决方向（冻结时的未完成项）

> 以下方向在冻结时**既未完成、也未被正式撤销**。列出仅为避免意图丢失；它们**不在当前计划中**。需要推进时，从对应原文重新裁定。
> 本节较早条目中出现的“当前”“施工中”均是当时的历史措辞；2026-09-25 本轮状态以 [[active-work-freeze-2026-09-25]] 为准。

### 数据包与多包管理

- 单文件 / 文件夹来源适配器（与 zip 同构解析）。
- 按扩展名注册的通用分片解析器（`.dsl` 等）。
- **惰性存档的全量语义**：除 Tag 外 roster / 背包 / `storyReadLogs` / flags / 好感的存在性过滤，以及残留检查与清除界面。
- 残留数据跨 mod 合并语义、manifest 缺省降级、version 区间匹配、依赖拓扑排序。
- character / variant id 三段化（S1c）与相应校验收紧。
- `affectionConfig` 改特化表 + 角色级 `affectionConfigId`。
- mod 管理 UI 补全：文件夹 / 单文件导入、完整草案确认流程、残留管理。

原文：[[adr-0004-datapack-management]]、[[roadmap-0001-datapack-management]]、[[registry-saves-00-index]]、[[01-registry-plan]]、[[02-save-plan]]、[[03-rollout-and-acceptance]]

### 商店与卡池

- Spot 商店的完整 `ShopOffer` union（role / upgrade / spot / affector / effect）、`refresh` 库存类型、实例物品货币。
- 卡池 banner ↔ 候选集解耦、声明式候选来源、基础池随 Init 扩充、限定池隔离、`refreshWorldPool` 去留。

原文：[[roadmap-0002-spot-shop]]、[[roadmap-0003-gacha-pool-model]]、[[adr-0007-shop-transaction-boundaries]]

### 角色拥有与成长

- Chara 拥有体系 Init 化（roster / characters / fragments 默认翻转 init），图鉴发现记录与当前拥有分离。
- 追赶统计项与追赶机制（pity 修正、权重倾斜、好感补偿）。
- 角色成长 B 段：`ProgressionEffectResolver`、单源 zone 注入、跨世界线 catch-up、Chara-Spot 消费者。
- 技能 / 装备写入口与 UI、Proto milestone effects 消费端。

原文：[[roadmap-0004-chara-ownership]]、[[adr-0008-character-progression-boundaries]]、[[task-0041-character-progression-and-memory]]、[[11-gear-equipment-system]]

### 强化揭示与服务权限

- 分离「资源观察状态 / 强化揭示状态 / 资源支付判定 / 服务能力状态」；修未观察青辉石时 GlobalEnh 可见性与 NotVisible 路径。

原文：[[roadmap-0007-enhancement-reveal]]

### UI / 主题表现层

- 编辑器专用背景可视化预览与预览画布、目标反向选择。
- 表现层调试视图（来源 / 顺序 / 透明度 / 忽略状态）。
- 主题编辑器信息架构重构（三层折叠、来源链与空值表达、局部刷新、可访问性、窄屏）。
- 控件背景完整四态接入与按钮 / Tab 的 Edge 视觉回归。
- 簇—区域深合并（图层、系统层开关、透明度、排序）与回归测试。
- 表现层旧路径收束（`presentation.layers` 迁移、`backgroundLayerOrder`、`panels` 透明度归一）。
- 历史硬编码组件背景清理、窄屏视觉回归。
- 主题色语义节点 CSS 渐进迁移；UI 更新调度第二阶段（Reveal 分类与最小 Region 映射）。

原文：[[roadmap-0006-ui-background-layering]]、[[roadmap-0009-theme-control-backgrounds]]、[[roadmap-0010-presentation-layer-service]]、[[roadmap-0011-ui-component-layer-backgrounds]]、[[roadmap-0012-flat-presentation-targets]]、[[roadmap-0014-theme-editor-convergence]]、[[roadmap-0016-cluster-region-context-overrides]]、[[roadmap-0017-theme-state-and-semantic-storage]]、[[task-0065-ui-presentation-residual-and-visual-regression]]、[[task-0066-theme-css-progressive-migration]]、[[task-0067-ui-update-dispatcher-stage2]]

### 服务 / 工作区

- 存档工作区（列表 / 详情 / 读写 / 新游戏确认 / 数据包环境差异 / 残留按 mod 清除）。
- 记录工作区（图鉴总览分类 + 统计按数据包贡献 / 世界线 / 标签筛选）。
- 数据包工作区完善（导入预览、启用集草案、Registry dry-run 与失败回滚、影响报告）。
- 统一体验验收（危险命令影响预览、草案拦截、跨服务返回栈、可访问性、失败恢复）。
- 通讯录 / 档案工作区完整内容；宿主接入全量落地（服务内部子宿主、服务筛选目标）。

原文：[[roadmap-0020-service-workspaces]]、[[roadmap-0018-ui-host-registry]]、[[task-0047-contacts-story-workspace-ownership]]、[[04-service-workspace-plan]]

### Lobby / Pre-Init

- Lobby 文案区分「当前世界线 / 全局内容」；服务权限守卫（禁止依赖当前 Init 的写入口）；浏览器级视觉验收。

原文：[[roadmap-0024-lobby-pre-init-runtime]]

### 由 Task 承载的其他未决方向

- 按钮序列统一接入 Host 的剩余部分：[[task-0030-button-rendering-convergence-solution]]
- PassiveStory P0/P1 与池分层权重：[[task-0032-passive-story-scheduling]]
- Affector / GameNum 性能整改：[[task-0034-affector-performance-review]]
- Condition Presentation Tree：[[task-0035-condition-presentation-tree]]
- 图层类型化参数面板：[[task-0054-user-theme-layer-type-aware-value-editor]]
- 运行时数据包编辑工作台：[[task-0055-runtime-datapack-editor-mvp]]、[[task-0056-workspace-datapack-boundary-convergence]]、[[task-0057-single-mod-editor-workbench]]
- 背包剩余能力（整理持久化、出售丢弃、来源筛选）：[[task-0068-inventory-workspace-remaining-capabilities]]
- 未裁定的设计草案：[[01-ownership-and-development]]、[[02-unified-acquisition]]、[[03-spot-shop]]、[[04-recruitment-v2]]、[[05-fragments-and-currency]]、[[06-meta-loop-and-ui]]、[[07-mvp-scope]]、[[16-runtime-datapack-authoring]]
- 运行时数据包创作方向（2026-09-15 全部暂停，是本轮清退后新一轮策划的起点）：
  - 已交付并归档：[[task-0075-spot-runtime-affector-editor-demo]]（Spot Affector 可变列表与持续资源 Demo）、[[task-0074-spot-affector-resource-convergence]]（Spot 产出统一收敛至 Affector）；
  - 已暂停（移入 `archive/`）：[[task-0072-runtime-mod-editor-authoring-spine]]（S0 / S1-A 已交付；S2 `revealTriggers` 递归条件组、S3 工作区持久化与导出未完成）、[[task-0073-spot-field-authoring-ladder]]（S1-B1 已交付；S1-B2 `tags`/`global`、S1-B3 引用字段未完成；S1-B4 已由 0075 以受限形态覆盖）、[[task-0071-runtime-editor-p0-capability-baseline]]（需求基线与 33 键能力台账，交付顺序已被 0072 取代）；
  - 相关设计来源：[[16-runtime-datapack-authoring]]、[[runtime-editor-overlay-sol-review]]、[[def-resolution-withdrawal-sol-review]]
  - 新一轮策划（2026-09-15 起）：[[task-0076-unified-def-editor-service]]（前台统一编辑器服务：Def 编辑构建接口 / 全宽承载 + 左侧 Switch 分页 / 子编辑弹窗；含 Spot 层级样例楼层设计与 B1–B5 内容阶梯；策划完成，待裁定与开工）
  - Init / Area / Enhancement 编辑态 CRUD（2026-09-17，已被重新收敛）：[[task-0087-init-area-enhancement-editor-crud]]（原三类 Definition 方案，因 candidate reload 与 Enhancement 范围过大而中断）
  - Init / Area 热 CRUD 与当前位置兜底（2026-09-17）：[[task-0088-init-area-hot-crud-and-location-fallback]]（当前实施任务；共享 Spot 编辑框架，不做 Enhancement）
  - 条件编辑器专项任务（2026-09-16）：[[task-0077-runtime-editor-condition-tree]]（条件树、AND/OR 点击切换、原子条件摘要与弹窗编辑；主体已落地，待浏览器验收）
  - 原子条件目标编辑器（2026-09-16）：[[task-0078-runtime-editor-condition-target-editors]]（目标驱动字段、引用候选、摘要与校验；P0/P1 已落地，P2 施工中）
  - Manager 旧语义删除（2026-09-16）：[[task-0079-chara-spot-link-retirement-and-redesign]]（删除旧 Manager 状态、条件、Effect、事件与兼容路径；不涉及新的 Chara—Spot 关系设计）
  - Spot 默认支付退役（2026-09-16，已完成并归档）：[[task-0081-spot-payment-default-removal]]（删除 `baseCost` / `baseCostResource` 与升级旧价格回退，所有 Spot 解锁 / 升级改由显式价格组声明）
  - Runtime Editor 非法条目注记（2026-09-16，已完成并归档）：[[task-0082-runtime-editor-invalid-entry-annotations]]（为 Spot 集合条目与所属 Switch 增加轻量问题注记；不做调用链追踪）
  - 数据包加载策略持久化与启动自动恢复（2026-09-16，已完成并归档）：[[task-0083-datapack-load-policy-persistence-and-startup-restore]]（应用启用集后持久化，启动时自动恢复并加载已启用数据包）
  - Spot 价格传导链与初始价格可编辑性（2026-09-16，已完成并归档）：[[task-0084-spot-price-propagation-and-runtime-editability]]（RuntimeEditor 仅处理 Spot 默认价格 / 条件组，Affector 追加价格另立系统）
  - Def 审计时间元数据与无时间内容兼容（2026-09-16，已完成并归档）：[[task-0085-def-audit-metadata-and-missing-time-ordering]]（统一创建 / 修改时间，并在 Registry 中将缺失时间视为极早值）

## 本轮冻结归档（2026-09-25）

- [[task-0155-active-work-documents-freeze]]：本轮盘点、核验与归档执行记录（已完成）。
- [[active-work-freeze-2026-09-25]]：31 份工作文档（8 Draft、23 Task）的逐项摘要、最后已知进展与待续边界。
- 该次冻结后的新工作入口见上方「当前推进」；归档保留各文档冻结前的状态，不代表全部完成。

## 相关路由

- 最近完成：[[task-0151-milestone-persistent-arrival-facts-p0]]（Save-scope Persistent Arrival Fact；P0-A–D 与 5 个 Patch Unit 完成，39 项定向回归通过，2026-09-25）、[[task-0149-information-reveal-runtime-lifecycle]]（Information Reveal 的 Init、读档、重置与热内容对账，194 文件 / 1777 测试通过，2026-09-25）、[[task-0148-information-reveal-adapter-v1]]（Save Progress、Reveal 域与 EB-T Adapter，2026-09-25）、[[task-0146-reveal-domain-model-v1]]（Information Reveal v1 领域事实、Scope、prerequisite 与 WakePlan 裁定；仅设计与源码核验，2026-09-25）、[[task-0145-reveal-condition-event-coverage-audit]]（Reveal Condition / Event 覆盖只读审计，17 个目标矩阵、activation/invalidation 分析与首期建议，2026-09-24）、[[task-0144-trigger-runtime-registration-withdrawal]]（Trigger Runtime Registration & Withdrawal，188 files / 1748 tests 通过，2026-09-24）、[[task-0133-ui-refresh-repair-slices]]（依据 task-0132 逐切片完成 UI 刷新、焦点/滚动连续性与 Tabs 语义修复，2026-09-20 完成）、[[task-0132-ui-refresh-and-structural-density-audit]]（四 Workstream 多 agent 只读审计完成，2026-09-20 完成）、[[task-0130-runtime-editor-codex-def-inspector-plan]]（超级图鉴 Def 概览、关系与原始数据详览，2026-09-20 完成）。
- 本轮归档：[[task-0154-goalset-discussion-to-execution-workflow]]、[[task-0153-milestone-listener-admission-and-reactive-coverage-audit]]、[[task-0151-milestone-persistent-arrival-facts-p0]]、[[task-0150-aoci-governance-and-runtime-alignment]]、[[task-0149-information-reveal-runtime-lifecycle]]、[[task-0148-information-reveal-adapter-v1]]、[[task-0146-reveal-domain-model-v1]]、[[task-0145-reveal-condition-event-coverage-audit]]、[[task-0144-trigger-runtime-registration-withdrawal]]、[[task-0141-document-workflow-simplification]]、[[task-0087-init-area-enhancement-editor-crud]]（由 0088 取代）、[[task-0096-panel-granular-refresh-api-and-hover-continuity]]、[[task-0097-entity-presentation-content-selection]]、[[task-0128-runtime-editor-loaded-content-codex]]、[[task-0129-runtime-editor-codex-workspace-optimization]]。
- 最近完成的计划：[[task-0119-runtime-editor-base-full-export]]、[[task-0118-datapack-editing-creation-target-indicator]]、[[task-0117-datapack-editing-visible-label]]、[[task-0116-datapack-editing-active-gold-theme-token]]、[[task-0115-datapack-editing-active-gold-state]]、[[task-0114-datapack-edit-entry-and-apply-gate]]、[[task-0113-datapack-pane-control-density]]、[[task-0112-datapack-pane-group-order-and-mode-switch]]、[[task-0111-datapack-pane-slots-selection-and-atomic-apply]]、[[task-0110-datapack-editing-state-and-targeted-authoring]]、[[task-0107-runtime-editor-pack-export-service]]、[[task-0106-runtime-editor-draft-persistence]]、[[task-0105-init-selector-invalid-worldtilt-compatibility]]、[[task-0101-external-refresh-hover-race-and-invalidation]]、[[task-0102-entity-theme-immediate-refresh]]、[[task-0085-def-audit-metadata-and-missing-time-ordering]]、[[task-0084-spot-price-propagation-and-runtime-editability]]、[[task-0083-datapack-load-policy-persistence-and-startup-restore]]、[[task-0082-runtime-editor-invalid-entry-annotations]]、[[task-0081-spot-payment-default-removal]]、[[task-0075-spot-runtime-affector-editor-demo]]、[[task-0074-spot-affector-resource-convergence]]
- 最近一次清退（2026-09-15，暂停移入 `archive/`）：[[task-0071-runtime-editor-p0-capability-baseline]]、[[task-0072-runtime-mod-editor-authoring-spine]]、[[task-0073-spot-field-authoring-ladder]]
- [[docs/docs-828/00-INDEX]]（唯一当前事实入口）
- [[docs/docs-828/01-architecture/design-constraints]]（仍生效的设计约束）
- [[docs/docs-828/05-conventions/doc-maintenance]]（文档维护与归档规则）
- [[docs/plan-work/mechanisms/00-index]]（按机制的反向索引）
