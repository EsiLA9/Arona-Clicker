# Gameplay B MapRun Status 示例

本例说明 `lifetime: 'mapRun'` 的 Party Status 如何由直接列出的 Party Action 施加、跨越 Shop 和后续 Encounter，并在受击时产生可见效果。源定义为 `gameplayBMapRunStatusExampleMap`，ID 为 `gameplay-b:map:maprun-status-example`，AG-1 `resumeVersion` 为 1。

## 演练顺序

迷你控制台可先把当前路线启动到演练节点：

```text
startMap gameplay-b:map:maprun-status-example --enter-office --move-to practice
```

之后在游戏界面提交首个遭遇、离开补给站并继续战斗；现有白名单命令不会替代 Shop 离开操作。

地图按固定顺序运行同一节点的三个活动：

1. **施加同行掩护**：白子的 `apply-travelling-cover` 在 `origin` Encounter 的 `participants[].actions` 中直接声明。它将 `travelling-cover` 施加给 `source`，因此持有者是白子。该 Status 每次减免 2 点伤害，持续三次成功的 Encounter roundEnd。
2. **补给站**：可用 1 点信用点为芹香恢复 1 点 HP，也可直接离开。购买、离开 Shop 和 Activity 转场均不会推进 Status 时长。
3. **训练靶反击**：训练靶有 12 HP，每次请求对队伍稳定顺序中的首位成员造成 3 点伤害。前三次成功的 roundEnd 各减免 2 点；三次时长耗尽后，第四次攻击造成完整 3 点伤害，白子完成演练。

示例的固定队伍顺序为白子、芹香，故训练靶选择白子。若在首个 Encounter 后或 Shop 中保存，恢复后 MapRun Status 仍由当前 MapRun 持有；进入后续 Encounter 时它继续参与效果计算，不会复制到 Encounter-local Status 列表。到达演练出口或终止本局后，MapRun Status 清除。

## 作者要点

- `lifetime` 省略时仍表示 Encounter-local；只有明确写入 `lifetime: 'mapRun'` 的定义进入 MapRun 状态 Owner。
- MapRun Status 的来源 Action 必须由固定 Party 成员执行，并直接列在其来源 Encounter 的参与者 Action 列表中；仅经候选池引用不足以证明来源资格。
- `target: 'source'` 让本例无需额外目标选择。若使用 `target: 'primary'`，来源 Action 的主目标必须是 Party Character，且持有者仍须属于固定队伍。
- Status 时长只随成功的 Encounter roundEnd 推进。Shop、节点移动、Activity 转场和页面停留都不会消耗时长；新施加的实例也不会在创建它的同一 Commit 中触发。

宽屏人工屏幕验收步骤和记录字段见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U30-screen-acceptance-report]]。本文件介绍作者语义，不记录人工屏幕验收结论。
