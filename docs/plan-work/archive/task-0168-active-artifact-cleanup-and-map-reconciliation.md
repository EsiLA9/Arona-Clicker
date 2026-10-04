# Task：活跃资料清理与 ACProgram 地图对账

状态：done — A01–A08 已完成；重启后连接核验通过，运行产物由 Task 0171 退役

## 目标与边界

减少当前工作目录和 GALHCG 默认导航中的过时数据，保留当前事实入口与可追溯的历史资料。2026-10-01 用户授权逐步执行本 Task，并将实际使用信息持续记录到 Draft 0169。优先采用可回溯归档保留工作区现有内容；不覆盖既有未提交变更。

项目清理、当前地图维护由本 Task 规划。GALHCG 服务实现的潜在缺陷与增强功能另见 [[draft-0169-galhcg-active-scope-and-audit-enhancements]]；在 GALHCG 项目核实后另立施工 Task，不在 ACProgram 中修改该服务。

不以未关联文件数量、Concept 数量或层级深度作为删除目标。当前机制事实仍来自源码、测试与 docs-829；归档正文保持冻结。装备效果的运行接入属于独立机制决策，本 Task 只安排事实调查与裁定交接。

## 已核查基线（2026-10-01）

- GALHCG resolve_project 确认当前工作目录属于 acprogram；图 revision 为 5930。overview 全部分页读取 8 个 Module、74 个 Concept；map_inventory 全部分页读取 1,182 个清单文件，其中 444 个无 maps_to 或 Evidence 关联。
- 对全部清单路径核对磁盘存在性，仅旧根路径 AGENTScoci.md.outdated 已不存在；新归档路径、828 迁移矩阵与 Task 0167 经 resolve_paths 确认存在但尚未入清单。
- 74 个 Concept 的 lifecycle 为 unspecified 69、implemented 1、historical 4。confirmed 是依据确认状态，不代表当前已实施。
- review_changes 对 scripts/report-doc-context.mjs 返回 content_changed：工程支持 Module、诊断工具 Concept 和对应 maps_to 边共 3 个 Evidence owner 受影响。地图摘要仍称统计 828；preview 核实当前脚本已统计 829。
- root bondDict.ts 无 export、未发现当前调用方；其 100 项经验阈值与 src/arona-clicker/services/affection-system.ts 的 DEFAULT_AFFECTION_EXP_CURVE 逐项一致。现有地图仍把旧表映射到 AffectionSystem，角色为 unspecified。
- 14 个清理候选文件由 AOCI 6 个文件、旧测试报告、旧 AGENTS 备份、5 个一次性迁移脚本和 bondDict.ts 组成。清理建议不等于已删除或已经裁定其所有历史价值。

## 任务列表

