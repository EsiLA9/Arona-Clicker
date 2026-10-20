# Unit 0300-U3：按视觉实例收窄入口

状态：completed — 2026-10-19。

## Goal

交互层只对“当前查询中的合法对象 + 该视觉实例确实提供入口”执行操作；只读副本不能发起编辑 / 换牌，普通 Flow marks 不能伪造卡牌绑定。

## Read Set

- `src/ui/workspace/map-relation-interaction.ts`
- `src/ui/components/map-workspace.ts`
- `src/ui/components/story.ts` 的 `markAttributes`
- `tests/ui/map-relation-interaction.test.ts`、`tests/ui/components/chat-text.test.ts`

## Allowed Files

- `src/ui/workspace/map-relation-interaction.ts`
- `src/ui/components/map-workspace.ts`
- `src/ui/components/story.ts`
- `tests/ui/map-relation-interaction.test.ts`
- `tests/ui/components/chat-text.test.ts`

## Confirmed Facts

- 原 `targetAt()` 只按 Object Key 命中；任意带 Object Key 的节点都可能成为卡牌目标。
- 原 `face()` / 拖拽起点依赖卡面 class 与关系键，缺少逐实例入口检查。
- `markAttributes()` 仅做属性名白名单，会放行 `data-map-*`。

## Scope

- 卡牌目标命中要求目标引用是当前候选，且该副本提供 `target` 入口；单位目标保持原路径。
- 编辑源要求对应实例提供 `editTarget`；拖拽起点改为 `data-map-card-entry~="editTarget"`。
- 目标选择控件必须提供 `target` 入口。
- 通用 Flow marks 过滤 `card-host` 保留的卡牌绑定 / 入口属性；移动等既有标记不受影响。

## Explicit Non-goals

- 不把“只读副本”自动跳转到另一个可操作副本。
- 不新增任意业务命令或由 UI 推断合法目标。
- 不改变 Hover / Focus 的只读检查能力。

## Completion Criteria

- 可编辑副本与只读副本共存；无 `target` 入口的卡牌副本点击不发送命令。
- 普通 marks 即使带相同 Object Key 也不能取得玩法入口。
- 现有交互、渲染测试全通过。

## Stop Conditions

- 需要 Owner 新增“判断 DOM 来源”的能力时停止。
- 需要放宽领域候选以迁就宿主时停止。

## Verification

- `map-relation-interaction.test.ts` 16 项通过。
- `chat-text.test.ts` 23 项通过。
