# docs/plan-work — 冻结考古层入口

状态：done — 2026-09-15 冻结为非核心历史层

> **本目录不是当前事实源。** 项目当前事实一律以 `src/` 与 `docs/docs-828/` 为准。
> 这里的根目录承载当前确实推进的 Task / ADR / Draft；`archive/` 与 `mechanisms/` 保存冻结过程文档。它们的用途分别是记录当前施工边界，以及回答「为什么当初这么做」或在需要时重新激活未完成方向。

> **当前活跃计划层状态（2026-09-18）**：根目录当前任务包括 [[task-0076-unified-def-editor-service]]、[[task-0077-runtime-editor-condition-tree]]、[[task-0078-runtime-editor-condition-target-editors]]、[[task-0079-chara-spot-link-retirement-and-redesign]]、[[task-0080-spot-cost-and-payment-extensibility]]、[[task-0088-init-area-hot-crud-and-location-fallback]]、[[task-0089-runtime-area-topology-overlay]]、[[task-0092-agents-routing-slimdown]]、[[task-0093-init-editor-design]]、[[task-0094-runtime-editor-floating-pane-launcher]] 与 [[task-0095-runtime-editor-mini-launcher-and-init-default-area]]。0087 已被重新收敛的 0088 取代，不再作为当前实施范围；AOCI-CODE 接入和任务系统结构对齐已完成并归档。

## 冻结约定

- `archive/` 与 `mechanisms/` 冻结为**单一考古层**：原 `active/`、`completed/`、`newPlan/`、`review/`、`registry&saves/` 已全部合并进 `archive/`，不再按生命周期分目录维护；
- 根目录 `task-*.md` / `adr-*.md` / `draft-*.md` 是当前施工入口，只保留确实要推进的工作；完成后移入 `archive/`，不得在根目录长期保留已完成文档；
- `00-index.md` 继续维护活跃任务、未决方向和历史路由；`archive/` 与 `mechanisms/` 内的历史正文不做状态准出，只允许按需追加「更正（日期）」标注；
- 每份文档文首的 `状态：` 行保留**冻结时的最后已知状态**（`done` 已完成 / `closing` 仅差准出 / `active` 在推进 / `proposed` 待开工 / `draft` 未裁定）。这些取值现在只用于阅读时区分「做完了」与「没做完」，**不再被任何检查器强制**；
- 目录内文件只做链接完整性检查（`npm run check:docs`）。

## 目录结构

| 路径 | 内容 |
| --- | --- |
| `archive/` | 全部冻结的过程文档（ADR / Roadmap / Task / 草案 / 审查记录 / 数据包施工计划） |
| `mechanisms/` | 按机制的**反向索引**：从当前机制出发找它的设计理由与历史来源 |
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

## 当前活跃任务

- [[task-0095-runtime-editor-mini-launcher-and-init-default-area]]：将 Runtime Editor 入口收敛为真-迷你可拖拽单列浮窗，并在新建 Init 时协同创建可自定义 `defaultArea`；已完成任务拆解，待执行。
- [[task-0093-init-editor-design]]：完成 Init 编辑器的页面、字段授权、默认区域关系、来源权限、Apply 影响和验收设计；引擎与 UI 已落地，待浏览器验收与最终准出。
- [[task-0094-runtime-editor-floating-pane-launcher]]：将 Runtime Editor 从 Toast 迁移到全局浮动工作区，解除对设置页和 Toast 生命周期的依赖。
- [[task-0092-agents-routing-slimdown]]：精简 `AGENTS.md` 的非托管入口与项目护栏，保留 AOCI 托管区块原样。
- [[task-0086-ui-dom-refresh-boundaries-and-hover-preservation]]：降低 UI 不必要的激进 DOM 刷新，收敛局部刷新与 hover 生命周期边界。
- [[task-0088-init-area-hot-crud-and-location-fallback]]：在共享 Spot 编辑框架中实现 Init / Area 热 CRUD，并在当前位置丢失时回到默认 Area 或 Init 选择界面。
- [[task-0089-runtime-area-topology-overlay]]：分离静态 Area Def 拓扑与 Runtime 可用拓扑，支持 Runtime Mod 对外部 Area 建立双向连接。
- [[task-0090-aoci-code-codex-integration]]：完成 AOCI-CODE 的 Codex 接入、首轮仓库认知索引、对齐验证与面板交付（已归档）。
- [[task-0091-aoci-task-system-structure-alignment]]：完成 AGENTS、任务入口与旧空目录骨架向 AOCI 分层的对齐（已归档）。

## 相关路由

- 当前任务：[[task-0089-runtime-area-topology-overlay]]、[[task-0088-init-area-hot-crud-and-location-fallback]]、[[task-0087-init-area-enhancement-editor-crud]]、[[task-0080-spot-cost-and-payment-extensibility]]、[[task-0079-chara-spot-link-retirement-and-redesign]]、[[task-0078-runtime-editor-condition-target-editors]]、[[task-0076-unified-def-editor-service]]
- 收束中的任务：[[task-0077-runtime-editor-condition-tree]]
- 最近完成的计划：[[task-0085-def-audit-metadata-and-missing-time-ordering]]、[[task-0084-spot-price-propagation-and-runtime-editability]]、[[task-0083-datapack-load-policy-persistence-and-startup-restore]]、[[task-0082-runtime-editor-invalid-entry-annotations]]、[[task-0081-spot-payment-default-removal]]、[[task-0075-spot-runtime-affector-editor-demo]]、[[task-0074-spot-affector-resource-convergence]]
- 最近一次清退（2026-09-15，暂停移入 `archive/`）：[[task-0071-runtime-editor-p0-capability-baseline]]、[[task-0072-runtime-mod-editor-authoring-spine]]、[[task-0073-spot-field-authoring-ladder]]
- [[docs/docs-828/00-INDEX]]（唯一当前事实入口）
- [[docs/docs-828/01-architecture/design-constraints]]（仍生效的设计约束）
- [[docs/docs-828/05-conventions/doc-maintenance]]（文档维护与归档规则）
- [[docs/plan-work/mechanisms/00-index]]（按机制的反向索引）
