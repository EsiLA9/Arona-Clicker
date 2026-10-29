# U29 单体击杀回馈屏幕验收需求单

状态：待人工屏幕验收。自动化测试与回执重放已验证；本需求单不表示人工通过。

## 进入演练

在游戏内迷你控制台执行：

```text
startMap gameplay-b:map:enemy-defeated-reward-example --enter-office --commit-rounds 1
```

## 检查内容

1. 进入“单体击杀回馈演练”后提交第一轮。
2. 确认最近提交结果显示 `enemyDefeated` Trigger：被击败目标为训练靶，奖励领取者为白子，ammo 增加 1。
3. 确认后续观察者读取白子的 ammo 后，对白子造成 1 点 HP 损失；Serika 的 ammo 保持 0。
4. 确认训练靶 HP 为 0、观察者仍在场，遭遇尚未终止。
5. 确认最近提交结果明确显示 Trigger Receipt v3；击杀目标与奖励领取者身份不同。

## 预期结果

- 白子 HP：9 → 8；白子 ammo：0 → 1；Serika ammo：0。
- 训练靶 HP：3 → 0；观察者 HP 不变。
- Flow 中显示类似：`Defeat Trigger · enemyDefeated · 训练靶 · 奖励领取者 白子 · ammo +1`，并按来源顺序显示后续观察者行动。
- 人工若无法执行该命令，请记录阻塞步骤与当前可见 Flow 文案；不要把自动化结果当成屏幕验收结论。
