# U21 Revive Workspace 屏幕验收需求单

状态：待人工执行。作者合同、Planner、Owner/Restore、目标选择、Flow 与正式样例均通过自动化验证；当前没有浏览器人工操作记录。

## 验收目标

确认 Workspace 会让玩家明确选择倒地 Party Character；Commit Flow 能说明复苏的目标、实际 HP 变化与来源顺序；同轮稍后仍有 Prepared 来源的队员可在被复苏后行动。

## 步骤

1. 在开发版迷你控制台运行 `startMap gameplay-b:map:revive-example --enter-office`，进入“复苏原语演练”。
2. 进入“队列复苏测试”。**同轮复苏走查**：选择 Ability“复苏芹香”，目标选择芹香后提交。确认 Commit Flow 的来源顺序为训练敌人、Ability、芹香 Prepared Action；Flow 显示芹香从 1 HP 被击倒、复苏到 3 HP、随后行动并恢复 1 HP，最终为 4 HP。
3. 新开一局。**倒地目标选择走查**：第一轮不选择 Ability，直接提交，确认敌人击倒芹香。下一轮选择 Ability“复苏芹香”，确认目标按钮显示“芹香（倒地）”，选择她并提交。
4. 确认 Flow 显示目标已复苏（HP 0 → 3），当前 HP 为 3；这轮开始已倒地的芹香没有被补回或重跑一个 Prepared 来源。
5. 若可直接再次选择复苏 Ability，在目标已存活时使用，确认 Flow 说明 `alreadyAlive` no-op，HP 保持不变。

## 记录

- 结果：待填写。
- 浏览器 / 视口：待填写。
- 异常或截图：待填写。
