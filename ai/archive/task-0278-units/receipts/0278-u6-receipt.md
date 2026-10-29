# Receipt 0278-U6

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | src/ui/components/operation-workspace.ts；tests/ui/operation-workspace-view.test.ts；tests/ui/gameplay-b-operation-controller.test.ts |
| 未完成内容 | 无 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | U7 统一审查实际变更路径并更新直接映射 |

## 实现结果

- Combat 当前牌面显示 Runtime 计划中的 Action 与 Target；基础计划标为“自动计划”，实际相对基础方案发生变化时标为“玩家已修订”。
- 未改动 UI wrapper 结构或 Controller 命令 API。打开行动替代层、选择当前默认值不写入 Run；已有覆盖选回基础方案后由 Runtime 清除单槽，并在 UI 回到自动标签。
- Carousel 星野的 Profile 优先目标型 Brace 作为默认值时，UI 显示 Ride 目标；选择 Brace 恢复自动计划，不保留干预槽。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向 UI / Controller | `npx vitest run --silent --reporter=dot tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-controller.test.ts` | 通过 | 2 个文件、42 项通过 |
| 浏览器验收 | 未运行 | 按 Task 计划省略 | DOM 与 Controller 定向测试覆盖；不新增布局结构 |
| 类型检查 | 未执行 | 延后 | U7 聚合验证 |
| GALHCG | 未执行 | 延后 | U7 统一闭环 |

## 遇到问题

旧 Controller 用例假定按手牌抽取顺序选择时 Brace 是备选牌。恢复 Profile 优先级后 Brace 成为自动默认，因此用例改为验证显示默认目标、选择默认方案不创建干预、选择回默认方案清除干预。

## 需上游确认项

- 无。

## 事实更新建议

- Operation UI 通过 `basePreparedBeat` 与 `effectivePreparedBeat` 区分自动方案和玩家实际修订；默认选值不代表干预。
