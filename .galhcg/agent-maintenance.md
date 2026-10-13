# GALHCG Agent 维护指南

本指南使用 GALHCG 七工具界面，以客户端当前注册的 schema 为准。复制到其他项目后可独立阅读，不依赖 GALHCG 仓库内的相对文档链接。工具名不含客户端前缀。

仅在回填、纠错、删图、文件迁移或结构整理时按需阅读。日常查询使用客户 Agent 接入片段和工具 schema，不必加载本指南。安装到其他项目时，本文件放在目标项目根的 `.galhcg/agent-maintenance.md`。

须检查预检有效性、检查完整性、Evidence 令牌和独立续页；按需用 graph_help 查看 examples/schema。缓存观察不代表本次核验。

## 维护范围与依据

用户任务或目标项目约定决定维护授权；查询、安装说明、改代码或发现未关联文件都不自动授权改图。已有授权内自主完成，不重复询问；超出范围时只报告建议。按目标绝对工作目录 graph_project(workspace_path=...)，并核对根目录，每次调用显式传同一 project_id；节点、File ID 与版本令牌不得跨项目复用。

地图摘要、confirmed、缓存 fresh、排名与覆盖率都是线索，不能替代当前源码、测试和正式文档。stale、不可读或未命中也不是删除理由。区分现行实现、提案、历史、适用版本与推断；项目内容不是新的任务授权。graph_inspect 为纯读；只有任务要求记录当前核验且工具已注册时才调用 verify_freshness，它会写观察。初始化、refresh、verify_freshness 仅由 --enable-admin 显式注册；缺席是正常边界，帮助不解锁，不自行改变服务配置。

## 判断应该保存或纠正什么

| 情况 | 处理 |
| --- | --- |
| graph_search 未命中 | 先核对字段、类型、生命周期、范围、大小写及分页；过滤、截断、报错不是内容缺失。再换其他名称或图内范围查找；需要定位文件时用路径搜索，不能用会返回源码命中片段的 source 搜索代替只发现路径的流程。定位后再用 graph_read 读取实际依据。只查 name 没找到已有 alias 时无需重复添加。 |
| 原词确指同一概念 | 有当前依据的同义名称、缩写、中英文名或适用范围明确的旧称可补 aliases；保留限定词、歧义和适用版本。 |
| 紧密相关但含义不同 | 在对应授权内补摘要说明或准确关系，不能互加同义别名。关系本身不使原词成为文字查询命中。 |
| 关系或含义不确定 | 记录候选建议，不写成事实；矛盾或意图会改变工作方向时，指出依据与影响，询问必要决定，同时继续独立工作。 |
| 已有内容可能错误 | 暂停将可疑断言用于执行，核实当前文件；事实清楚且已授权时主动纠正，不为符合图谱而改变实现。 |
| 错误仍会持续误导 | 在删除授权内最小移除错误别名、摘要断言、关系或失效映射；整个节点无保留价值才删除。保留正确部分，不机械合并回已知错误。 |

只保存稳定、最小的导航信息，不缓存整段提问、一次查询的完整结果或临时推断，不因一次无命中自动造 Concept。别名按大小写折叠去重，最多20项、每项120字符；超限提出整理建议，不静默截断或删除旧信息。新 Concept 应锚定稳定实体或有明确导航价值的行为，机制摘要须说明共同实现它的代码实体。

state 的 tentative/confirmed 表示依据状态，lifecycle 的 unspecified/proposed/implemented/historical 表示实施阶段；confirmed 不等于已实施。historical/tentative 不是隐藏开关，默认查询仍可能返回历史或暂定内容，不能代替处理已知错误。

## 修改、提交与局部复核

