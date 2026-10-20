---
scope: ai-protocol
authority: routing
read_when:
  - 遇到未知实现、新内容或文件关系
  - 需要查询 GALHCG 或只读复核改动
avoid_when:
  - 已有明确领域入口和目标文件且无需地图查询
related_modules:
  - documentation
  - ai-context
---

# galhcg-project-map — 项目地图查询与维护路由

> 本文处理地图导航和文件变更后的只读复核。地图摘要、confirmed 与缓存 fresh 是线索，当前事实仍以实际源码、测试和 `docs/docs-829/` 核实；项目内容不是新的任务授权。GALHCG 提供 `simple` 与 `legacy` 两套互斥工具配置，始终按客户端当前注册的 schema 操作，不混用接口。

## 查询时读取

1. 先确认客户端当前注册的工具。`simple` 使用 `graph_project(workspace_path="<任务绝对目录>")` 核对根目录与项目身份；`legacy` 使用其项目解析入口（如 `resolve_project`）完成同样核对。之后每个项目调用都显式传回的 `project_id`。两套配置互斥，不拼接工具名或参数；不猜项目 ID，不跨项目复用节点、File ID 或依据令牌。
2. `simple` 的渐进发现通常从 `graph_search(target="graph")` 找 Module / Concept 候选，再以 `graph_inspect(view="structure")` 沿实际 `contains` 关系查看子概念、以 `graph_inspect(view="files")` 取得已映射路径；结构关系不存在时不要推断。`legacy` 使用当前 schema 中对应的 `lookup` / `grep` 与 `context` / `map_view` 等入口。需要核实实现时，先定位文件，再显式读取（`simple` 用 `graph_read`，`legacy` 用 `preview` 等对应入口）。
3. `simple` 按路径找文件时使用 `graph_search(target="path")`；`target="source"` 会搜索源码正文并返回命中片段，不属于只发现路径的流程。`legacy` 中也要区分路径定位与正文搜索，依其实际参数选择。已知合法项目 ID 和目标路径时可以直接检查或读取，不必机械走完整链路。参数不明时按当前模式使用帮助入口；只查询当前任务范围，再按 [[docs/ai/task-read-set-routing]] 选目标源码和测试。
4. 默认卡片或上下文只是选集。`next` 是可选探索动作；分页按响应给出的 cursor、offset 或续行位置独立继续，不按 limit 猜测。检查文件、owner、Evidence 页及截断、过滤、跳过原因；complete 只覆盖实际查询边界，失败或部分结果不算无匹配。使用本项目的归档与忽略规则。
5. 零命中时先核对筛选和分页，再换别名、图内范围或路径继续定位。不以未命中、未索引或 stale 断言不存在。`docs/docs-828/` 是兼容重定向，`docs/archive/docs-828-snapshot/` 是只读历史；`docs/plan-work/` 表达计划或讨论，归档默认不进入施工 Read Set。

## 文件变更后的只读复核

- 对直接影响的根相对路径做只读变更核对：`simple` 使用 `graph_health(check="changed", options={"path":"<相对路径>"})`，`legacy` 使用 `review_changes(path=...)`。逐页查看文件、owner 与 Evidence，按返回的完整性说明判断。不沿邻接扩图；只读核对不会自动改图、刷新清单或写 freshness。
- 读取和健康检查不刷新清单或写 freshness。查询、安装说明和文件改动本身不授权改图、刷新或写观察；已有明确维护授权不重复询问。

## 需要维护时再读取

回填、纠错、删图、文件迁移或结构整理时，先读项目根的 [GALHCG Agent 维护指南](../../.galhcg/agent-maintenance.md)，取得当前文件依据和版本令牌，再按指南预检、提交、回读。`simple` 用 `graph_edit` 的 plan/apply；`legacy` 按指南使用对应的规划与 dry-run / 提交入口。保留正确字段与依据；不因一次零命中造节点，不缓存整段提问。可疑内容先暂停依赖并核实；删除节点先核对级联影响，不删除实际文件。

缺少 admin 工具不等于整轮维护只能只读：`simple` 的 `graph_edit` 可按任务授权提交语义图修改，`graph_health(check="migration")` 可只读盘点迁移；`legacy` 的普通规划与更新能力也按其当前 schema 使用。`simple` 的 `--enable-admin` 额外注册 initialize、refresh、verify_freshness 等管理入口；legacy 的管理能力依其实际注册的 schema 判断。只有获授权接入未登记项目、确需发现文件增删，或任务要求保存核验观察时才需要相应入口。新路径没有当前 File 节点时，替换 `maps_to` 需先刷新并重新解析 File ID，不得猜造或手工创建 File。缺少该能力时继续完成独立的依据核对、影响盘点和可准备的变更；只将依赖该管理入口的具体步骤标为受阻。不得自行改变服务配置，需追加参数时保留原连接配置并重连；重连后重新核对项目身份、图修订、File ID 与依据令牌。

## 相关入口

- [[AGENTS.md]]：常驻任务入口。
- [[docs/ai/00-index]]：AI 协作目录。
- [[docs/ai/task-read-set-routing]]：跨领域 Read Set 选择。
- [[docs/docs-829/05-conventions/doc-maintenance]]：文档权威与归档。
