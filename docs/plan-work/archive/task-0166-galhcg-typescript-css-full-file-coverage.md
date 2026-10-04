# Task：GALHCG `.ts` / `.css` 文件全量语义映射

状态：done — 2026-09-30；acprogram 清单中的 665 个 `.ts` / `.css` 均有直接 `maps_to`，回读缺项为 0

## 目标

在 GALHCG 的 ACProgram 项目图中，为项目清单里的每个 `.ts` 与 `.css` 文件建立至少一条有源码依据的 `Concept → File` `maps_to` 关系。完成后，Coding Agent 能从职责概念定位实现、测试、工具和样式入口，并能沿实际依赖与跨概念联系继续检索。

“全量”按目标扩展名的文件路径覆盖率验收；不表示每个文件各建一个 Concept。优先复用准确的现有节点，只有稳定职责尚无导航入口时才新增 Concept。

## 当前基线（2026-09-29）

项目身份由 GALHCG MCP `status` 确认：`project_id="acprogram"`，根目录为 `C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram`。完整分页读取 `list_files` 得到 1,180 个文件。

| 范围/口径 | 数量 | 说明 |
| --- | ---: | --- |
| `.ts` 文件 | 643 | 来自当前 MCP 清单 |
| `.css` 文件 | 22 | 来自当前 MCP 清单 |
| 本 Task 目标文件 | 665 | `.ts` + `.css` |
| 已有目标文件 `maps_to` 覆盖 | 83 | 83 个 `.ts`，0 个 `.css` |
| 缺少直接 `maps_to` 的目标文件 | 582 | 560 个 `.ts`，22 个 `.css` |
| 当前全图映射文件 | 104 | 所有扩展名的唯一 `maps_to` 目标数 |
| 当前全图关联文件 | 114 | `maps_to` 与 Evidence 文件的并集 |
| 当前全图未关联文件 | 1,066 | MCP `status` 口径，不等于本 Task 的缺口 |

当前图有 6 个 Module、33 个 Concept、227 条关系。`status` 将 Evidence 关联也计入 `associated_file_count`；因此本 Task 以 `map_view(view="files")` 汇总出的直接 `maps_to` 文件路径集合验收，不能用 `associated_file_count` 代替目标覆盖数。已有 5 个 `.ts` 仅作为 Evidence 出现、还没有直接 `maps_to` 关系，仍属于本 Task 的目标缺口。

## 范围与边界

- 仅操作已确认根目录的 `acprogram` 项目；后续每次多项目 MCP 调用显式传 `project_id="acprogram"`。
- 目标集合取自完整的 GALHCG MCP 文件清单，扩展名按大小写不敏感匹配 `.ts` / `.css`。纳入清单中的 `src/`、`tests/`、`tools/`、仓库根目录、配置及生成文件；不得按目录名或文件名猜职责。
- 只维护 GALHCG 语义图，不改 ACProgram 源码、测试、CSS 或业务文档，不直接修改 SQLite。
- 保留有效的 Module、Concept、ID、摘要、关系与 Evidence。只在依据确认重复或失效时才改动既有内容。
- 若任务执行期间出现文件新增/删除，仅刷新受影响目录后重读清单；没有清单变化时不做全项目 refresh。

## 映射约定

- 每个目标文件至少成为一条有效 `maps_to` 边的目标。先阅读候选文件，再依据真实职责选择现有 Concept；同一文件可被多个 Concept 共享，但每条映射都要说明实际支撑关系。
- `.ts` 的实现、测试、工具/生成逻辑按事实标注 `implementation`、`test` 等角色；`.css` 作为其承载界面的 `implementation` 映射。只有无法核实角色时才使用 `unspecified`，并在批次记录中说明原因。
- 测试文件映射到其实际验证的概念；fixture/helper 依据其调用者归属。工具脚本、构建配置和生成代码映射到对应工具链或契约概念，不因路径位于 `tools/` 或文件名含 `config` 就统一挂到一个节点。
- CSS 需结合选择器、token、自定义属性、导入关系和运行时宿主判断归属。共享主题/全局样式可由多个 Concept 共享；不得将全部 CSS 泛挂到一个 UI 节点。
- 只有稳定且可检索的职责没有现有 Concept 承载时才新增 Concept。摘要以职责主体开头，说明主要输入、结果或副作用，并链接到确实支撑它的文件。禁止每文件一个 Concept、AST/符号清单式建图、按文件夹机械造层级。
- `contains` 只表达真实组成与归属；`depends_on` 只表达源码或数据流可确认的直接方向；`related_to` 只记录有实际导航价值的联系。不得为提高边数而互连节点。
- 新增/修订的 confirmed 节点和关系必须先经 MCP `preview` 取得当前 `version_token`；证据不足时标为 `tentative` 并写清不确定处，不编造路径或令牌。

