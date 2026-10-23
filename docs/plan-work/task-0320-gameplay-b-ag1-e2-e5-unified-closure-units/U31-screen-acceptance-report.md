# Task 0320-U31 屏幕验收需求单

状态：待人工执行。自动化测试、ReadModel 与本单均不代表宽屏浏览器屏幕验收已通过。

## 验收地图

地图：`gameplay-b:map:status-damage-reward-example`。作者说明：[[docs/examples/gameplay-b-status-damage-reward]]。

迷你控制台入口命令：

```text
startMap gameplay-b:map:status-damage-reward-example --enter-office --move-to practice --commit-rounds 1
```

## 宽屏鼠标检查

1. 在宽屏桌面浏览器打开开发版游戏页，使用迷你控制台运行上面的命令。
2. 确认演练地图进入“实际受伤回馈”Encounter，芹香获得“坚韧” Status。
3. 鼠标提交一轮。训练敌人请求 2 点伤害后，确认芹香 HP 从 8 降到 6、focus 从 0 增到 1。
4. 在最近一次 Commit Flow 中确认 `Damage Trigger`（若有）先于 `Status 受伤回馈`；回馈行应显示 holder、Status 来源、实际损失 HP 和 `focus +1（0→1）`。
5. 若界面允许，刷新或恢复 Save，再确认同一 Receipt 回馈行仍在 Flow 中，且没有重复增加 focus。

## 人工记录

| 项目 | 实际观察 |
| --- | --- |
| 浏览器宽度／缩放 | 待填写 |
| 地图是否进入 Encounter | 待填写 |
| Status holder 与来源 | 待填写 |
| HP 8→6、focus 0→1 | 待填写 |
| Flow 顺序与资源前后值 | 待填写 |
| Save／Resume 后 Receipt | 待填写 |
| 截图或问题 | 待填写 |

用户完成并填写实际观察前，U31 屏幕验收保持未完成。
