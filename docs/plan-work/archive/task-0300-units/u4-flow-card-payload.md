# Unit 0300-U4：Flow 当前玩法卡载荷与投影

状态：completed — 2026-10-19。

## Goal

在已有纯 UI Flow DTO 中增加一个类型化、可选的当前玩法卡载荷；Map 适配器只从当前 Workspace 的 `cards` / `relations` 构造，Flow reducer 不制造第二张领域牌。

## Read Set

- `src/ui/flow/flow-entry.ts`
- `src/ui/flow/map-flow-model.ts`
- `src/arona-clicker/contracts/runtime.ts` 的 `MapRunActiveWorkspaceView`
- `tests/ui/map-flow-adapter.test.ts`

## Allowed Files

- `src/ui/flow/flow-entry.ts`
- `src/ui/flow/map-flow-model.ts`
- `tests/ui/map-flow-adapter.test.ts`

## Confirmed Facts

- Workspace `cards` 是 Owner 目录中的真实卡实例；`relations` 提供当前 source / target / candidates。
- Flow 已有 `streamKey`、`instanceKey`、`contentId`、`current / observed` 与 `replaceSameId`。
- 历史回执是 `observed`，不能成为可操作来源。

## Scope

- 新增 `FlowMapCard`：实例键、Object Key、可选 Relation Key、只读入口 `inspect/target`、展示字段与 zone。
- 新增 `MAP_FLOW_CURRENT_CARDS_SLOT` 条目；只在当前 Encounter 且有真实准备牌时生成。
- 卡实例键 = Flow 宿主 + entry 实例键 + 槽位 + Object Key。
- 来源消失、离开 Encounter 或读档后条目移除；领域卡与草稿不受影响。

## Explicit Non-goals

- 不开放任意 HTML、全业务 widget 插槽或作者 GameCommand 字段。
- 不从 actionId 或按钮数量生成卡牌身份。
- 不把 observed 回执当作当前卡。

## Completion Criteria

- 协同演练 Flow 出现来自 Owner 的真实射击牌；普通地点 / 回执 / 结果条目不变。
- 重复同步不新增或重排；卡牌来源消失只移除视觉条目。
- 载荷包含与 Map 相同的 Object Key / Relation Key 和不同 Instance Key。

## Stop Conditions

- 需要新增领域卡目录或长期 Flow 持久字段时停止。
- Workspace 查询不提供真实卡引用时停止，不得缓存伪造。

## Verification

- `map-flow-adapter.test.ts` 19 项通过。
- `flow-entry.test.ts` 16 项通过。