## 执行阶段

1. **冻结清单基线**：重查项目身份和 `status`；完整读取 `list_files`，严格跟随每页返回的 `next_offset`，直到 `null`。记录 `.ts`、`.css` 总数和清单完整性，并逐个核对当前直接映射情况。
2. **按职责分组阅读**：结合 `overview`、Concept `map_view`、语义搜索、文件搜索和 `preview` 组织候选组。先核对现有 Concept 与上下文，再决定复用、修订或新增；CSS 组同时追查使用该样式的宿主/组件。目录仅作为分批边界，不作为职责证据。
3. **建立写入批次**：逐文件通过 `resolve_paths` 取已索引 File ID；用 `preview` 取得各目标文件令牌。每批记录路径、Concept owner、关系角色、依据令牌及共享映射理由。`update_map` 单次证据引用总数不得超过 32，节点、结构边和文件边的 Evidence 均计入预算。
4. **预检并提交**：每批先调用 `update_map(dry_run=true)`；修复校验错误后再提交同一批。端点按依赖顺序创建；不要将尚不存在的节点放入先行批次。不得直接写 SQLite。
5. **分片回读与检索验收**：提交后用 `context`、`map_view(view="files")`、`search(mode="map")` 与完整 `traverse` 回读。按文件路径集合比较目标清单与所有 `maps_to` 目标；对每种文件来源至少跑一条检索样例，确认 Concept 能引到正确的实现/测试/样式文件。

预计当前至少有 582 条缺失文件映射；仅按 32 条证据引用上限计算，文件边需要至少 19 个写入批次，若还需创建 Concept 或 contains 边则批次会更多。每批均需单独 dry-run，不以边数代替 Evidence 预算。

## 覆盖工作表

以下是当前缺少直接 `maps_to` 的文件数，用于分波次跟踪；实际 owner 必须经内容核实。

| 波次 | 基线缺口 | 状态 | 备注 |
| --- | ---: | --- | --- |
| `src/**/*.ts` | 373 | 完成 | 按领域职责分组；产品数据、服务、Engine、UI 与工具入口均有 Concept owner |
| `tests/**/*.ts` | 162 | 完成 | 按测试断言和被测对象映射，角色为 `test` |
| `tools/**/*.ts` | 22 | 完成 | 区分 Schema 同步、独立编辑器实现与测试 |
| 根目录 `.ts` | 3 | 完成 | 配置按构建/测试用途映射；`bondDict.ts` 保留为未确认活跃调用的 Affection 参考 |
| 全部 `.css` | 22 | 完成 | 按 CSS 导入和实际 UI 宿主映射，角色为 `implementation` |
| 全量集合对账与查询验收 | 665 个目标路径 | 完成 | 目标映射 665/665，缺项 0，越界目标 0；共享 owner 不重复计算文件数 |

## 验收标准

- 最终 MCP 清单完整分页到 `next_offset=null`；报告施工前后实际 `.ts` / `.css` 数量。若清单变化，按新集合重新计算覆盖率。
- 每个目标路径至少有一条有效 `Concept → File` `maps_to` 关系；目标路径集合与清单中的 `.ts` / `.css` 集合完全相等，缺项为 0，越界目标为 0。
- 按扩展名、路径分区和 `maps_to` 角色分别报告唯一文件数；同时单独报告全部扩展名的 `mapped_file_count`、`associated_file_count`、`unassociated_file_count`，不把它们混作本 Task 覆盖率。
- 每条新映射都有实际文件依据和正确角色；每个新节点均有可回读的来源摘要；没有按文件逐节点建图、虚构职责或为凑深度添加 Concept→Concept `contains`。
- 所有写入批次的 `dry_run` 均返回有效；回读的目标 Concept、关系方向、File ID、路径、Evidence 和批次完整性均可读取。`contains` 图无环；依赖方向与源码一致。
- 样例检索至少覆盖产品实现 `.ts`、测试 `.ts`、工具/根目录 `.ts`、组件 CSS 与共享 CSS；每例记录查询词、命中 Concept、`map_view` 文件入口和源码核对结果。
- 目标扩展名覆盖达到 100% 后才可完成 Task。若有路径无法预览或无法判断 owner，列明路径与阻碍，Task 保持未完成，不把它们从分母中静默删除。

## 最终报告

