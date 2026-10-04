# Draft：GALHCG 活跃范围、资料审计与迁移辅助

状态：draft — 已登记调用侧事实、潜在问题与增强建议；未核对服务实现或批准施工

## 目标与边界

让 GALHCG 帮助 Agent 区分当前实现、提案与历史资料，发现文件迁移和依据变化，同时保留可追溯的历史导航。ACProgram 当前资料清理与地图数据维护由 [[task-0168-active-artifact-cleanup-and-map-reconciliation]] 规划；本 Draft 记录服务侧候选，转交 GALHCG 项目核实后再建立独立施工 Task。

观察来自 2026-10-01 对 acprogram 的实际 MCP 调用。没有据此读取或修改 GALHCG 服务源码。项目数据过期、尚未调用 refresh、以及调用侧误解均不直接定性为服务实现 bug；下表分别标注数据维护、增强功能和待复现的体验问题。

## 服务候选列表

| ID | 优先级 / 类别 | 实际观察与建议 | 后续核实和验收 |
| --- | --- | --- | --- |
| G01 | P1 / 增强功能 | overview 默认返回 4 个 historical Concept；当前 overview/search/traverse schema 没有 lifecycle 筛选参数。建议增加可选生命周期筛选或当前导航预设，历史查询保留明确入口。 | 在服务项目核实全部相关查询与游标协议；筛选结果、统计与 effective_query 一致，续页保留同一过滤条件，不丢失历史查询能力。implemented 不能等同 confirmed。 |
| G02 | P1 / 增强功能 | 全项目 unassociated 为 444，混合历史记录、兼容页、当前协作文档、图片和可选包。现有目录/Concept/role 过滤不足以表达一组稳定的活跃资料范围。建议可选范围配置或查询预设，支持历史、生成物与当前源码/文档的显式选取。 | 核实已有配置和忽略机制后确定最小扩展；返回生效范围和排除原因，区分全库与范围内统计。排除仅作用于视图，不误删历史条目或改变项目授权边界；默认兼容既有查询。 |
| G03 | P1 / 增强功能 | map_inventory 仍含已不存在的 AGENTScoci.md.outdated，而 resolve_paths 能报告旧路径不存在、新路径存在但未索引。清单盘点按设计不核对磁盘。建议提供显式只读的清单/磁盘差异审计入口。 | 能识别缺失旧路径、新增未索引路径及受影响 owner；按预算分页并报告不完整范围。普通 inventory 保持低成本，不暗中刷新清单或修改图。目录或同名匹配不能自动认定语义等价。 |
| G04 | P1 / 增强功能 | status 保存的 known_stale_owner_count 为 0，但 review_changes 对报告脚本实时发现 3 个 Evidence owner 内容变化。当前协议已说明 freshness 为历史观察，行为本身不构成错误。建议更清楚地展示“最近观察”与“本次变化审查”的区别，并提供可续读的待核对 owner 清单。 | 明确观察时间、覆盖范围及写入行为；只读审查不冒充已记录 freshness，不把未核对 owner 当 fresh；不做无预算的全库实时哈希。 |
| G05 | P2 / 增强功能 | bondDict.ts 已在摘要中标为历史表，仍以 unspecified 角色映射到当前 AffectionSystem。建议提供映射角色和依据质量的审计视图，提示未指定角色、历史资料关联和依据/摘要需要复核的候选。 | 提示只作为候选，不依文件名、路径或词语自动判废；列出 owner、当前角色与实际依据。保留机制型 Concept 和多归属 DAG，不用“文件未关联”判断其无价值。 |
| G06 | P2 / 增强功能 | 828 迁移后的矩阵、旧 Agent 归档页和 Task 0167 经 resolve_paths 返回 indexed=false / refresh_required=true。现有工具可完成迁移，但需要 Agent 手动协调旧/新 refresh、owner 审查、路径解析与更新批次。建议提供迁移工作计划辅助。 | 先核实现有 plan_map_updates 与迁移工具能力；计划显式列出旧新路径、映射损失风险、依据重新预览及批次。不得凭同名自动重绑；dry-run 与正式提交仍受现有预算约束，报告部分提交和失败范围。 |
| G07 | P2 / 潜在可修正体验问题，边界反馈已复现 | 本轮 review_changes 请求 limit=30、owner_limit=20，响应采用 limit=20、owner_limit=5；traverse 越界参数则明确拒绝。响应给出生效值，但调用侧声明未展示完整数字约束。建议明确 requested/effective 和 clamped 原因，或在超出限制时返回可理解的校验反馈。 | 在 GALHCG 项目核对实现与一致性合同；不能据此称其丢失结果。达到限制后仍能依响应游标完整续读，公开 schema、运行约束和 read_guidance 一致。 |
| G08 | P1 / 已复现的续页体验问题，服务根因待核对 | 自定义 traverse 首次查询后，立即使用返回 cursor 加 project_id、start_node_id 续页，返回 invalid_cursor / 查询条件不匹配；补回全部首次条件后可继续。期间未修改图。 | 核对 cursor 与默认参数的恢复合同：若要求重复条件，响应给出完整 continuation_arguments；若合同允许游标恢复，则修正默认参数参与校验的行为。补充非默认深度、类型和关系组合的续页测试。 |

