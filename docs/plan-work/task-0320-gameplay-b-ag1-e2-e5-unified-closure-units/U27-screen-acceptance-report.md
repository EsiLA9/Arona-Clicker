# Task 0320-U27 屏幕验收记录单

状态：自动化验证完成；屏幕验收待填写。本单记录人工屏幕检查需求，不表示已执行或通过。

## 验收入口

在开发版打开 Gameplay B 迷你控制台，执行：

```text
startMap gameplay-b:map:damage-protection-example --enter-office --move-to practice --ability prepare-ward --target-party serika --commit-rounds 1
```

## 检查项

1. 芹香起始 HP 为 8/10；白子能力结算后出现 1 点护盾与一层“一次防护”。
2. 训练机器人的第一击显示保护状态来源、层数从 1 降到 0、请求量与拦截量均为 3；HP 保持 8，护盾保持 1。
3. 第一击没有 `damageApplied` 回馈；同一动作第二击正常造成伤害，护盾吸收 1 点、HP 降至 6，并获得 `guard +1`。
4. Receipt 显示 `statusReceiptVersion: 6`，Status 列表与 roundEnd Status Trace 均为空；没有“保护拦截”对应的 Shield 消耗记录。
5. Flow 按实际来源顺序展示能力、第一击拦截和第二击伤害／Trigger 回馈；刷新或重新打开最近 Commit 后文本一致。

## 人工记录

- 浏览器与版本：
- 检查时间：
- 结果：未执行 / 通过 / 未通过
- 观察或偏差：