| ID | 优先级 / 当前状态 | 工作与证据 | 完成定义 |
| --- | --- | --- | --- |
| A01 | P0 / 已完成，重启后连接核验通过 | 统一退役 aoci.txt、aoci.code.txt、aoci.meta.txt、.aoci/config.json、.aoci/baseline.json、.aoci/.gitignore；合计 546,194 字节。核对 .codex/config.toml 中 mcp_servers.aoci、当前客户端仍提供的 9 个 AOCI 工具，以及 docs/ai/goal-workflow.md 等现行说明中的 AOCI 权威措辞。 | 当前入口不再依赖 AOCI；数据、配置和说明处置逐项登记。只处理 AOCI 配置段，保留其他服务配置；客户端重新连接后的工具状态单独记录，文件改动不自动证明服务已断开。 |
| A02 | P0 / 已完成归档 | 处理根目录 .vitest-report.json 与 AGENTS.md.backup.20260917_130823.ba5df314d1b8d796ac64ad9cd6b40d7744d1906f85cd77424e29f034742fb274。报告记录 2026-09-10 的 1,246 项测试与 1 项失败；备份仍把 828 作为唯一事实源。 | 决定删除或只读归档，记录去向；根目录只保留当前协作入口，旧报告不充当当前验收依据。 |
| A03 | P0 / 已完成归档 | 归档一次性脚本 scripts/_refactor-move-engine.mjs、scripts/_fix-engine-imports.mjs、scripts/_fix2-engine-imports.mjs、scripts/_fix3-engine-imports.mjs、scripts/_fix-docs-engine-paths.mjs。未发现现行入口调用；最后一个硬编码不存在的 docs-818。 | 核对引用后统一移入明确的历史工具目录或删除；当前 package 入口不受影响，历史用途有简短记录。不要重新运行这些写入脚本来验证。 |
| A04 | P1 / 已完成归档与映射修正 | 处置重复的 bondDict.ts，保留当前 AffectionSystem 的经验曲线；核对测试说明中残留的 bondDict 名称，以及现有地图的旧表映射。 | 旧表退出当前代码导航；当前曲线与机制测试保持有效，地图保留 AffectionSystem 稳定 ID 并优先指向当前实现。历史出处是否保留须明确登记。 |
| A05 | P0 / 已完成对账，持续同步记录 | 同步已发生和 A01–A04 引起的文件变化；复核旧、新归档目录和文档入口，修正诊断工具摘要及其 3 个受影响 Evidence owner。 | 首次重新 resolve_project；刷新旧、新受影响范围，检查可能级联移除的映射；map_inventory / review_changes 对账。写入按当前令牌逐批 dry-run 后提交，回读确认旧路径失效条目已处理、当前入口可发现。历史材料是否索引另行说明。 |
| A06 | P1 / 已完成核查 | 对 69 个 unspecified Concept 分批核对 lifecycle；复核 4 个 historical Concept 的默认导航位置和用途；审查旧表、历史文档和当前实现的映射角色。 | 只依据实际实现/提案/历史事实赋值；未知保留并说明。保存有效 ID、依据与关系，contains 无环；历史节点继续可查询，当前导航有明确入口。 |
| A07 | P2 / 调查完成，语义转交 Draft 0170 | 调查 GearSystem.effectsOf 与 ColorEquipmentSystem.effectsOf 的运行消费者。当前静态搜索发现定义和测试调用，尚未发现生产调用；装备展示、成长和色彩外观仍有消费者。 | 给出消费者、数据流及可观察行为证据；裁定继续作为查询声明、另立接入任务或另立删除任务。不能据此删除整个装备机制；任何机制改动另立 Task 并安排对应测试。 |
| A08 | P2 / 已核对，保留忽略边界 | 核对被忽略的 .qoder、.codebuddy、.zcode 影子资料是否仍被相关工具使用：分别 126、8、8 个文件，共 2,994,956 字节。抽查包含旧源码路径；未进入当前 GALHCG 清单。 | 明确使用方与保留/归档策略；有活跃工具消费者时保留其必要数据，不为追求整齐移走机器配置或自动生成目录。 |

推荐顺序：A01–A03 完成文件处置决定，A04 核对重复数据；A05 跟随每次文件变化对账；A06 在清单稳定后执行。A07、A08 可独立调查，后续独立责任或机制施工必须另立文档。

## 验收与收尾

- [x] 每个清理候选记录保留、归档或删除结果；有效当前入口与历史出处仍可访问。
- [x] AOCI 数据、现行说明、机器配置和实际工具连接状态分别核验，未完成项明确列出。
- [x] 当前概念摘要与直接 Evidence 对应实际文件；新增/删除/移动文件的清单变化已复核。
- [x] 地图写入完整预检有效，按批次提交；回读搜索、映射及结构，无新增 contains 环。
- [x] 运行 npm run check:docs；若实际改动机制、契约或配置，按对应 Read Set 执行必要检查，记录结果与限制。
- [x] 最终核验后归档本 Task、更新 00-index，并维护受影响地图 Entry；服务增强建议的状态另由 Draft 0169 跟踪。

## 当前核验与剩余工作

已重新 resolve_project，确认 acprogram 根路径；核对工作区既有变更、现行引用和 AOCI 本地配置。后续步骤的实际收据追加于下方；每次写图重新取得依据令牌。

## 执行切片与记录（2026-10-01）

执行白名单为 A01–A04 所列源文件及对应归档副本、.codex/config.toml 中 AOCI 配置段、.gitattributes 注释、.gitignore 中退役目录规则、docs/ai/goal-workflow.md、docs/ai/task-read-set-routing.md、tests/engine/affection-system.test.ts 中旧表名称说明，以及本 Task、Draft 0169、计划索引与归档处置说明。地图修改限定 acprogram 的清单和已核实语义数据。

