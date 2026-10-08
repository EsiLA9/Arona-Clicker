# 06-wiki/60-engineering-support/docs-tooling — 文档检查与规模报告

> 本文回答：文档链接和结构能否自动检查，知识库规模怎样估算？

两个命令的用途不同：`check:docs` 查可机械确认的链接和结构问题；`report:doc-context` 统计若干文档分区的大小，帮助控制一次阅读量。它们都不能判断 Wiki 对源码的解释是否准确。

## 检查链接和文档结构

`npm run check:docs` 执行 `scripts/check-docs.mjs`。脚本从仓库根目录扫描 `docs/` 内的 Markdown 和根目录 `AGENTS.md`，主要检查：

- WikiLink 目标存在，且裸文件名链接没有歧义；归档副本以完整路径参与链接核验。
- `docs/plan-work/` 内正式文档文件名唯一，避免裸名引用歧义。
- 文档中引用的 `src/`、`tests/`、`tools/` 或 `scripts/` 源码路径仍存在；历史归档路径不按当前源码路径校验。
- 已使用 YAML 路由元信息字段齐全，旧计划目录没有继续承载现行 WikiLink，持久文档没有指向可整组删除的 Goal Set 内部文件。

命令成功表示当前脚本列出的结构规则通过。它不检查机制语义、源码与 Wiki 是否同步，也不证明链接页面的内容完整。正文变化仍须人工核对对应源码与测试，维护分区规则见 [[docs/docs-829/05-conventions/doc-maintenance]]。

## 估算文档分区大小

`npm run report:doc-context` 执行 `scripts/report-doc-context.mjs`，输出预设文档分区的 Markdown 篇数、字符数和 token 粗略估算。当前分区包括 `docs/docs-829/`、`docs/ai/`、若干计划与历史分区。估算公式是字符数除以四，不等于具体模型的分词结果；报告未列出的文件夹也不会自动合并到这些统计组。

估算超过 60,000 token 时脚本会提示将该分区拆开读取。它是上下文规划线索，不是构建或内容质量检查，也不会改写文件。

## 相关入口

- 路由检查实现：`scripts/check-docs.mjs`。
- 分区规模实现：`scripts/report-doc-context.mjs`。
- 两个命令的名称与脚本映射：`package.json`。
- 若检查提示链接或源码路径错误，先修正其维护页面并再次运行 `npm run check:docs`。

测试、类型检查和架构检查不是这两个文档命令的一部分，分别见 [[docs/docs-829/06-wiki/60-engineering-support/testing]] 与 [[docs/docs-829/06-wiki/60-engineering-support/architecture-checks]]。
