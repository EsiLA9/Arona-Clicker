# Task：docs-828 系列文档退役

状态：completed（2026-10-24）— 全部施工切片已执行并验证。

## 目标

移除 `docs/docs-828/` 兼容重定向层，使 docs-828 退化为纯历史材料（`docs/archive/docs-828-snapshot/` + REDIRECT-MAP）；活跃文档中的 docs-828 引用改写为 docs-829 承接页或历史快照路径；`npm run check:docs` 保持通过。完成后文档体系只剩 `docs/docs-829/` 一个活跃层与 `docs/archive/` 一个历史层。

## 当前事实与依据

| 已核验事实 | 依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `docs/docs-828/` 共 68 个 Markdown，全部是 2026-10-01 Task-0167 生成的兼容重定向桩，不含机制正文。 | 抽读 `docs/docs-828/00-INDEX.md`、`07-audit/affector-performance.md`、`04-mechanisms/gear.md`；[[docs/plan-work/archive/task-0167-docs-828-reference-redirection]] | 可整目录删除，无内容迁移工作。 |
| 只读历史原文完整保存在 `docs/archive/docs-828-snapshot/`（68 份原文 + REDIRECT-MAP.md）。 | 机械核对：68 个桩各自的「只读历史原文」链接全部命中快照文件；REDIRECT-MAP 表项 68 条，与桩一一对应 | 删除桩后历史追溯由快照 + REDIRECT-MAP 承接。 |
| 活跃文档对 docs-828 的引用分两类：描述性说明（"docs-828 保留为历史快照 / 兼容重定向"）与真实 WikiLink。 | `git grep "docs-828"`（排除 archive 与 plan-work/archive） | 两类引用分别处理，见施工切片。 |
| 描述性引用共 10 处文件：`docs/abstract.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/galhcg-project-map.md`、`docs/ai/prompts/local-fact-review.md`、`docs/ai/task-read-set-routing.md`、`docs/ai/context-packs/production.md`、`docs/ai/context-packs/ui-presentation.md`、`docs/ai/context-packs/world-lifecycle.md`、`docs/docs-829/00-INDEX.md`、`docs/docs-829/05-conventions/doc-maintenance.md`；另有 `scripts/check-docs.mjs` 第 4 行注释。 | `git grep -n "docs-828"` | 需改写为「docs-828 已退役，历史原文见 docs/archive/docs-828-snapshot/」。 |
| 真实 WikiLink 引用集中在 `docs/plan-work/mechanisms/` 6 份机制索引：architecture-engine、character-acquisition-growth、datapack-registry-save、review-documentation、theme-presentation-ui、world-spot。 | `git grep -n "docs/docs-828/" -- docs/plan-work/mechanisms` | 按 REDIRECT-MAP 改指 docs-829 承接页；mechanism 正文不重写。 |
| `docs/plan-work/archive/` 冻结历史中存在大量 `[[docs/docs-828/...]]` 链接；check-docs.mjs 的 R1 对包括 archive 在内的所有文件做目标存在检查。 | `scripts/check-docs.mjs` R1 实现（archive 仅豁免 R3 与 R5） | 删除桩会让冻结历史链接大量报 [R1 目标缺失]；须先在脚本中给出处理，再删目录。 |
| 快照文件与桩路径同构：`docs/docs-828/X` 均有 `docs/archive/docs-828-snapshot/X` 对应原文。 | 机械核对 68/68 命中 | R1 可用确定性前缀改写解析退役链接。 |
| `AGENTS.md` 不引用 docs-828。 | `git grep` | 无入口改动。 |
| GALHCG 语义图收录了 docs-828 全部 68 个桩为 File 节点（2026-10-01 全量刷新时入清单），全部 unmapped、无 Evidence、无 owner（0 条 maps_to 边，无 Concept/Module 以其为证据）。 | `graph_health(check="inventory", directory="docs/docs-828")`：manifest_file_count=68、maps_to_edge_count=0、evidence_file_count=0 | 删桩后需执行清单刷新把 68 个 File 节点从图中移除；因零映射零证据，不会产生悬挂 maps_to 或 Evidence。 |
| check-docs.mjs 无 docs-828 硬编码逻辑，仅注释提及。 | `scripts/check-docs.mjs` 全文 | 脚本改动限于注释与 R1 解析规则。 |

