# Unit 0301-U4：Enemy 只读 Action 卡牌 UI

## Goal

在现有 Map Encounter 右侧 Enemy roster 中显示 Owner 提供的 Hand、自然行动、目标与效果。卡牌使用共享 Map card binding / static host 结构，尺寸沿用已有 82×58 行动卡；玩家只能查看，不能改牌、目标或下达指令。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 项目入口 | `docs/ai/context-packs/ui-presentation.md` | Gameplay B Map 当前表现与交互边界 |
| UI 规范 | `ui-style/00-index.md`、`ui-style/patterns.md`、`docs/ai/frontend-design-project-overlay.md` | Map Workspace 三栏、卡牌宿主及局部 DOM 更新约定 |
| 源码 | `src/ui/components/map-workspace.ts`：renderEnemyRegion / renderEnemyHandStack | Enemy roster 的现有呈现区域 |
| 源码 | `src/ui/cards/card-host.ts`、`src/ui/cards/action-card.ts` | 共享真实卡牌对象绑定与 Action 卡模板 |
| 源码 | `src/ui/flow/map-flow-model.ts` | Commit Receipt 进入共享信息流 |
| 源码 | `src/arona-clicker/contracts/runtime.ts` | 只读 Enemy Prepared Action / Receipt View |
| 测试 | `tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/map-dom-updates.test.ts` | Workspace、敌方 UI 只读性及局部 DOM 生命周期 |

## Constraints

- UI 只消费 Runtime View；不自行抽牌、选目标或预测效果。
- Hand 卡绑定当前回合真实 Enemy card ref，并附着到静态 Enemy 卡牌宿主。
- 自然行动和目标摘要直接取自 preparedEnemyActions；Wait 不构造虚假卡片。
- Enemy 卡片尺寸与 Character 行动卡相同；不能新增 Swap、PlayerCommand、target-edit 或玩家费用控件。
- Map DOM 局部更新应保留 Enemy roster、卡牌及无关列 / 滚动容器的身份。
- 结算信息流显示 Enemy Action、实际目标、实际 HP / resource 变化、实际 sCost 与跳过原因，不再以固定 damage 表示 Enemy 回击。

## Allowed Files

- `src/ui/components/map-workspace.ts`
- `src/ui/css/map-workspace.css`
- `src/ui/flow/map-flow-model.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- `tests/ui/map-flow-adapter.test.ts`
- 必要的 Map relation / DOM update 测试
- Task 0301 与本 Unit / Receipt

## Completion Criteria

- [x] 每个 Enemy 显示当前真实 Hand 卡片与自然行动标识。
- [x] 目标、效果与 Wait 状态均来自 Runtime View；Enemy 卡没有玩家编辑入口。
- [x] 卡片复用共享宿主和 82×58 Action card 视觉结构。
- [x] Enemy Action Receipt 在 Flow 中显示真实结算及跳过信息。
- [x] Workspace、Flow、关系投影与 DOM update 定向测试通过。