G01 与 G02 应先讨论范围语义；G03、G04 可形成独立只读审计能力；G05、G06 在现有查询基础上辅助维护；G07 先做边界参数复现。实际实现时按独立完成定义与责任边界拆 Task。

## 已确认的项目数据维护问题

- 过期旧 File 条目与尚未索引的新路径，由 Task 0168 的 A05 处理，不作为“refresh 应自动重建语义图”的服务需求。
- concept:project-diagnostic-tooling 的过时摘要及其关联 Evidence 需要更新；源码已统计 docs-829，摘要仍描述 docs-828。这是已确认的数据过期。
- 69 个 Concept 的 lifecycle 尚未指定，需要调用方以证据整理；不能让服务凭 confirmed 或文件位置自动推断 implemented。
- 4 个 historical Concept 的归档属性已经正确登记；当前问题是默认导航范围可否更清晰，未发现依据支持删除这些概念。

## Draft → Task 准入

- [ ] 在 GALHCG 项目重新 resolve_project，读取其当前 AGENTS 与调用指引，确认正确服务项目身份。
- [ ] 核实服务当前版本、已有能力与实现，逐项确认是数据维护、文档问题、产品增强还是实现缺陷。
- [ ] 对潜在缺陷给出最小复现、预期/实际行为与分页完整性证据。
- [ ] 确定活跃范围和生命周期过滤语义，保留历史可查询性及旧客户端兼容性。
- [ ] 每项施工具有独立范围、必要测试和验收结果；实现授权与当前列表整理授权分别记录。

## 当前核验与下一步

Task 0168 已获用户授权逐步执行，以下追加其使用侧信息。本 Draft 不据此授权修改 GALHCG 服务实现；服务建议仍须转交正确项目核实。

## Task 0168 执行观察（2026-10-01）