记录确认的 `project_id`/根目录、完整清单总数、`.ts`/`.css` 的映射前后数、Concept 和关系增改数量、Evidence/角色分布、dry-run 与回读结果、查询样例、未解决路径及仍未关联的其他扩展名文件数。只报告 MCP 实际返回和源码核实的结果；本 Task 不以图结构验收代替运行时测试，也不声称代码行为因此改变。

## 本次施工结果与验收（2026-09-30）

- MCP `status` 确认 `project_id="acprogram"`，根目录 `C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram`；完整 `list_files` 逐页跟随返回的 `next_offset`，6 页读完 1,180 个文件、114 个目录。文件清单与源码无增删，未刷新项目清单。
- 目标集合仍为 643 个 `.ts` + 22 个 `.css` = 665。起始直接 `maps_to` 覆盖 83，缺 582；最终 `map_view(view="files")` 的去重路径集合与目标集合完全相等：665/665，缺项 0、越界 0。
- 施工前后：6→7 Module、33→68 Concept、227→1,026 semantic edges。新增 1 个 `module:engineering-support`、35 个 Concept；没有删除既有 Module 或 Concept。关系最终为 `contains` 98、`maps_to` 865、`depends_on` 52、`related_to` 11。`maps_to` 唯一文件数 104→686；MCP status 的 Evidence/映射关联文件数 114→691，未关联文件 1,066→489，三种计数仍分别报告。
- 目标路径唯一文件角色为 `implementation` 458、`test` 206、`unspecified` 1；22 个 CSS 全部是 `implementation`。唯一 `unspecified` 是 `bondDict.ts`：表内容属于 Affection 阈值，但 `search(mode="source", query="bond2exDict")` 未找到当前 TypeScript 调用方；它映射到 `concept:affection-system` 作为参考，不声称运行时会使用它。
- 三个只读子 Agent 分别审计 AronaClicker 领域（160 个 `.ts`，135 个缺口）、Engine/Data Services（135 个 `.ts`，113 个缺口），以及 UI、测试、工具、根配置和 CSS（364 个目标文件，328 个缺口）。随后由主 Agent 对照各分区清单统一分配 owner、修正共享 fixture/公共类型/样式宿主的归属并独占写图。
- 增补包含 19 个职责型领域/服务入口、事件/统计/Extra/会话与 Datapack I/O 等 Engine/Data Services 入口、工作区/表现/剧情聊天/两种不同编辑器 UI，以及构建与测试基础设施；Concept 均直接置于职责 Module 下，没有按文件造点。新增 20 条有源码依据的 `depends_on` / `related_to`，并保留既有有效关系。
- `update_map` 的 4 个节点/结构批次、27 个主映射/语义关系批次及 6 个核实修正批次都先 `dry_run=true` 再提交；每批最多 28 条 Evidence（服务硬上限 32）。所有最终提交批次均成功，修正后的预检均有效。
- 回读覆盖检查遍历全部 68 个 Concept 并完整汇总其 `maps_to` 文件；结构遍历两页返回 76 个 Project/Module/Concept 节点和 76 条 `contains` 边，无环。35 个新增 Concept 的 `context` 均可读，state 为 `confirmed`，父节点和节点 Evidence 完整；6 个大节点的 context 文件段报告 `source_section_incomplete`，因此完整文件清单改由 `map_view(view="files")` 验收。
- 检索样例：`Datapack Package I/O` 命中 ZIP/fragment parser 与 archive writer 及其测试；`AffectionSystem` 命中服务、内容、状态与测试；`UI Presentation Layer` 命中 UI 源码、CSS 和测试；`Datapack Editor UI` 命中独立 `tools/datapack-editor/` 实现与测试。搜索命中后 `map_view(files)` 返回预期路径与角色。
- 未运行代码测试：本 Task 只维护 GALHCG 语义图和计划记录，不改源码，也不声称游戏运行行为变化。代码导航是否提高未来 Agent 的真实入口命中率，仍需在独立需求任务中做命中/遗漏对照。

## 相关路由

- [[draft-0165-affector-condition-freshness-and-galhcg-knowledge-graph]]
- [[docs/docs-829/00-INDEX]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/docs-829/05-conventions/doc-maintenance]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/task-read-set-routing]]

## 更正（2026-09-30）

将本 Task 归档后，按文件清单维护约定刷新 `docs/plan-work`。刷新后的 MCP `status` 为 1,181 个清单文件、114 个目录，`mapped_file_count=686`、`associated_file_count=691`、`unassociated_file_count=490`。新增进入清单的是归档后的 Task Markdown；643 个 `.ts`、22 个 `.css` 及其 665/665 直接映射覆盖均未变化。
