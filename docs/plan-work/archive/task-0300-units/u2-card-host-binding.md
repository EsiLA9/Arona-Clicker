# Unit 0300-U2：共用卡牌 binding helper

状态：completed — 2026-10-19。

## Goal

在 UI 层建立一个小型卡牌宿主绑定模块，统一生成 / 读取视觉实例键、用途与入口标记；Map 当前准备牌、替换候选和卡牌目标选择控件都使用同一套绑定。视觉副本不产生新的领域对象。

## Read Set

- `src/ui/components/map-workspace.ts` 的 `cardAttributes`、`renderCardTargets`、替换候选与当前卡
- `src/ui/workspace/map-relation-presentation.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`

## Allowed Files

- `src/ui/cards/card-host.ts`（新增）
- `src/ui/components/map-workspace.ts`
- `tests/ui/card-host.test.ts`（新增）
- `tests/ui/gameplay-b-map-workspace.test.ts`（仅新增断言）

## Confirmed Facts

- 真实卡身份来自 `MapRunCardRef`；替换候选不创建新牌。
- 未选 PlayerCommand offer 没有真实 Object Key。
- 同对象可有多个视觉副本，必须共享 Object Key、区分 Instance Key。

## Scope

- 新增 `mapCardInstanceKey`、`mapCardBindingAttributes`、`mapCardHasEntry`、`mapCardInstanceAt`。
- Map 当前卡使用 `usage=live`；替换候选使用 `usage=replacement` 且只提供已有 option；目标选择控件使用 `usage=offer` 且提供 `target`。
- 当前卡入口按实际能力生成：`inspect`、`target`、可选 `editTarget` / `replace`。

## Explicit Non-goals

- 不建立 Host 基类、插件注册中心或新布局系统。
- 不强制单位面、行为牌与 Talklet 使用同一外框。
- 不用 actionId、DOM 序号或文本替代 Object Key。

## Completion Criteria

- 同对象不同宿主 / 槽位的 Instance Key 不同；Object Key 相同。
- 无真实卡的 offer 仍有 Instance Key 与 option，但没有 Object Key。
- `card-host` 测试与 Map Workspace 现有 21 项通过。

## Stop Conditions

- 需要新增领域卡或第二目录时停止。
- 需要修改 MapRun 合同或存档字段时停止。

## Verification

- `card-host.test.ts` 4 项通过。
- `gameplay-b-map-workspace.test.ts` 21 项通过（U6 前）。
