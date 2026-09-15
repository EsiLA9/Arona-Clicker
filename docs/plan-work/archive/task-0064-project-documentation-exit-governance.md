# Task 0064：项目过程文档与知识库准出治理

状态：done — 已归档（2026-09-15）。第一阶段、首轮 5 份试点与第二批扩大范围准出均已完成。

> 本文回答：如何在不重建文档管理框架的前提下，核实过程文档生命周期、准出完成任务，并将稳定当前知识蒸馏到 `docs/docs-828/`。
>
> 本任务是轻量生命周期治理，不是全库重写、文档数据库或复杂状态机建设。当前事实以源码和测试为准；本任务文档只管理范围、分类、准出和后续行动。

## 目标

- `docs/plan-work/archive/` 只保留仍需继续推进的工作；
- `docs/plan-work/archive/` 只保留仍待裁定的设计；
- `docs/plan-work/archive/` 承担历史记录与设计理由；
- `docs/docs-828/` 承担当前机制解释，不依赖历史 Task 才能理解系统现状；
- 索引只负责发现、导航和粗粒度状态；
- 已完成任务归档前完成验证核对、知识蒸馏和后续事项拆分。

## 非目标

- 不全面重写 `docs/docs-828/`；
- 不一次性批量归档所有“看起来已完成”的文档；
- 不建立复杂 YAML 元数据、文档数据库或自动知识同步系统；
- 不以关键词匹配替代源码、测试和正文核实；
- 不为了让旧文档继续成立而迁就过时描述。

## 事实源与设计依据

核实时不要把当前行为事实和设计理由硬排成一条优先级：

```text
当前行为事实：
源码 → 测试证据 → docs/docs-828

设计约束与理由：
仍有效 ADR

过程与历史：
active / newPlan → completed / audit / docs-824
```

解释：源码描述实际行为；测试只证明覆盖范围内的行为被锁定，不天然覆盖源码；`docs/docs-828/` 解释当前系统，不反向决定源码行为；ADR 保留仍有效的设计约束和理由。如果源码已经偏离仍有效 ADR，应记录为“实现与 ADR 冲突”，而不是把 ADR 当作当前行为事实源。

## 第一阶段：盘点与分类

第一阶段原则上不进行大规模正文改写，只完成核实、分类和明显索引纠偏。

### 1. Active 分类

逐份检查 `docs/plan-work/archive/`，每份归入以下一种分类：

| 分类 | 判定标准 | 下一动作 |
| --- | --- | --- |
| `KEEP_ACTIVE` | 原任务范围仍有明确施工、设计或必要验收阻塞 | 保持 active，清理失效过程噪声 |
| `CLOSING` | 原范围已完成，正在补齐验证、蒸馏和归档结果 | 仅处理准出必需事项，不扩展原任务 |
| `SPLIT_AND_CLOSE` | 主目标已完成，但存在可独立拆出的后续工作 | 先创建/关联 follow-up，再归档原任务 |
| `SUPERSEDED` | 已被新的 Task、ADR 或方案替代 | 记录替代文档后归档 |

不得仅根据“已完成”“已实施”等关键词直接归档。

`CLOSING` 只允许处理准出所必需的验证、蒸馏、follow-up 拆分和归档整理。发现新的功能需求或结构性改造时，必须另立 Task，不得扩展原任务。

### 2. NewPlan 分类

逐份检查 `docs/plan-work/archive/`：

| 分类 | 判定标准 | 下一动作 |
| --- | --- | --- |
| `PROPOSED` | 仍待评审或裁定 | 保留在 newPlan |
| `ADOPTED` | 设计已采纳 | 进入 ADR、Task 或当前机制文档；原草案转历史 |
| `TRANSFERRED` | 已转化为后续 Task / Roadmap | 保留来源关系后转历史 |
| `REJECTED` | 明确不采用 | 保留必要否决理由后转历史 |
| `SUPERSEDED` | 已被新方案替代 | 记录替代文档后转历史 |

`newPlan/` 不得长期保留已经落地或已经转 Task 的设计。

### 3. 索引纠偏

优先检查：

- `docs/docs-828/00-INDEX.md`
- `docs/plan-work/00-index.md`
- `AGENTS.md`

只修正会导致错误导航、错误生命周期判断或错误当前事实理解的明显错误：

