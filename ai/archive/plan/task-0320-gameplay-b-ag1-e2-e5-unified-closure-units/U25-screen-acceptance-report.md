# U25 实际变化阈值 Workspace 屏幕验收需求单

状态：待人工执行。样例 Owner 自动化验证通过后，请在浏览器按以下步骤验收；本文是验收需求，不代表已有人工操作记录。

## 验收目标

确认 Trigger 门槛读取 DamageReduction/Shield/HP 结算后的实际 HP 损失；门槛未命中时 Flow 不显示 Trigger，门槛命中后资源先于后续来源可见。

## 步骤

1. 在开发版 `?devConsole=gameplay-b` 的迷你控制台运行：

   ```text
   startMap gameplay-b:map:actual-amount-threshold-example --enter-office --move-to practice --commit-rounds 1
   ```

   命令会进入“实际变化阈值演练”并提交一轮。
2. 检查来源顺序先为训练敌人、后为芹香 Prepared Action。第一击请求 3 点，2 点 Shield 被吸收，芹香 HP 从 9 到 8；实际损失 1，低于门槛 2，不显示 `guard-on-two-hp-loss` Trigger。
3. 第二击实际损失 2，达到门槛；确认 Flow 显示 Trigger 为芹香增加 `guard +1`。芹香随后读取该 guard 并对训练靶造成 1 点伤害。
4. 提交后确认芹香 HP 为 6、guard 为 1，训练靶 HP 为 4；Trigger Trace 只包含达到门槛的第二击，未命中事件没有 Trace 行或队列序号。

## 记录

- 结果：待填写。
- 浏览器 / 视口：待填写。
- 异常或截图：待填写。
