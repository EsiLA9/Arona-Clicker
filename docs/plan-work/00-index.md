# docs/plan-work — 冻结考古层入口

状态：done — 2026-09-15 冻结为非核心历史层

> **本目录不是当前事实源，也不代表仍在推进的工作。** 项目当前事实一律以 `src/` 与 `docs/docs-828/` 为准。
> 这里保存的是过程文档：ADR 裁定、Roadmap 切片、Task 施工记录与设计草案。它们的用途只有一个——**回答「为什么当初这么做」，以及在需要时重新激活某个未完成方向**。

## 冻结约定

- 本目录整体冻结为**单一考古层**：原 `active/`、`completed/`、`newPlan/`、`review/`、`registry&saves/` 已全部合并进 `archive/`，不再按生命周期分目录维护；
- **不再进行准出、不再维护索引状态、不再做批量归档**。文档只允许按需追加「更正（日期）」标注；
- 每份文档文首的 `状态：` 行保留**冻结时的最后已知状态**（`done` 已完成 / `closing` 仅差准出 / `active` 在推进 / `proposed` 待开工 / `draft` 未裁定）。这些取值现在只用于阅读时区分「做完了」与「没做完」，**不再被任何检查器强制**；
- 目录内文件只做链接完整性检查（`npm run check:docs`）。

## 目录结构

| 路径 | 内容 |
| --- | --- |
| `archive/` | 全部冻结的过程文档（ADR / Roadmap / Task / 草案 / 审查记录 / 数据包施工计划） |
| `mechanisms/` | 按机制的**反向索引**：从当前机制出发找它的设计理由与历史来源 |
| `00-index.md` | 本文 |

## 怎么用这一层

```text
想知道系统现在是什么        → docs/docs-828（唯一当前事实源）
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
- 运行时数据包创作方向：[[16-runtime-datapack-authoring]]、[[runtime-editor-overlay-sol-review]]、[[def-resolution-withdrawal-sol-review]]

## 相关路由

- 最近完成的计划：[[task-0070-documentation-context-service]]
- [[docs/docs-828/00-INDEX]]（唯一当前事实入口）
- [[docs/docs-828/01-architecture/design-constraints]]（仍生效的设计约束）
- [[docs/docs-828/05-conventions/doc-maintenance]]（文档维护与归档规则）
- [[docs/plan-work/mechanisms/00-index]]（按机制的反向索引）