- 正文已完成但索引仍写待施工；
- 已转 Task 的草案仍显示待评审；
- 已失效的机制摘要；
- 已过时的阶段状态。

第一阶段不得因为状态表达风格不同而批量重写索引，不统一格式。索引不得继续维护 P0/P1/P2、测试数量、Edge 细节或大段施工记录。

### 第一阶段报告

输出集中分类报告，至少包含：

| 文档 | 分类 | 证据 | 原因 | 动作 |
| --- | --- | --- | --- | --- |
| `task-xxxx` | `CLOSING` | 核验章节、测试、源码落点 | 原范围已完成 | 补归档结果 |
| `task-yyyy` | `SPLIT_AND_CLOSE` | 正文剩余工作 | 后续事项独立 | 新建 follow-up 后归档 |

另列：

- 索引与正文冲突；
- `newPlan/` 生命周期异常；
- `docs-828/` 中明显过时或混合未来设计的内容；
- 需要第二阶段蒸馏的文档。

### 第一轮试点

第一阶段完成后，先选择 5 份关系简单的完成候选进行准出试点，建议优先考虑：

- `task-0028-presentation-target-inherit-only`
- `task-0031-svg-button-state-color-audit`
- `task-0036-switch-tabs-background-module`
- `task-0037-panel-tabs-region-structure`
- `task-0043-topbar-settings-workspace`

其中 `0036 → 0037` 用于验证“旧任务归档、后续任务继续 active”的交接方式。试点完成后复盘准出规则，再扩大范围。

### 试点停止点

5 份试点完成后停止批量准出，不继续处理其他候选。

先输出一次复盘，至少回答：

- 四项准出条件是否足够；
- 是否出现无法归类的知识；
- follow-up 拆分是否导致任务碎片化；
- `docs-828` 是否出现重复描述；
- 归档结果模板是否够用；
- 是否需要修改 Task-0064 规则。

只有在规则无需重大调整后，后续才扩大准出范围。

## 第二阶段：准出与知识蒸馏

### 1. 准出条件

文档只有同时满足以下四项，才允许进入 `completed/`：

1. **Implementation settled**：原任务范围已完成、明确取消或明确移交；
2. **Verification settled**：原任务要求的测试和验收结果已明确；
3. **Knowledge materialized**：稳定当前知识已进入 `docs/docs-828/`，或明确记录“无新增当前知识”；
4. **Remaining work extracted**：剩余工作已拆为新 Task、Roadmap item 或有理由的 deferred。

浏览器验收未完成不天然阻塞归档：如果是原任务硬性验收项则保持 active；如果是后续体验验证则拆成新 Task；如果当前环境无法执行但已有足够自动化证据，则在归档结果中明确说明。

### 2. 蒸馏分类

从准备归档的文档中只提取：

- **Current Fact**：当前代码确实如此运行的稳定机制 → `docs/docs-828/`；
- **Design Rationale**：未来维护者仍需知道的设计理由 → ADR 或 completed Task；
- **Process Detail**：临时调试、施工顺序、已解决 TODO → 不蒸馏；
- **Remaining Work**：未完成事项 → 新 Task / Roadmap / 明确 deferred。

不得把整份 Task 搬入 `docs/docs-828/`。

### 3. 归档结果

新归档文档增加简短章节：

```markdown
## 归档结果

- 当前知识已蒸馏至：
  - [[...]]
- 设计理由保留于：
  - 本文 / [[ADR-...]]
- 后续工作：
  - [[task-...]]
- 准出结论：
  - 原任务范围已完成
```

不要求全库补充复杂 YAML frontmatter。

## docs-828 修正范围

只修正与本次准出直接相关的机制文档：

- 与当前源码冲突的描述；
- 已落地但仍写成“后续接入”的机制；
- 已失效的 no-op / 预留说明；
- 当前事实与未来设计混写的段落。

必要时使用简单的“当前：”“预留：”标识，不新增复杂元数据体系。

## 第三阶段：最小静态检查

在人工治理完成并验证流程后，评估实现：

```text
npm run check:docs
```

首版最多检查：

1. Markdown / Obsidian 内部链接目标存在；
2. 文档明确引用的源码路径存在；
3. active / completed 与正文状态明显冲突；
4. `materialized` / `follow-ups` 指向存在；
5. completed 文档中未被归档结果解释的“待施工 / 尚未实现 / TODO”等表述给出 warning。

