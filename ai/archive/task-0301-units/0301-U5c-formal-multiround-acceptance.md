# Unit 0301-U5c：正式多角色、多敌人验收

## Goal

使用官方 Map-only Datapack、Runtime、Save / Resume 与 Workspace，运行白子、芹香对机器人 A/B/C 的多轮战斗，核实自主目标、敌方意图、手动干预边界与回执。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | Task 0301：P5 最终验收 | 已批准的正式使用路径和必须覆盖场景 |
| 内容 | `gameplayBAutonomousTargetBattleDefinition` | 正式三机器人 Map 内容 |
| Engine | `MapRunService`、`RuntimeGameInstance` | 双方实际准备 / Commit / Save / Resume Owner |
| UI | `src/ui/components/map-workspace.ts`、`map-flow-model.ts` | Enemy 只读卡片及结果信息流 |
| 测试 | `tests/engine/gameplay-b-map-save-resume.test.ts`、`tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts` | 正式 Runtime 和可见行为证据 |

## Completion Criteria

- [x] 官方 Map-only Datapack 完成至少两轮双方自主行动；第一轮无手动指定目标即可提交。
- [x] 白子、芹香自然攻击同一低 HP 机器人时，后执行行动按当前合法目标策略避开已击败目标。
- [x] 下一轮重抽 Hand；Swap 与手动 Target 不重抽并遵守新 Action 目标策略。
- [x] Prepared Hand、目标、费用预览与 Receipt 经 Save / Resume 保持一致。
- [x] 官方地图 Workspace 显示真实敌方卡片与自动目标，Commit 后显示真实敌方行动。
- [x] 定向测试、类型、架构、Schema、文档与差异检查的运行结果有据可查；全量 Workspace 的既有候选高亮用例与 docs check 的旧路径错误单独记录。
