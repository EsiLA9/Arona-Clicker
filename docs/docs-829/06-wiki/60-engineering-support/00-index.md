# 06-wiki/60-engineering-support — 工程支持 Wiki

> 本文回答：我该用什么命令验证代码、Schema 同步、依赖边界或文档？

本分区记录项目用于验证边界、同步独立 Datapack Editor Schema、分析游戏 UI 调用关系及维护文档的工具。先按要回答的问题选择页面：

## 页面

- [[docs/docs-829/06-wiki/60-engineering-support/testing]]：测试入口与测试文件分布。
- [[docs/docs-829/06-wiki/60-engineering-support/schema-editor]]：引擎类型至独立 Datapack 编辑器 Schema 的生成与校验。
- [[docs/docs-829/06-wiki/60-engineering-support/architecture-checks]]：架构依赖边界静态检查。
- [[docs/docs-829/06-wiki/60-engineering-support/ui-callgraph]]：UI 调用图的范围与分析模式。
- [[docs/docs-829/06-wiki/60-engineering-support/docs-tooling]]：文档检查及规模报告。

## 命令入口

脚本入口集中在 `package.json`，具体行为以 `scripts/` 下实现为准。该 Wiki 描述脚本目前实现的能力，不表示脚本能够代替类型检查、运行时验证或人工审阅。

这些命令覆盖范围不同：Vitest 检查已写出的断言；Schema 生成命令同步编辑器描述；架构、UI 调用图和文档命令分别提供静态线索或结构检查。即使命令成功，也仍需对关键实现和产品流程做代码 Review。页面导航规则见 [[docs/docs-829/05-conventions/doc-maintenance]]。