不自动判断文档语义是否过期、机制是否完全覆盖源码、Git 提交关联或模块文档完整性。

## 当前基线（立项核验）

2026-09-15 初始只读盘点结果：

- `active/`：74 份；
- `newPlan/`：17 份；
- `completed/`：10 份；
- `active/` 中约 32 份文档首部出现完成性表述，需逐份核实，不得直接视为可归档数量。

该基线只用于本任务第一阶段的盘点，不替代后续源码、测试和正文核验。5 份试点归档后，当前目录计数为 `active/` 69 份、`completed/` 16 份；`newPlan/` 仍为 17 份。

第二批扩大范围准出完成后（2026-09-15，含本任务自身归档），目录计数为 `active/` 57 份、`completed/` 40 份、`newPlan/` 9 份。

## 第一阶段盘点与分类报告

### Active 全量分类

本报告按文档当前内容、验证记录、关联 Task 和索引状态分类；分类不是仅根据标题关键词得出。除试点文档外，以下候选暂不移动，等待后续准出批次。

| 分类 | 文档 | 判定依据与动作 |
| --- | --- | --- |
| `KEEP_ACTIVE` | `adr-0004-datapack-management`、`adr-0006-ui-background-layering`、`adr-0007-shop-transaction-boundaries`、`adr-0008-character-progression-boundaries`、`adr-0009-init-lifecycle-boundaries`、`adr-0010-definition-repository-editor-resolution`、`adr-0011-definition-resolution-withdrawal`、`adr-0012-runtime-hot-content-crud` | 仍有设计边界、延期阶段或实现依赖，继续作为 active 设计依据 |
| `KEEP_ACTIVE` | `roadmap-0001-datapack-management`、`roadmap-0002-spot-shop`、`roadmap-0003-gacha-pool-model`、`roadmap-0004-chara-ownership`、`roadmap-0006-ui-background-layering`、`roadmap-0007-enhancement-reveal`、`roadmap-0009-theme-control-backgrounds`、`roadmap-0010-presentation-layer-service`、`roadmap-0011-ui-component-layer-backgrounds`、`roadmap-0012-flat-presentation-targets`、`roadmap-0014-theme-editor-convergence`、`roadmap-0016-cluster-region-context-overrides`、`roadmap-0017-theme-state-and-semantic-storage`、`roadmap-0018-ui-host-registry`、`roadmap-0020-service-workspaces`、`roadmap-0024-lobby-pre-init-runtime` | 仍有明确未完成切片、验收或依赖中的路线目标，保持 active |
| `KEEP_ACTIVE` | `talklet-presentation-upgrade-draft`、`talklet-theme-lite` | 仍是未裁定的设计草案 |
| `KEEP_ACTIVE` | `task-0000-ai-context-infrastructure`、`task-0021-datapack-workspace-repair`、`task-0022-theme-definition-and-custom-theme-repair`、`task-0030-button-rendering-convergence-solution`、`task-0032-passive-story-scheduling`、`task-0034-affector-performance-review`、`task-0035-condition-presentation-tree`、`task-0039-spot-shop-transaction-system`、`task-0040-unified-workspace-frame`、`task-0046-init-lifecycle-boundaries`、`task-0047-contacts-story-workspace-ownership`、`task-0048-workspace-theme-restructure-and-editor`、`task-0049-user-theme-background-layer-manager`、`task-0050-user-theme-layer-overlay-and-global-target-convergence`、`task-0051-user-theme-layer-editor-functional-recovery`、`task-0052-user-theme-layer-overlay-presentation`、`task-0053-user-theme-layer-interaction-fixes`、`task-0054-user-theme-layer-type-aware-value-editor`、`task-0055-runtime-datapack-editor-mvp`、`task-0056-workspace-datapack-boundary-convergence`、`task-0057-single-mod-editor-workbench`、`task-0058-definition-resolution-p1a`、`task-0059-definition-resolution-p1b`、`task-0060-multi-spot-runtime-editor`、`task-0061-runtime-hot-content-crud-spot`、`task-0062-runtime-spot-editor-simple-flow`、`task-0063-runtime-editor-command-facade`、`task-0064-project-documentation-exit-governance` | 仍有实现、设计、必要验收或本任务自身的后续工作，保持 active |
| `CLOSING` | `roadmap-0013-presentation-editor-ux`、`roadmap-0015-ui-dom-recalculation`、`roadmap-0026-presentation-inset-decoration`、`task-0025-selector-dynamic-theme`、`task-0027-theme-switch-cleanup-and-user-theme-isolation`、`task-0029-button-sequence-rendering-audit`、`task-0033-system-color-layer-scope`、`task-0038-ui-conflict-audit-followup`、`task-0042-character-workspace-ui-convergence` | 主范围已完成，剩余内容主要是非阻塞记录、体验增强或准出整理；下一批补齐归档结果后归档 |
| `SPLIT_AND_CLOSE` | `roadmap-0008-theme-color-system-refactor`、`task-0023-project-documentation-normalization`、`task-0039-sol-review`、`task-0041-character-progression-and-memory`、`task-0045-ui-incremental-update-workspace-isolation` | 主目标或阶段已完成，但 CSS 渐进迁移、文档生命周期治理、Shop 回填、角色 B 段或后续 UI 切片必须先转为独立 follow-up，再归档原文档 |
| `SUPERSEDED` | `roadmap-0018-button-state-unification` | 当前状态/表现统一工作已由后续 Task-0030、Task-0031 及相关 Roadmap 分担；归档前需在文首记录替代关系 |