| 阶段 | 实际结果 | 对候选的补充 |
| --- | --- | --- |
| 文件归档与 AOCI 配置退役 | 14 个文件归档，哈希 14/14 一致；本地 AOCI 服务段已备份移除。已加载会话仍公布 9 个 AOCI 工具。 | 配置落盘与客户端连接是独立状态；不能用文件已移除证明工具服务已卸载。作为调用环境限制记录，尚无证据归因 GALHCG。 |
| 文件处置后的地图准备 | 已读取 AffectionSystem context，确认旧表拥有独立 maps_to 边与 Evidence；主 Concept 的 Evidence 来自当前源码，而非旧表。 | G05/G06：迁移前记录 owner 和关系，才能区分应移除的历史映射与应保留的当前机制。文件归档本身不证明语义维护完成。 |
| 文件清单刷新 | 根范围 refresh 成功：1,255 文件、135 目录、扫描 465 ms；返回 removed_entry_count=16。File 清单前后对账确认移除 15 个旧文件路径；docs/archive 再刷新成功，85 文件、17 目录、扫描 48 ms。 | removed_entry_count 是条目统计，不能等同移除文件数。G03/G06 可增强为按节点类型列出移除量及受影响关系；当前差额根因未查服务实现。 |
| 归档范围与忽略规则 | 归档后无关联文件从 444 增至 518；旧测试报告被 test-results/ 既有忽略规则排除。 | G02：清理成功可以使全库未关联数量上升；历史资料入清单不等于需要建 Concept。归档子目录也受 Git 忽略规则影响，应回读实际清单。 |
| 旧表映射级联 | 根刷新后 bondDict 的旧 maps_to 边消失；AffectionSystem 的摘要仍含旧根路径，节点本身保留。 | G06：refresh 不推断新路径或修复摘要，后续人工维护确有必要；不要自动重绑历史原始数据到当前机制。 |
| 参数上限复现 | traverse 请求 node_limit=100、edge_limit=150 时，服务校验明确拒绝并指出上限分别 50、100；调用侧工具声明未展示这些数字约束。按上限修正后可查询。 | G07 得到进一步复现证据：review_changes 会采用较小生效值，traverse 则拒绝越界参数。建议公开一致的约束说明；目前没有结果丢失证据。 |
| 续页与查询范围 | 仅回传 cursor 与必要起点导致 G08；重复完整原参数可续页。宽查询含 File 时最终触发硬截断，取得 1,000 节点/边仍 complete=false、truncated=true；缩小为 Project/Module/Concept 后两页完成 83 节点、153 关系。 | G08 可用完整续页参数规避。G02 应更直观区分概念结构与文件范围；预算停止不能当作完整验收。刷新后旧 revision 游标同样不能继续，须重新开始查询。 |
| Evidence 与批次规划 | context 逐项读取 70 个非历史 Concept；preview_many 阅读 108 个唯一依据文件，全部令牌 available。71 个节点与 5 条边、122 个 owner Evidence 引用，经 plan_map_updates 分成 5 批；逐批 dry-run 完整有效后正式提交，全部成功。 | 现有规划工具确实能处理纯 upsert，G06 应在此基础上补迁移/删除/处置协调，避免重复实现已有能力。单 owner 不拆分、同文件多 owner 分别计数的预算说明有效。 |
| lifecycle 与角色复核 | 保留 4 个 historical Concept；68 个原 unspecified Concept 根据当前源码/测试/定义标为 implemented，Goal 工作流因流程与软件实现属性不同保留 unspecified 并说明。925 条 maps_to 的角色均已指定；664 个活跃 .ts/.css 全部映射。 | G01 的历史筛选仍有实际价值；不应强迫全部未知项变成 implemented，也不能将已实现的装备查询解释为所有声明效果已接入运行。 |
| 收尾范围补查 | docs-829 的 review_changes 还发现三篇上一轮修改文档的 6 条关系依据过期；保留原始路径后另批更新。全部写入共 8 批成功，去重 72 个节点、14 条关系；5 个关键节点显式 freshness 核验均完整 fresh。 | G04/G06：首个目标文件复核通过不足以代表整个迁移范围；需要范围复核、原 Evidence 保留与末态检查，不能只修摘要。 |
| 高连接度 owner 的依据读取 | Story、Color 与 UI 表现 Concept 的 context 请求 neighbor_limit=100，实际只返回 20 邻接且不完整；改查目标 File 的 context 后，2 个 File 分别以 2、4 邻接完整返回所需 maps_to Evidence。 | G05/G07：现有 File 中心查询可解决 owner 依据读取；read_guidance 可直接建议此路径并说明生效上限，避免反复提高 limit，或在看不全 Evidence 时覆盖旧依据。 |
| 被忽略数据的规模遗漏 | 移走 6 个已索引 AOCI 资产后，本地 .aoci 目录仍有 511 个运行文件、113,195,435 字节；其中 ledger 当日仍有写入记录。GALHCG 清单按忽略规则不展示这些文件，已另立 Task 0171 等待连接/读写核验。 | G02/G03：已保存清单与受保护范围不是磁盘全部数据。初次“14 个清理候选”只代表当时可见范围，需明确范围盲区。建议返回范围排除说明与未盘点区域，不要求 MCP 绕过忽略规则读正文；全面磁盘盘点另行授权执行。 |
| 追加任务的末态同步 | Task 0171 登记后，第 9 批仅更新规划 Module 与两条索引关系依据；预检、提交和显式 freshness 核验通过。 | G04/G06：计划文档自身的改动也能使 Entry 依据过期；末态顺序应为落盘文档/索引、同步清单、更新直接 owner、回读核验。 |

