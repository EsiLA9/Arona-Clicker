# Unit task-0283-u2-catalog-shell：中文分类、名称优先列表及窄屏布局承接共享框架。

## Goal

中文分类、名称优先列表及窄屏布局承接共享框架。

## Must Read / Read Set

- [[docs/plan-work/archive/task-0283-super-codex-phase-b-friendly-workspace]]
- [[docs/ai/frontend-design-project-overlay]]、[[ui-style/00-index]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]、[[docs/ai/PROJECT-CONSTITUTION]]
- `src/ui/runtime-editor/codex/view.ts`
- `src/ui/runtime-editor/codex/model.ts`
- `src/ui/runtime-editor/codex/state.ts`
- `src/ui/runtime-editor/codex/workspace.ts`
- `tests/ui/runtime-editor-codex-shell.test.ts`

## Context Budget

目标 10k–30k token；3–5 个代码文件、300–500 行净改动，历史 0 篇；超过先向主线程拆分。

## Optional Read Set

命中字段的源契约及其直接消费者，经主线程协调后定向读取。

## Do Not Read by Default

独立编辑器、历史快照、无关领域服务及完整源码目录。

## Confirmed Facts

现有图鉴 Pane／detail slot／局部更新已经存在，编辑器仍是独立会话；对应源码入口见父 Task。A 的真实查询合同经验收后作为 B 输入。

## Constraints

使用 frontend-design skill；保留原编辑器与 body 宿主；不让游戏场景主题污染工具，不新增内容写命令。

## Allowed Files

- `src/ui/runtime-editor/codex/view.ts`
- `src/ui/runtime-editor/codex/content-labels.ts`
- `src/ui/runtime-editor/codex/codex.css`
- `tests/ui/runtime-editor-codex-shell.test.ts`
- 本 Unit Receipt：`docs/plan-work/archive/task-0283-units/receipts/receipt-task0283-u2-catalog-shell.md`

## Explicit Non-goals

阶段 C 编辑器迁入、阶段 D、图谱写入、全表来源台账、Schema／玩法／玩家状态修改。

## Stop Conditions

采用 PROJECT-CONSTITUTION 六项停止条件；先由主线程明确 DOM／接口再施工，跨文件冲突及时报告。

## Completion Criteria

- [ ] Goal 的可见行为满足父 Task；稳定节点、scroll owner、浮层范围不退化。
- [ ] 指定测试通过，并填写 Receipt。

## Verification

`npx vitest run --silent tests/ui/runtime-editor-codex-shell.test.ts`；主线程负责整体类型／架构、真实浏览器与主题隔离验收。