### NewPlan 全量分类

`newPlan/00-index.md` 是导航文件，不作为设计草案分类；其余 16 份如下：

| 分类 | 文档 | 判定依据与动作 |
| --- | --- | --- |
| `PROPOSED` | `01-ownership-and-development`、`02-unified-acquisition`、`03-spot-shop`、`04-recruitment-v2`、`05-fragments-and-currency`、`06-meta-loop-and-ui`、`07-mvp-scope`、`13-unified-workspace-refresh-boundaries`、`14-contacts-story-workspace-ownership`、`16-runtime-datapack-authoring` | 仍待评审、裁定或拆分正式 ADR / Task，保留在 newPlan |
| `ADOPTED` | `10-inventory-workspace`、`11-gear-equipment-system` | 已有实现或已采纳的设计，后续需将稳定事实进入 `docs/docs-828/`，剩余能力拆为独立 Task 后退出 newPlan |
| `TRANSFERRED` | `08-passive-story-sol-review`、`09-shop-transaction-draft`、`12-ui-geometry-workspace-reshape`、`15-user-theme-background-layer-manager` | 已转为 Task 或施工链，保留来源关系后转入历史区 |
| `REJECTED` / `SUPERSEDED` | 无 | 本轮未发现可安全归入这两类的文档 |

### 索引与正文冲突

本轮已修正的事实错误包括：

| 位置 | 问题 | 处理 |
| --- | --- | --- |
| `docs/plan-work/00-index.md` | 已归档的 0028、0031、0036、0037、0043 仍指向 active | 改为 completed 路径，并保留粗粒度完成状态 |
| `docs/plan-work/00-index.md` | 0023、0025、0029、0033、0042、0045、0039、0040 的状态与正文不一致 | 改为 closing、施工中、验收中或待拆分等当前判断 |
| `docs/plan-work/archive/00-index.md` 及相关机制索引 | 多处使用不存在的 `docs/plan-work/docs/newPlan/` 路径 | 统一修正为 `docs/plan-work/archive/` |
| `docs/docs-828/00-INDEX.md` | 机制正文仍写“迁移中”，基线日期落后，角色成长和好感 §4 状态过时 | 改为当前机制入口、2026-09-15 基线，并修正对应状态 |
| 已归档试点与其引用方 | 0037 辅助清单仍在 active；相关 completed 文档互相指向旧 active 路径 | 清单与主任务一并归档，修正 completed 交叉链接 |

索引中的阶段性细节和格式差异未做全库重写；本阶段只修正会导致错误导航、错误生命周期判断或错误当前事实理解的内容。

### `docs-828` 过时或混合内容清单

- `docs/docs-828/02-modules/ui.md` 已补入 0028、0031、0043 产生的稳定当前事实；0036/0037 的 `panel-tabs-region` 事实原已存在，未重复复制施工过程。
- `docs/docs-828/00-INDEX.md` 的机制迁移状态、好感 §4 状态、角色成长阶段说明和核验日期已纠正。
- `docs/docs-828/03-data-structures/player-state.md` 中的 `accountLevelCap`、`worldPool` 等“后续接入 / 未接线”内容仍属于当前预留能力，本轮不改为当前机制。
- `docs/docs-828/07-audit/` 仍是审查快照；其中“预留”“当前无消费方”“建议”不作为当前机制事实，本轮不迁移为正文。
- 仍需后续逐篇检查的混合内容主要集中在历史 audit 与尚未完成的 UI / Datapack 路线，不阻塞本轮试点停止点。