- 文件切片：分组归档 AOCI、旧报告/协作备份、迁移脚本与重复表；逐组核对路径、源/目标哈希和当前引用。迁移脚本不执行。
- 规则切片：移除本地 AOCI 服务段，保留恢复副本；更新现行协作说明，保留 Git 换行规则的实际行为。
- 地图切片：先读取迁移涉及的 owner，刷新旧新范围；按当前 preview 证据完成批次预检、写入、回读。
- 调查切片：核对装备效果与影子资料消费者；记录保留边界，不引入未经裁定的机制变化。

各切片的完成、受限项和 GALHCG 体验分别追加到本节及 Draft 0169。

### 文件与规则切片收据

- A01–A04 所列 14 个文件已移入 docs/archive/retired-assets-2026-10-01，共 993,716 字节；manifest.json 记录每项源/目标及 SHA-256，迁移前后 14/14 一致。没有回退或覆盖原有 AOCI 未提交内容。
- .codex/config.toml 的 AOCI 服务段已移除；完整原文件先备份至本机忽略路径 .codex/config.toml.backup.retired-aoci-20261001，哈希核对通过，段外内容保持一致。当前会话仍公布 9 个 AOCI 工具，未调用这些工具；服务是否在新会话移除待客户端重新连接核验。
- 更新 goal-workflow 与 task-read-set-routing 的当前协作说明，移除 AOCI 的认知建立和完整 Overview 维护要求；.gitattributes 只改解释文字，LF 行为保持。旧表相关测试名称改为实际 DEFAULT_AFFECTION_EXP_CURVE，断言与机制均未改动。
- 文件切片结束时，地图中 bondDict 的旧映射及摘要仍待 A05 对账；该项随后已完成，结果见地图切片收据。

### 地图与调查切片收据

- 根范围 refresh 成功，1,255 文件、135 目录，扫描 465 ms；docs/archive 的独立 refresh 成功，85 文件、17 目录，扫描 48 ms。前后 File 对账移除 15 个旧路径，其中 14 个为本次归档、1 个为之前已移动的旧 Agent 指引；refresh 返回移除条目 16，口径不能等同文件数。
- 根刷新级联移除了 bondDict 的旧映射，随后修正 AffectionSystem 摘要，保留稳定 Concept ID。没有为归档表自动重绑新的实现映射。
- 按 context 阅读 70 个非历史 Concept，使用 preview_many 取得 108 个唯一依据文件的当前令牌。71 个节点、5 条边共 122 个 owner Evidence 引用由 plan_map_updates 分成 5 批；逐批完整 dry-run 有效后提交，全部成功。
- 随后根据 review_changes 补正计划 Module、2 条 contains 与计划索引 maps_to 的依据，并明确 Gear/ColorEquipment 效果查询只返回声明；第 6 批（3 节点、3 边、7 Evidence）预检与提交均成功。合计去重修订 70 个 Concept、2 个 Module、8 条边，未新增/删除 Module 或 Concept。
- Concept lifecycle 现为 implemented 69、historical 4、unspecified 1。68 个原 unspecified 节点根据当前实现、定义和测试取得 implemented；Goal 与 Task 工作流是现行协作协议，不能由文档存在性推断软件实现生命周期，保留 unspecified。
- 925 条 maps_to 的角色均已指定；现行 .ts/.css 范围排除历史归档与构建产物后为 642 个 .ts、22 个 .css，映射 664/664，缺项为 0。归档新增文件不作为当前代码覆盖目标。
- A07 的静态调查已交接 [[draft-0170-equipment-effect-consumption-boundary]]；保留已有查询与装备数据，运行接入/内容收益描述尚未裁定。A08 核对现行代码和项目路由未引用三套影子资料；外部工具消费者无法由仓库证明，决定继续保留在既有忽略范围，不移入当前文档或地图。
- 验证：好感定向测试 17/17 通过，npx tsc --noEmit 通过；第一次文档检查通过（514 篇、0 errors），最终追加记录后另作终态文档检查。没有改动运行时机制。
- 已将参数上限、游标恢复、硬截断、迁移级联、归档指标与批次规划等实际观察补入 Draft 0169；该 Draft 的服务候选现为 8 项，未修改 GALHCG 服务源码。

### 待完成的外部核验

本地 AOCI 配置停用与资产归档均已完成；当前已加载会话仍公布原有工具。需在客户端重新连接后检查实际工具清单，不能由本轮配置修改声称服务已断开。本 Task 保持 active，待该项核验后记录末态、归档并再次维护计划索引及相关 Evidence。