## 设计边界

- 本 Task 包含：删除 `docs/docs-828/` 全部 68 个桩；在 REDIRECT-MAP 顶部补退役说明（退役日期、旧路径不再存在、追溯入口）；改写上述 10 处描述性引用；按 REDIRECT-MAP 改写 mechanisms 6 份的 WikiLink；扩展 `check-docs.mjs` 使 `[[docs/docs-828/...]]` 以确定性前缀改写解析到 `docs/archive/docs-828-snapshot/...`（保持 R1 对退役链接的存在性校验，快照缺页仍报错）；同步更新脚本第 3–6 行注释；P3 集中执行一次 GALHCG 清单刷新（`directory="docs/docs-828"`），移除 68 个退役桩的 File 节点并复核。
- 改写引用时的路径形式：docs-829 目标统一用 vault 相对形式 `[[docs/docs-829/...]]`，不采用 REDIRECT-MAP 个别表项中的绝对仓库前缀形式。
- 明确非目标：不修改 `docs/archive/docs-828-snapshot/` 历史正文（REDIRECT-MAP 顶部说明除外）；不修改 `docs/plan-work/archive/` 冻结历史；不整理 docs-829 结构（第二项任务另行调查立项）；不改 AGENTS.md；不改产品代码与测试。
- 裁定依据：[[docs/docs-829/05-conventions/doc-maintenance]]（归档与只读历史规则）、[[docs/plan-work/archive/task-0167-docs-828-reference-redirection]]（桩与快照的生成来源）。

## 施工切片

### P0：守卫先行

- `scripts/check-docs.mjs`：R1 解析中为 `docs/docs-828/` 前缀增加退役改写（解析目标改为 `docs/archive/docs-828-snapshot/` 同子路径），注释补「docs-828 已退役」；先跑 `npm run check:docs` 确认改动后当前状态仍通过。

### P1：活跃引用改写

- 10 处描述性引用改为「已退役，历史原文见 `docs/archive/docs-828-snapshot/`」口径；`docs/docs-829/05-conventions/doc-maintenance.md` 与 `docs/docs-829/00-INDEX.md` 中的分层描述同步更新为「docs-828 已删除，仅存快照」。
- mechanisms 6 份中的 `[[docs/docs-828/...]]` 逐条按 REDIRECT-MAP 改指 docs-829 承接页；REDIRECT-MAP 未给出 docs-829 目标的表项指向对应快照原文。
- REDIRECT-MAP 顶部补退役说明段。

### P2：删除桩目录

- `git rm -r docs/docs-828`。
- 复查 `git grep "docs-828"`：活跃区（非 archive、非 plan-work/archive、非快照）应只剩「已退役」口径描述与脚本退役注释；`[[docs/docs-828/` 真实链接只允许存在于冻结历史。

### P3：GALHCG 清单刷新与验证收尾

- 按 [[docs/ai/galhcg-project-map]] 与 `.galhcg/agent-maintenance.md` 的授权时机，执行一次 `refresh`（`directory="docs/docs-828"` 即可，范围外旧 File 节点保留）把 68 个已删除桩的 File 节点从图清单移除；随后 `graph_health(check="inventory", directory="docs/docs-828")` 应返回 manifest_file_count=0，且 `graph_health(check="changed")` 复核无异常。
- `npm run check:docs`；`git --no-pager diff --check`；活跃区残留引用 grep 复核。
- 本 Task 为纯文档改动，不运行产品测试；如仓库存在针对 docs 的其他校验命令，按 `package.json` scripts 核实后一并运行。

## 测试与验收