## 试点准出结果

本轮按停止点只处理 5 份试点，不继续处理其他候选：

| 原文档 | 判定 | 当前知识 | 后续工作 | 结果 |
| --- | --- | --- | --- | --- |
| `task-0028-presentation-target-inherit-only` | `CLOSING` | 已蒸馏至 `docs/docs-828/02-modules/ui` | 无 | 已移至 `completed/` |
| `task-0031-svg-button-state-color-audit` | `CLOSING` | 已蒸馏至 `docs/docs-828/02-modules/ui` | 普通按钮继续由 Task-0030 接入统一 Host | 已移至 `completed/` |
| `task-0036-switch-tabs-background-module` | `SPLIT_AND_CLOSE` | 已蒸馏至 `docs/docs-828/02-modules/ui` | Task-0037 已承接并完成后续结构收口 | 已移至 `completed/` |
| `task-0037-panel-tabs-region-structure` | `CLOSING` | 已蒸馏至 `docs/docs-828/02-modules/ui` | 无阻塞后续 | 主任务与执行清单均已移至 `completed/` |
| `task-0043-topbar-settings-workspace` | `CLOSING` | 已蒸馏至 `docs/docs-828/02-modules/ui` | 无 | 已移至 `completed/` |

### 试点验证证据

- 相关 UI 测试 8 个文件、77 项测试通过；
- `npx tsc --noEmit` 通过；
- `npm run check:architecture` 通过；
- 0036/0037/0043 原文已记录 Edge 验收；0028/0031 的任务验收以自动化测试、类型检查和架构检查为主；
- 5 份归档文档均已增加“归档结果”，并标明当前知识、设计理由和后续工作。

## 试点复盘与停止点

5 份试点完成后已停止批量准出，未继续处理第 6 份候选。

- 四项准出条件足够：`Implementation`、`Verification`、`Knowledge` 和 `Remaining work` 能覆盖本轮判断；其中浏览器验收必须区分硬性验收与非阻塞体验验证。
- 未出现无法归类的知识；`roadmap-0018-button-state-unification` 归入 `SUPERSEDED`，`newPlan/00-index.md` 明确作为导航例外。
- follow-up 拆分未造成试点碎片化：0036 → 0037 是自然的施工交接；其他待拆分文档暂未在本轮强行创建空任务。
- `docs-828` 未出现新的重复机制描述；0028、0031、0043 只补入稳定约束，0036/0037 复用已有 `panel-tabs-region` 说明。
- 归档结果模板足够使用，不需要 YAML 化。
- Task-0064 规则无需重大调整；后续扩大范围前仍应保持“准出必需事项不得扩展原任务”的边界。

该停止点已被后续「第二批扩大范围准出」取代（见下节）；复盘结论仍成立：规则无需重大调整，`CLOSING` 与 `SPLIT_AND_CLOSE` 的边界足够支撑扩大范围。

## 第二批：扩大范围准出结果

经确认扩大范围后，按同一四项准出条件与蒸馏口径处理剩余全部候选，不再逐份回禀。

### Active 准出

| 原文档 | 判定 | 当前知识 | 后续工作 | 结果 |
| --- | --- | --- | --- | --- |
| `roadmap-0013-presentation-editor-ux` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui` | Task-0065（视觉回归） | 已移至 `completed/` |
| `roadmap-0015-ui-dom-recalculation` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui` | Task-0065、Task-0067 | 已移至 `completed/` |
| `roadmap-0026-presentation-inset-decoration` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui` | Task-0065（外部光晕） | 已移至 `completed/` |
| `task-0025-selector-dynamic-theme` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui` | Task-0065 | 已移至 `completed/` |
| `task-0027-theme-switch-cleanup-and-user-theme-isolation` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui`（`activeTheme` 单一来源、`user` 独立层） | 无 | 已移至 `completed/` |
| `task-0029-button-sequence-rendering-audit` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui`（Host 覆盖边界） | Task-0030（已 active） | 已移至 `completed/` |
| `task-0033-system-color-layer-scope` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui`（系统颜色层归属） | 无 | 已移至 `completed/` |
| `task-0038-ui-conflict-audit-followup` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui`（`conversation-panel` 结构契约） | 无 | 已移至 `completed/` |
| `task-0042-character-workspace-ui-convergence` | `CLOSING` | 已蒸馏至 `docs-828/02-modules/ui` | 无 | 已移至 `completed/` |
| `roadmap-0018-button-state-unification` | `SUPERSEDED` | 已蒸馏至 `docs-828/02-modules/ui`（四态契约） | Task-0030 | 文首记录替代关系后移至 `completed/` |

