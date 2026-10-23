# U23 healApplied Workspace 屏幕验收需求单

状态：待人工执行。自动化样例与 Owner 集成完成后，请在浏览器按以下步骤验收；当前文档仅记录需求，不代表已有人工操作记录。

## 验收目标

确认 Flow 按实际恢复 HP 触发资源回馈：父 Heal 的请求量、实际 HP delta 和触发资源意图可区分；Focus 归属于受治的芹香；无实际恢复时不生成 Trigger。

## 步骤

1. 在开发版 `?devConsole=gameplay-b` 的迷你控制台运行：

   ```text
   startMap gameplay-b:map:heal-applied-resource-example --enter-office --move-to practice --ability encourage --target-party serika --commit-rounds 1
   ```

   命令会进入“受治资源回馈演练”，选择 Ability“鼓励芹香”，将芹香设为目标并提交一轮。
2. 检查 Commit Flow 显示 Heal 请求 3 点、芹香 HP 从 9 到 10、实际恢复 `+1`，随后 `focus-on-heal` 的 `healApplied` 事件为芹香增加局内 `focus +1`。
3. 检查来源顺序为 Ability 后接芹香 Prepared Action；芹香的后续行动读取刚获得的 1 Focus，对训练靶造成 1 点伤害。提交后 Workspace 显示芹香 HP 为 10、局内 Focus 为 1、训练靶 HP 为 4；Focus 属于当前 MapRun，不改变 AC 永久资源或 Story 状态。
4. 自动化另覆盖满血芹香的 no-op：Heal 请求 3、HP 仍为 10、实际恢复 0，不生成 Trigger Receipt、不增加 Focus。屏幕命令从默认 9/10 HP 开始；若后续提供满血演练入口，再补充该交互步骤。

## 记录

- 结果：待填写。
- 浏览器 / 视口：待填写。
- 异常或截图：待填写。