### 收尾补充核验

- 第 7 批同步末态计划索引的 Module 与两条关系依据。随后 review_changes 对 docs-829 发现上一轮迁移留下的三篇文档、6 条关系依据变化；阅读当前文档并保留所有原始 Evidence 路径后，第 8 批（6 边、7 Evidence）预检和提交成功。8 批均成功，本次累计去重修订 70 个 Concept、2 个 Module、14 条关系；refresh 另移除 1 条历史旧表映射。
- 搜索回读确认 AffectionSystem、诊断工具、Gear 与历史节点可发现。限定 Project/Module/Concept 的结构遍历两页完成，83 节点、153 关系，其中 83 条 contains，未发现环；File 映射通过各 Concept 的 files 视图独立读全。
- 对 AffectionSystem、诊断工具、工程支持、规划记录与 Goal 工作流五个节点显式 verify_freshness，均 complete=true / fresh；此结果仅代表此次观察时刻，未声称全库所有关系依据都已核验。
- 本次清单同步后 status 为 1,256 文件、8 Module、74 Concept、1,100 条语义关系，其中 maps_to 925、depends_on 52、related_to 18、contains 105。清单变化与概念结构遍历是不同口径，不能直接混用。
- 新增 Draft 0170 及持续修改的 Task / Draft 已通过 docs/plan-work 范围刷新同步；最终链接和格式检查结果由本节继续记录。
- 终态文档检查通过：515 篇 Markdown，0 errors；相关 tracked 文件 git diff --check 通过，4 篇新增/工作文档的尾随空白检查为 0。14 份归档哈希再次核对全部一致，原路径全部退出活跃目录。本机全局 Codex 配置未发现 AOCI 服务段，未修改全局配置；本轮仅能确认项目配置停用，客户端仍载入的工具状态留待重连核验。
- 补查被忽略目录时发现 .aoci 还保留 511 个运行产物、113,195,435 字节（约 108 MiB），ledger 最近写入为当日 10:33。之前的可见清单审查未覆盖这批数据；本轮未移动或删除它们。已另立 [[task-0171-retired-aoci-runtime-artifacts]]，待连接/读写状态核验后备份处置。A01 不能被解释为全部机器产物已经退役。
- 登记 Task 0171 后，第 9 批再次同步计划索引相关 Module 与两条关系的依据，完整预检和提交通过；规划 Module 再次显式核验为 fresh。9 批合计去重修订量保持 70 Concept、2 Module、14 条关系，既有 ID 与关系方向保持。
- 加入 Task 0171 后再次执行文档检查，通过（516 篇 Markdown、0 errors）。AOCI 重连核验和 Task 0171 的机器产物处置仍未完成，未归档本 Task。

## 相关路由

- [[task-0167-docs-828-reference-redirection]]
- [[task-0166-galhcg-typescript-css-full-file-coverage]]
- [[draft-0169-galhcg-active-scope-and-audit-enhancements]]
- [[docs/docs-829/05-conventions/doc-maintenance]]
- [[docs/docs-829/06-wiki/60-engineering-support/docs-tooling]]

## 重启后收尾（2026-10-01）

用户重启 ChatGPT Desktop 并授权继续完成。当前客户端工具清单中 AOCI 为 0 项，GALHCG resolve_project 仍确认 acprogram 的正确根目录；进程命令行检查排除本次检查进程后未发现 AOCI 匹配项。此为当前可观察状态，不保证其他外部程序永远不会重新启动。

Task 0171 已将 511 个运行文件、113,195,435 字节移至项目外 ACProgram-local-backups/aoci-runtime-20261001；迁移前后逐文件 SHA-256 全部一致，原 .aoci 路径不存在。原有 14 个可见资料归档保持不变。装备机制决策仍留在 Draft 0170，服务增强仍留在 Draft 0169，均不阻碍本 Task 的清理范围完成。

本 Task 与 Task 0171 以完成状态归档；计划索引同步后通过 GALHCG 局部刷新、当前 preview 令牌、完整 dry-run 和正式提交维护直接 owner，并以 review_changes 回读核验。最终实际结果随本轮交付报告给出；没有把服务建议视为已实现，也未修改运行时机制。

归档前最终核验：npm run check:docs 通过，516 篇 Markdown、0 errors；当前连接核验与备份 511/511 哈希核验通过。