### Active 拆分后归档

| 原文档 | 拆分出的后续 | 结果 |
| --- | --- | --- |
| `roadmap-0008-theme-color-system-refactor` | Task-0066（CSS 渐进迁移与 C8/C11 收尾） | 已移至 `completed/` |
| `task-0023-project-documentation-normalization` | 本任务 Task-0064 | 已移至 `completed/` |
| `task-0039-sol-review` | Task-0039（Shop P3 回填）、Roadmap-0002 | 已移至 `completed/` |
| `task-0041-character-progression-and-memory` | ADR-0008（B 段）、Roadmap-0004 | 已移至 `completed/` |
| `task-0045-ui-incremental-update-workspace-isolation` | Task-0067（P5–P6）、Task-0047（P7） | 已移至 `completed/` |

### newPlan 准出

| 原文档 | 判定 | 动作 |
| --- | --- | --- |
| `08-passive-story-sol-review` | `TRANSFERRED` | 已转 Task-0032；移至 `completed/` |
| `09-shop-transaction-draft` | `TRANSFERRED` | 已转 Task-0039 / Roadmap-0002；移至 `completed/` |
| `10-inventory-workspace` | `ADOPTED` | 稳定事实已在 `docs-828`；剩余能力拆至 Task-0068；移至 `completed/` |
| `11-gear-equipment-system` | `ADOPTED` | 稳定事实已在 `docs-828/04-mechanisms/gear`；effect 消费归 ADR-0008；移至 `completed/` |
| `12-ui-geometry-workspace-reshape` | `TRANSFERRED` | 已转 Task-0044 并完成；移至 `completed/` |
| `13-unified-workspace-refresh-boundaries` | `TRANSFERRED` | 已由 Task-0045 / Task-0047 落地；移至 `completed/` |
| `14-contacts-story-workspace-ownership` | `TRANSFERRED` | 已转 Task-0047 并完成核心迁移；移至 `completed/` |
| `15-user-theme-background-layer-manager` | `TRANSFERRED` | 已转 Task-0049 及后续任务链；移至 `completed/` |

`13` 与 `14` 在首轮报告中曾列为 `PROPOSED`；本轮据正文与源码核实，两者均已由 active Task 承接并落地主体范围，按 `newPlan` 生命周期要求一并转历史，同时修正 `newPlan/00-index.md` 原先错误的「已转 Task」/「待评审」不一致表述。

### 新建 follow-up（4 份）

- [[task-0065-ui-presentation-residual-and-visual-regression]]
- [[task-0066-theme-css-progressive-migration]]
- [[task-0067-ui-update-dispatcher-stage2]]
- [[task-0068-inventory-workspace-remaining-capabilities]]

### 索引纠偏（第二批）

| 位置 | 问题 | 处理 |
| --- | --- | --- |
| `docs/plan-work/00-index.md` | 逐条维护 P0/P1、测试数量、Edge 细节；已归档条目仍指向 active | 重建为粗粒度导航索引（ADR / Roadmap / Task / 草案 / 历史区），移除施工细节 |
| `docs/plan-work/archive/00-index.md` | 已迁移草案仍列在本目录；表头与列数不一致；「已转 Task」与正文状态自相矛盾 | 只保留仍待裁定草案，新增「已退出本目录」来源表 |
| `docs/plan-work/mechanisms/*` | 已归档文档仍标 `active`；`docs/newPlan/` 旧路径 | 修正生命周期标签与路径 |
| `docs/docs-828/00-INDEX.md` | `task-0041` 仍指向 active；ADR 表缺 0006–0012；`adr-0007` 行错置于 roadmap 表；roadmap 表与 `plan-work/00-index` 状态漂移 | 修正路径、补齐 ADR 路由、把 `adr-0007` 归回 ADR 表并声明状态唯一来源 |
| 全库交叉链接 | 30 个文档仍引用迁移文档的旧 `active/` / `newPlan/` 路径 | 统一修正为 `completed/` 路径 |
| `src/arona-clicker/content/gears.ts` | 注释引用旧 `newPlan` 路径 | 改指向 `docs-828/04-mechanisms/gear` 与归档设计来源 |

