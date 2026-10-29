# U19 Status Consume Workspace 屏幕验收需求单

状态：待人工执行。Status v3 Receipt/Workspace Flow 已通过自动化测试；测试不代替屏幕验收。当前没有浏览器人工操作记录。

## 验收目标

确认玩家能在 Workspace 中看见 Status 层数从 2 消耗到 1，读取 Commit Flow 的消费证据，并区分当前活动 Status 与已消费的 Receipt 历史。

## 步骤

1. 在开发版迷你控制台运行 `startMap gameplay-b:map:status-example --enter-office`，进入“状态原语演练”。
2. 进入“燃烧测试”，为白子选择“点燃训练目标”，目标设为训练目标后提交。确认活动单位 Status 显示燃烧 2 层。
3. 下一轮选择“消耗一层燃烧”，保持相同目标并提交。确认最新 Commit Flow 显示 Status ID `burn`、请求 1 层、消费 1 层、缺额 0 层及实例 `2 → 1`；回合末 burn 结算后，当前状态仍显示燃烧 1 层。
4. 再选择“清除燃烧”并提交。确认活动 Status 消失，Flow 显示按 ID 移除剩余实例。
5. 在一局新的演练中无 Status 时直接使用“清除燃烧”。确认提交成功，Commit Flow 显示空匹配 no-op，不新增活动 Status。

## 记录

- 结果：待填写。
- 浏览器 / 视口：待填写。
- 异常或截图：待填写。