### G08 最小调用复现

在已确认项目中，首次 traverse 使用 contains、maps_to、depends_on、related_to，direction=outgoing、max_depth=6、node_limit=50、edge_limit=100。收到普通续页 next_cursor 后，立即仅传该 cursor、同一 project_id 与 start_node_id；实际返回 invalid_cursor，提示查询条件不匹配。保留同一游标并重复全部首次参数可继续。

这与刷新后 revision 变化导致旧游标失效是两个不同情形。前者期间没有图变更，需在 GALHCG 项目核对参数默认值和 cursor 恢复合同；后者应重新发起查询，不能绕过一致性校验。

## 相关路由

- [[task-0168-active-artifact-cleanup-and-map-reconciliation]]
- [[task-0167-docs-828-reference-redirection]]
- [[docs/docs-829/06-wiki/60-engineering-support/docs-tooling]]

## 重启后退役与收尾观察（2026-10-01）

- 重启后的工具清单中 AOCI 从原会话 9 项变为 0 项；GALHCG 身份解析正常。配置移除必须在重新连接后核验，不能将旧会话工具缓存误认为配置写入失败；这不是已证实的 GALHCG 缺陷。
- 511 个被忽略运行文件保持原规模，独占读取与二次哈希通过，移至项目外备份后 511/511 哈希一致。GALHCG 不承担机器服务连接/文件占用检测；清单没有展示被忽略数据符合边界，G02/G03 的范围解释增强仍有价值。
- 完成 Task 0168/0171 后进行局部文档迁移维护：先归档和更新索引，再刷新旧新范围；保留规划 Module 的全部依据及原索引关系，重新 preview 获取令牌后预检/提交。归档不是增加 Concept 的理由；机器备份不纳入地图。

本轮实际地图收据：docs/plan-work 刷新成功（297 文件、10 目录、移除 2 旧条目、扫描 107 ms），archive 独立刷新成功（286 文件、7 目录、移除 0、扫描 107 ms）。当前索引与 Goal 工作流 preview 令牌 available；1 个规划 Module、2 条既有关系、4 个 owner Evidence 完整 dry-run 有效后正式提交成功。索引 review_changes complete=true、needs_attention=0；map 搜索精确命中规划 Module，局部 contains 遍历完整返回 7 节点、6 关系且方向保持。resolve_paths 确认两份 Task 新归档路径 indexed=true、旧路径 not_found（预期结果，不是本次迁移失败）。没有新增概念或重绑历史机器文件。归档后文档检查通过：516 篇、0 errors。

### 追加体验：单文件刷新合同不一致

当前工具说明称路径参数可精确匹配单个文件，但 refresh(directory="docs/plan-work/draft-0169-galhcg-active-scope-and-audit-enhancements.md") 实际 failed / not_directory，refresh_history 保存了此失败。改用父目录 docs/plan-work 加 include 精确文件模式成功：1 文件、移除 0。该现象补入 G07 的公开说明/运行约束一致性候选，根因仍须服务项目核查。失败后未继续语义写入；本次仅同步记录清单。

review_changes 对本 Draft 返回 unreferenced_path，原因是它没有直接 Evidence 或 maps_to；这不是 fresh 或审查通过的结果。此处保留规划索引作为稳定入口，不为消除提示而新增琐碎 Concept。