### docs-828 蒸馏（第二批）

- `docs/docs-828/02-modules/ui.md` 补入稳定当前事实：全局主题来源 `activeTheme`、系统颜色层归属、图层管理器与 `enabled` 隐藏语义、表现目标编辑器局部刷新、Host 覆盖边界；并修正 `presentation-service` 描述与 Task-0025 路径。
- 其余机制事实（选择页双缓冲、内嵌装饰线、刷新双轨、`panel-tabs-region`、Contacts / Story 所有权、Gear）经核对已在 `docs-828` 中存在，未重复写入施工过程。
- `docs-828/07-audit/` 仍按审查快照处理，不升格为当前事实源。

### 第二批验证证据

- `npm test`：157 个测试文件、1463 项测试全部通过（2026-09-15）；
- `npx tsc --noEmit`：通过；
- `npm run check:architecture`：通过；
- 全库静态链接核查：188 份 Markdown 的 WikiLink 目标全部可解析（剩余 6 处为模板占位符 `[[...]]`）；
- 文档引用的源码路径核查：现存失效路径全部位于历史文档中「已删除文件」的施工记录，非遗漏；`docs-828/03-data-structures/type-boundary-audit.md` 的 5 处均属 2026-09-02 删除记录，不改写；
- 本轮未修改运行时代码（唯一 `src/` 改动为 `gears.ts` 的注释路径）。

## 归档结果

- 当前知识已蒸馏至：
  - [[docs/docs-828/00-INDEX]]（ADR / roadmap 路由与状态来源声明）
  - [[docs/docs-828/02-modules/ui]]（本批蒸馏的 6 项稳定当前事实）
  - [[docs/docs-828/05-conventions/doc-maintenance]]（归档规则与维护触发器）
- 设计理由保留于：
  - 本文（四项准出条件、蒸馏分类、停止点与复盘结论）
- 后续工作：
  - [[task-0065-ui-presentation-residual-and-visual-regression]]
  - [[task-0066-theme-css-progressive-migration]]
  - [[task-0067-ui-update-dispatcher-stage2]]
  - [[task-0068-inventory-workspace-remaining-capabilities]]
  - `docs-828/07-audit/` 逐篇混合内容检查与 `check:docs` 最小静态检查，仍在评估后置范围，未另立实现任务
- 准出结论：
  - 原任务范围已完成；第一批试点 5 份 + 第二批扩大范围 23 份，共 28 份文档完成准出（不含本任务自身），4 份 follow-up 承接全部剩余工作

## 执行原则

- 先分类，再迁移；先纠偏，再蒸馏；
- 完成文档退出当前工作集，不等于删除历史；
- 当前知识回答“现在是什么”，历史文档回答“为什么走到这里”；
- 能通过目录表达的状态，不额外维护第二份字段；
- 能拆成新 Task 的剩余工作，不继续挂在旧 Task 上；
- 如果治理开始要求大量元数据、状态机或同步规则，停止扩张并记录后续问题。

## 验收标准

### 第一阶段

- [x] 完成 active 全量分类报告；
- [x] 完成 newPlan 全量分类报告；
- [x] 完成索引与正文明显冲突清单；
- [x] 完成 `docs-828` 过时/混合内容清单；
- [x] 选定并核实 5 份准出试点；
- [x] 未发生大规模正文迁移或批量归档。

### 第二阶段

- [x] 试点文档逐份满足四项准出条件；
- [x] 稳定当前知识已蒸馏或明确无新增知识；
- [x] 剩余工作已拆出或明确 deferred；
- [x] 新归档文档包含归档结果；
- [x] 试点流程复盘后再决定是否扩大范围。

### 第三阶段

- [x] 评估 `check:docs` 的实现范围；
- [x] 当前无必要另立实现任务；
- [x] 不在本任务中扩展为复杂文档治理系统。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/plan-work/00-index]]
- [[adr-0003-docs-restructure]]
