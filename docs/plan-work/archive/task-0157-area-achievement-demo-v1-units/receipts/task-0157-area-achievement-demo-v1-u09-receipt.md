# Execution Receipt：Task 0157 U09

日期：2026-09-26

## 结果

- Records 主栏通过 `ctx.game.getAchievementView()` 获取成就项，并依投影顺序按 Init／Area 分组；保留同组项目顺序，不读取 PlayerState 或 Registry 中的 Milestone／Listener 关系。
- 使用现有 `service-card` 与 `panel-heading` 呈现标题、Init／Area 名称、线索、奖励说明和完成状态；简单进度显示当前值、比较符与目标，组合条件只显示线索与状态。无已发现目标时显示空状态。
- 成就 ID、Init／Area ID、名称、作者文案和格式化统计值均经转义；成就节点带 `data-achievement-id`，状态和进度及其数值子节点有稳定标记，供后续定点刷新。
- 没有增加 CSS、导航或交互，也未处理 U10。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/ui/service-workspace.test.ts --reporter=dot --silent` | 通过；1 个文件、12 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 325。并行预写期间曾短暂失败；上游修正后最终复核通过。 |

## 限制

- 本 Unit 只渲染调用时的只读投影；列表打开期间的事件刷新由后续 Unit 处理。