- [x] `docs/docs-828/` 目录不存在（git rm 68 个文件）；`docs/archive/docs-828-snapshot/` 68 份原文与 REDIRECT-MAP 完整保留，顶部已新增退役说明。
- [x] REDIRECT-MAP 仍可由快照逐条追溯到 68 个旧路径的去向。
- [x] 活跃文档不再含指向 `docs/docs-828/` 的 WikiLink；描述性提及均为「已退役」口径。`review-documentation.md` 保留「docs-824 → docs/docs-828 重构」一句作为历史叙事，非当前路径引用。
- [x] `scripts/check-docs.mjs` 对退役链接按快照同子路径解析并通过（冻结历史 674 条 docs-828 链接全覆盖）；临时构造指向不存在快照页的链接时 R1 报 `[R1 目标缺失]`，验证后临时文件已删除。
- [x] GALHCG 图清单 `docs/docs-828/` 范围 manifest_file_count=0：`refresh(directory="docs")` 剪除 68 个退役 File 节点（连同 46 个此前已在磁盘消失的过期条目）；docs-828 范围内无 Evidence 与 maps_to，无悬挂。
- [x] `npm run check:docs` 通过（0 错误）；`git --no-pager diff --check` 无空白错误（仅仓库既有 CRLF 提示）。

## Read Set 与验证入口

- 文档：[[docs/docs-829/05-conventions/doc-maintenance]]；[[docs/docs-829/00-INDEX]]；[[docs/archive/docs-828-snapshot/REDIRECT-MAP]]；[[docs/plan-work/archive/task-0167-docs-828-reference-redirection]]。
- 源码/脚本：`scripts/check-docs.mjs`（R1 链接解析与注释）。
- 验证命令：`npm run check:docs`；`git --no-pager diff --check`。

## 当前核验（2026-10-24）

- 只读核对：docs-828 桩形态（抽读 3 份）、快照与 REDIRECT-MAP 覆盖（脚本核对 68/68/68）、活跃引用清单（git grep 全量归类）、check-docs.mjs R1/R3 豁免范围、AGENTS.md 无引用、GALHCG 图内索引现状（inventory 68 节点、0 映射、0 证据）。

## 实施核验（2026-10-24）

- P0–P3 全部执行。实施偏差一处：`refresh(directory="docs/docs-828")` 因目录已删除返回 not_found，改用父范围 `refresh(directory="docs")` 完成清单剪除（剪除 114 项 = 68 个退役桩 + 46 个此前已在磁盘消失的过期条目）。
- `graph_health(check="inventory", directory="docs/docs-828")` 复核 manifest_file_count=0、complete；docs-828 范围 maps_to 与 Evidence 均为 0。
- `graph_health(check="changed", directory="docs")` 显示 docs 范围共 158 条 content_changed 路径、部分带 stale evidence：其中约 19 条来自本任务编辑，其余为近几周其他施工累积的既有状态，非本任务引入的悬挂；按 [[AGENTS.md]] 健康管理约定留待统一工作节点合并处理，不在本任务内逐文件复核。
- 残留 grep 复核：活跃区仅剩退役口径描述、`scripts/check-docs.mjs` 退役规则与注释，以及 `review-documentation.md` 一句历史叙事。

## GALHCG 影响闭环

- 发现路径：项目身份沿用当前会话已确认的 `acprogram`；以 `docs-828` 字面量 grep 与文件清单机械核对，图侧用 `graph_search(target="graph")` 与 `graph_health(check="inventory", directory="docs/docs-828")` 只读确认索引现状（68 个 File 节点、0 映射、0 证据）。
- 收尾健康管理：P3 集中执行一次 `refresh`（`directory="docs/docs-828"`）移除 68 个退役 File 节点，再以 `graph_health(check="inventory", directory="docs/docs-828")` 与 `graph_health(check="changed")` 只读复核；不在施工中逐文件反复刷新或检查。
- 地图维护：本 Task 写作与调查阶段不授权图编辑；P3 的刷新属于退役影响的合并收尾，执行时遵守 [[docs/ai/galhcg-project-map]] 与 `.galhcg/agent-maintenance.md`。

## 剩余工作

- 本 Task 施工与验证已全部完成；无遗留施工项。
- 第二项任务（整理 `docs/docs-829/` 系列）另立调查立项；届时 mechanisms 6 份索引与 docs-829 分区结构是主要输入。
- docs 范围 GALHCG stale evidence 积压（changed 复核 158 条，多为其他施工累积）待统一健康管理节点合并处理。

## 相关路由

- [[docs/plan-work/archive/task-0167-docs-828-reference-redirection]]
- [[docs/docs-829/05-conventions/doc-maintenance]]
- [[docs/ai/galhcg-project-map]]
