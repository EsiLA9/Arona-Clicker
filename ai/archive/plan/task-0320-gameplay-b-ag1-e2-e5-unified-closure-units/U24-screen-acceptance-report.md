# U24 damageApplied Workspace 屏幕验收需求单

状态：待人工执行。自动化样例与 Owner 集成验证完成后，请在浏览器按以下步骤验收；本文只列验收需求，不代表已有人工操作记录。

## 验收目标

确认只有实际 HP 损失才触发资源回馈；资源归属于受伤的 Serika，且在同轮较晚来源前完成结算并可读取。

## 步骤

1. 在开发版 `?devConsole=gameplay-b` 的迷你控制台运行：

   ```text
   startMap gameplay-b:map:damage-applied-resource-example --enter-office --move-to practice --commit-rounds 1
   ```

   命令会进入“受伤资源回馈演练”并按 Owner 队列提交一轮。
2. 确认来源顺序先是训练敌人、后是芹香 Prepared Action；Flow 显示训练敌人对芹香造成 1 点实际 HP 损失，芹香获得局内 `guard +1`。
3. 确认芹香的后续行动读取 guard，并对训练靶造成 1 点伤害；提交后芹香 HP 为 8、guard 为 1，训练靶 HP 为 4。
4. 检查 Trigger Flow 保留父 Enemy 来源、`damageApplied` 实际 HP 损失、队列次序与资源回馈关系，不显示伪造的 Action/Card 来源。guard 仅属于当前 MapRun。

## 记录

- 结果：待填写。
- 浏览器 / 视口：待填写。
- 异常或截图：待填写。
