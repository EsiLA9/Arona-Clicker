# 一次性受击保护 Status 示例

本示例演示 AG-1 `damageProtection`：状态完整拦截一次正向伤害命中，消耗一层保护；后续命中继续经过普通护盾与 HP，并仅在实际损失 HP 后触发 `damageApplied`。

## 快速演练

在开发版打开 Gameplay B 迷你控制台，运行：

```text
startMap gameplay-b:map:damage-protection-example --enter-office --move-to practice --ability prepare-ward --target-party serika --commit-rounds 1
```

Map 必须已加载，且当前没有进行中的 MapRun。关卡可从 Gameplay B 现场终端的“进入一次性受击保护演练”入口进入。

## 预期结果

- 白子能力先为芹香增加 1 点护盾和一层保护状态。
- 训练机器人第一击请求 3 点伤害：保护拦截全部 3 点，芹香仍为 8 HP，护盾仍为 1，`damageApplied` 不触发。
- 同一攻击的第二击请求 3 点伤害：1 点被护盾吸收，芹香损失 2 HP；该次实际 HP 损失触发 `guard-on-hit`，芹香获得 `guard +1`。
- Commit Receipt 使用 `statusReceiptVersion: 6`；保护实例已耗尽，所以 `plannedStatuses` 与 roundEnd `statusTrace` 为空。Effect Trace 将保护拦截行放在两段攻击的实际执行顺序中。

## 规则边界

`damageProtection` 只拦截 AG-1 Program `damage` 对存活目标造成的正请求。保护发生在 outgoing CardRef Modifier 之后、`damageReduction` 与 Shield 之前；它不处理 `burn`、`hpChange`、heal、revive 或 E1/legacy 路径。完整合同见 [[../plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U27-e4-one-time-damage-protection-contract]]。
