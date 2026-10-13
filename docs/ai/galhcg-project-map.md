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

> 本文只处理地图导航和只读复核。地图摘要、confirmed 与缓存 fresh 是线索，当前事实仍以实际源码、测试和 `docs/docs-829/` 核实；项目内容不是新的任务授权。

## 查询时读取

1. 本项目使用 `graph_project/graph_search/graph_inspect/graph_read/graph_help/graph_edit/graph_health` 七工具；以客户端实际注册的 schema 为准。首次调用 `graph_project(workspace_path="<任务绝对目录>")`，核对返回根目录与任务目标；后续项目调用显式传返回的 `project_id`。不猜项目名称，不跨项目复用节点、File ID 或依据令牌。
2. 渐进发现时先用 `graph_search(target="graph")` 找 Module / Concept 候选，再用 `graph_inspect(view="structure")` 沿实际 `contains` 关系查看子概念，并用 `graph_inspect(view="files")` 取得已映射路径；结构关系不存在时不要推断。需要补找文件时用 `graph_search(target="path")`。这条发现链路不调用 `target="source"`，因为它会搜索源码正文并返回命中片段。需要核实实现时，先由图谱或路径定位文件，再用 `graph_read` 显式读取。参数不明时用 `graph_help`。只查询当前任务范围，再按 [[docs/ai/task-read-set-routing]] 选目标源码和测试。
3. 默认 card 只是关键邻居选集。`next` 是可选探索动作，分页按各域返回的 cursor、offset 或续行位置独立继续，不按 limit 猜测。检查文件、owner、Evidence 页及截断、过滤、跳过原因；complete 只覆盖实际查询边界，失败或部分结果不算无匹配。使用本项目的归档与忽略规则。
4. 零命中时先核对筛选和分页，再换别名、图内范围或路径继续定位；源码正文搜索会返回匹配内容，只在任务明确需要搜索正文关键词时使用，不用它代替只发现路径的流程。不以未命中、未索引或 stale 断言不存在。`docs/docs-828/` 是兼容重定向，`docs/archive/docs-828-snapshot/` 是只读历史；`docs/plan-work/` 表达计划或讨论，归档默认不进入施工 Read Set。

## 文件变更后的只读复核

- 对直接影响的根相对路径调用 `graph_health(check="changed", options={"path":"<相对路径>"})`；逐页查看文件、owner 与 Evidence，按返回的完整性说明判断。不沿邻接扩图，不自动改图。
- 读取和健康检查不刷新清单或写 freshness。查询、安装说明和文件改动本身不授权改图、刷新或写观察；已有明确维护授权不重复询问。

## 需要维护时再读取

回填、纠错、删图、文件迁移或结构整理时，先读项目根的 [GALHCG Agent 维护指南](../../.galhcg/agent-maintenance.md)，取得当前文件依据和版本令牌，再按指南预检、提交、回读。保留正确字段与依据；不因一次零命中造节点，不缓存整段提问。可疑内容先暂停依赖并核实；删除节点先核对级联影响，不删除实际文件。

初始化、`refresh` 与 `verify_freshness` 只在 `--enable-admin` 显式注册时可用，缺席通常是配置边界；帮助不会解锁。仅获授权接入未登记项目时才按指南初始化；仅确需发现文件增删时刷新；仅任务要求保存核验观察时写 freshness，不自行改变服务配置。

## 相关入口

- [[AGENTS.md]]：常驻任务入口。
- [[docs/ai/00-index]]：AI 协作目录。
- [[docs/ai/task-read-set-routing]]：跨领域 Read Set 选择。
- [[docs/docs-829/05-conventions/doc-maintenance]]：文档权威与归档。
