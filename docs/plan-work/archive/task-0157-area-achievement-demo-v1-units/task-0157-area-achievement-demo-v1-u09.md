# Unit 0157-U09：Records 成就列表

## Goal

在现有 Records 服务页展示已发现 Achievement，按 Init／Area 分组，呈现线索、奖励说明、完成状态与简单累计进度。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/ui.md`、`docs/ai/PROJECT-CONSTITUTION.md` | UI 与施工边界 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit、U08 Receipt | 产品范围及只读 API |
| 源码 | `src/ui/components/service-workspace.ts:renderRecordsMain`、`src/arona-clicker/read-model/achievement-view.ts:AchievementViewItem`、`src/ui/context.ts:UIContext` | 展示结构和字段 |
| 测试 | `tests/ui/service-workspace.test.ts` | 页面的现有验证入口 |

## Context Budget

目标约 10k–18k tokens；仅定位相关符号。额外阅读超出 2 个文件或 60k tokens 时停止上报。

## Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| Records 服务页已有三栏及 `renderRecordsMain`，目前只显示内容规模与统计占位 | `src/ui/components/service-workspace.ts` |
| 游戏门面可返回已发现、排序后的只读 Achievement 列表，内含进度和显示文案 | `src/arona-clicker/contracts/runtime.ts:GameReadModel.getAchievementView`、U08 Receipt |

## Constraints

- 只从 `ctx.game.getAchievementView()` 读取数据；不读取 PlayerState 或 Registry 中的 Milestone 关系。
- 当前 Area 优先顺序保持投影顺序；按 Init／Area 分组，不丢失不同 Init 的已发现内容。
- 明确显示未完成／已完成。简单进度显示当前／目标；组合条件无数值进度时只显示线索与状态。
- 所有作者文案、名称和用于属性的 ID 必须转义。Milestone／Listener ID 不进入玩家界面。
- 给每个成就节点稳定的 `data-achievement-id`，进度和状态子节点也提供稳定标记，供后续 U10 定点刷新。
- 复用现有 `service-card` 结构；本 Unit 不增加 CSS 或整页重绘逻辑。

## Allowed Files

- `src/ui/components/service-workspace.ts`
- `tests/ui/service-workspace.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u09-receipt.md`

## Explicit Non-goals

- 不修改只读投影、事件刷新、Runtime Editor、图鉴弹窗或数据包。
- 不加入 Roadmap、领取按钮或新的导航交互。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若现有样式不足以让列表可读，先报告所需 CSS 范围。

## Completion Criteria

- [ ] Records 页展示已发现成就，按 Init／Area 分组且保留投影顺序。
- [ ] 标题、线索、奖励、状态与简单进度正确且安全地渲染；未发现项不泄露。
- [ ] 定向测试覆盖分组、进度、转义及空状态；Receipt 记录实际结果。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/service-workspace.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
