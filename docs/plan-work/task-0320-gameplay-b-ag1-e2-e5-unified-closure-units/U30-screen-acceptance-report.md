# Task 0320-U30 屏幕验收需求单

状态：待人工执行。自动化回归和本报告均不代表宽屏浏览器验收已通过。

## 验收范围

确认 MapRun-lifetime Party Status 在一场 Encounter、Shop 和后续 Encounter 之间由同一 MapRun 保持；Shop 不推进时长；进入后续战斗后减伤与到期展示符合预期；成功离开地图时清除该状态。

地图：`gameplay-b:map:maprun-status-example`（AG-1，resumeVersion 1）。作者说明：[[docs/examples/gameplay-b-maprun-status]]。

## 操作步骤

1. 在宽屏开发版游戏页的 Gameplay B 迷你控制台运行：

   ```text
   startMap gameplay-b:map:maprun-status-example --enter-office --move-to practice
   ```

2. 提交“施加同行掩护”遭遇。确认流程进入补给站。若当前游戏提供存档/恢复操作，可在 Shop 间隙保存并恢复后继续；不购买或离开补给站都不应推进状态时长。
3. 离开补给站，进入“训练靶反击”遭遇。提交前三轮：每轮训练靶请求 3 点伤害，白子因“同行掩护”各实际承受 1 点；状态剩余时长依次变为 2、1、0 并自然移除。
4. 查看第四轮预览并提交：不再有同行掩护减伤，白子承受完整 3 点伤害，完成演练并到达出口。
5. 沿路线到达演练出口，确认成功 Run 的状态投影中没有遗留 MapRun Status。

## 记录

| 项目 | 人工观察 |
| --- | --- |
| 浏览器窗口宽度／缩放 | 待填写 |
| 首个 Encounter 提交后到达 Shop | 待填写 |
| Shop 购买或离开时剩余轮数不变 | 待填写 |
| Shop 间隙 Save/Resume（若执行） | 待填写 |
| 后续 Encounter 减伤与 3→1 HP 变化 | 待填写 |
| 时长 3→2→1→0 与自然移除 | 待填写 |
| 时长耗尽后完整 3 点伤害 | 待填写 |
| 到达 Exit 后状态清理 | 待填写 |
| 结果、截图或问题 | 待填写 |

人工执行并填写实际观察前，U30 的屏幕验收保持未完成。
