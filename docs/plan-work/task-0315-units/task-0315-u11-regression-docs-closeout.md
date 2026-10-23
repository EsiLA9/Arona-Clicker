# Task 0315 Unit U11：机制文档与统一收尾

状态：completed — U01–U10 完成后，机制文档、验证和只读影响检查已收尾。

## Goal

按新作者合同更新权威机制 / 数据文档，统一复验直接影响范围与 Task 证据。

## Allowed Files

- `docs/docs-829/03-data-structures/datapack-contracts.md`
- `docs/docs-829/06-wiki/50-ui/refresh-update.md`
- `docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal.md`
- `docs/plan-work/00-index.md`
- 本 Unit 与对应 Receipt

## Completion Criteria

- 文档将 Action 的 effectProgram 写为唯一作者效果入口，并把 Shop Offer effects 解释为独立合同。
- 迁移矩阵与所有新旧语义差异、验证命令和真实结果回写 Task；未执行内容不写成通过。
- `npm run check:docs` 与 `git --no-pager diff --check` 通过，GALHCG 直接影响只读检查完成。

## Stop Conditions

- 机制文档与源码 / 测试冲突时停止，先查明并修正实现或文档证据。

## Validation

- `npm run check:docs`
- `git --no-pager diff --check`
- `npm run check:architecture`
- 产品验证结果以 U01–U10 Receipt 为准；不重复运行全量测试。
