# Unit 0300-U1：交互 session 迁移 Options

状态：completed — 2026-10-19。

## Goal

把唯一的 `MapRelationInteraction` 构造器从四个位置参数迁为 Options；保持 Hover / Focus、固定、替换预览、编辑锁、拖拽、取消、stale 与 dispose 的现有优先级和命令语义。

## Read Set

- `src/ui/workspace/map-relation-interaction.ts`
- `src/ui/controller.ts` 的 `mapRelations` 构造与 `disposeMapFlow`
- `tests/ui/map-relation-interaction.test.ts`

## Allowed Files

- `src/ui/workspace/map-relation-interaction.ts`
- `src/ui/controller.ts`
- `tests/ui/map-relation-interaction.test.ts`

## Confirmed Facts

- 构造器原为 `(root, query, previewReplacement?, confirmTarget?)`。
- Controller 是唯一产品调用方；命令仍走 `GameCommands`。
- 交互 session 只持有一个，不给 Map / Flow / Popover 各建状态机。

## Scope

- 新增 `MapRelationInteractionOptions` 与 `MapRelationIntent`。
- `sendIntent` 携带 `relation`、`target`、`sourceInstanceKey`；U1 中实例键允许为 `null`。
- 保留可选 `previewReplacement`。
- `beginEdit` 记录来源实例键，供 U3 入口检查与后续宿主接入复用。

## Explicit Non-goals

- 不重写优先级、拖拽阈值、尾随 click 抑制或命令适配。
- 不新增任意字符串命令总线。
- 不改 Owner 单目标合同。

## Completion Criteria

- 现有交互测试全通过；新增一条断言验证一次意图只发送一次并携带来源实例键。
- `npx tsc --noEmit` 通过。

## Stop Conditions

- 需要修改上述白名单外文件时停止。
- 源码事实与 Task / Unit 冲突时停止并记录。
- 现有交互测试失败且无法解释时停止。

## Verification

- `node ./node_modules/vitest/vitest.mjs run tests/ui/map-relation-interaction.test.ts`：15 通过。
