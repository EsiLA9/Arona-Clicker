# 文档工具

## 完整性检查

`npm run check:docs` 执行 `scripts/check-docs.mjs`，扫描 `docs/` 与根目录 Markdown。当前规则包括 WikiLink 目标存在性及歧义、plan-work 内文件名唯一、文中引用的源码路径存在、已使用的 YAML 路由元信息字段、旧计划目录状态及持久文档对可删除 Goal Set 的引用。归档目录仍参与 WikiLink 检查；其中历史代码路径不做当前文件存在性校验。

检查器会忽略代码块和行内代码中的 WikiLink 示例，并对计划归档层放宽部分当前有效性检查。它是实现中列出的规则集合，不能验证文档描述与源码语义一致。

## 规模报告

`npm run report:doc-context` 执行 `scripts/report-doc-context.mjs`，统计若干预设文档分区的 Markdown 数量、字符数及按字符数除以四估算的 token 数，并提示超过估算阈值的分区。报告包含当前文档系统 `docs/docs-829/`，以及 AI 协作、Goal Set、冻结机制、计划归档和遗留 `docs/newPlan/` 等仍需跟踪的分区；历史快照与兼容重定向页不作为当前知识分区统计。

文档检查器递归扫描 `docs/`，所以 `docs/archive/docs-828-snapshot/` 与 `docs/docs-828/` 下的快照/重定向页都会参加 WikiLink 存在性检查。`docs/archive/` 中的历史代码路径不做当前文件存在性校验，归档副本也不参与裸文件名解析。旧链接若指向已迁移文档，需在快照中改为快照路径或兼容重定向路径，不能依赖扫描器忽略失效的 WikiLink。重定向页与快照中的归档链接应使用完整路径，避免裸名解析歧义。

## 入口

命令映射位于 `package.json`；检查规则和分区清单分别由 `scripts/check-docs.mjs` 与 `scripts/report-doc-context.mjs` 决定。