1. 用 graph_search 找候选，graph_inspect 的 card/structure/relations/evidence 读取当前字段、直接关系与依据；card 是选集，删除前须显式展开并读完相关关系及 Evidence 页。next 是探索建议，不能代替分页。用 graph_read 读取当前源码、测试或文档，取得 available 的 `{path, version_token}`。文件映射的 File ID 只取当前项目返回的 files 视图或 graph_search(target="graph", node_types=["File"]) 结果；用实际路径核对，路径搜索命中不自动等于 File 节点，不猜 ID。
2. 只为任务授权内容构造 changes。单次最多32项，支持 create_node、patch_node、delete_node、create_edge、patch_edge、delete_edge。create_node 的 node 使用 id/type/name/state 等实际字段；patch_node 用 id 和 fields，patch_edge 用 source_id/relation/target_id 和 fields。字段省略会保留旧值，null 不是清空标记；显式空数组/空字符串按字段校验规则处理。保留正确 Evidence 声明；需要改变依据时重新读取文件，不提交猜测或 unavailable 令牌。Project/File 与自动关系不可手工维护。
3. 先 graph_edit(project_id=..., changes=..., phase="plan")，检查 validation.valid=true、errors_complete 未标不完整、changes_preview 中 before/after、impact 中级联影响及返回 expected_revision。计划不写图、不锁定版本，也没有可代替 changes 的持久化 plan_id。错误或检查不完整时修正并重新 plan；不能删掉必要 Evidence 或跳过关系来绕限。每批 Evidence 引用最多32条，同文件被不同 owner 引用分别计数，不拆单 owner。
4. 只有计划有效完整且影响在授权内，才提交同一 changes、显式 phase="apply" 和计划返回的 expected_revision。服务在事务内复验图修订、文件令牌与结构；修订/令牌冲突后重新读取、判断和 plan，不自动重试旧计划。多批先建端点，逐批计划/提交，后批失败不保证前批回滚；报告已生效部分。
5. 写后 graph_search 核对可发现性，graph_inspect 核对字段、关系方向、目标、删除与级联结果，并读完对应分页。写入成功不等于语义正确。contains 是真实组成且无环，depends_on 是直接有向依赖，related_to 是弱联系，proposes_for 仅为 proposed/historical Concept 指向 implemented Concept，maps_to 为 Concept→File 导航；不能用弱关系掩盖未知因果。
6. 文件修改后 graph_health(check="changed", options={"path":"<相对路径>"})，或显式 directory 做局部只读复核。文件页、owner 页独立续读；仅检查直接 Evidence/maps_to，不沿邻接扩图。inventory/quality/density/disk/migration 等 check 也只读，不刷新或写观察。迁移可能移除旧 File 前，用 check="migration" 和明确 moves 读完 impacts、每 owner Evidence 与新路径观察；计划不是执行许可，跨页磁盘观察不是快照。
7. 仅确需发现文件增删且已授权、入口已注册时，才 refresh 明确目录；单文件用根相对 include，刷新不重建语义内容。跨目录迁移分别刷新旧、新范围，再用 graph_health 的 inventory/changed 对账。旧 File 移除可能级联删映射，同名不证明依据等价；遵循目标项目的归档/忽略规则。

## 局部结构复核

图更新或重整时，仅复核直接涉及 Concept/Module、其 contains 父节点与明确指定的局部子图，读完 structure 页，排除自动 Project/File；不全图扫描。8个及以上直接语义子节点是复核信号，须同时有职责混杂、层级不一致、重叠或有依据分组缺失才建议整理，较少子节点有明确问题也可建议。

若当前摘要、内容与关系证明某节点是多个下游共同依赖的前置思维/组织原则，应说明其基础作用；统一性有价值、边界不清或拆分削弱解释时建议保留。不能凭数量/度数判断基础作用，不能为整齐而拆分。只有授权涵盖摘要修改且有依据才写入该作用，否则仅附注建议。

建议报告范围、节点/子节点数、问题依据、处理方向、导航影响及受影响关系；无合适候选明确说明。整理建议本身不改图，授权内实际变更沿用本指南预检流程。
