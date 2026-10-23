# U26 Status 自然到期资源回馈屏幕验收单

状态：待人工执行。U26 自动化与样例 Owner 验证完成后，请在浏览器按以下步骤验收；本文只记录需求，不表示已有人工操作结果。

## 验收目标

确认 Status 新施加同轮不 tick；后续两轮的最后一次 Regen HP tick 先完成，随后自然到期资源回馈只执行一次；第四轮不再结算。

## 步骤

1. 在开发版 `?devConsole=gameplay-b` 的迷你控制台运行：

   ```text
   startMap gameplay-b:map:status-expiry-reward-example --enter-office --move-to practice --ability apply-regen --target-party serika --commit-rounds 4
   ```

   命令会进入“Status 自然到期回馈演练”，为芹香施加 Regen 并提交四轮。
2. Round 1 确认芹香仍是 6 HP，Status `remainingRounds=2`，没有 HP tick 或到期奖励。
3. Round 2 确认 Regen 最后一次前的 tick 将芹香恢复至 7 HP，`remainingRounds=1`，focus 仍为 0。
4. Round 3 确认 Regen 再恢复 1 HP 至 8，随后 Status 移除并只给芹香 `focus +1`；Flow 将到期回馈显示在最后一次 HP tick 之后，不出现伪造 Action/Card 来源。
5. Round 4 确认 Status 不再出现，芹香 HP 保持 8、focus 保持 1，没有新的 tick 或回馈。

## 记录

- 结果：待填写。
- 浏览器 / 视口：待填写。
- 异常或截图：待填写。
