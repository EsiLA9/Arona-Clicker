# U17 E5 CardRef Modifier 屏幕验收需求单

状态：**未执行人工屏幕验收**。本页记录可复现的验收步骤与预期结果，不代表屏幕验收通过。

## 验收目标

确认游戏内 Map Encounter 工作区只向 Modifier 来源展示 AG-1 顺序中严格后执行的、另一名 Party Owner 当前实际 Prepared 的 damage/heal CardRef；候选卡同时显示 `伤害/治疗 ±delta`。选择、提交和后续读取均使用同一 scoped CardRef。

## 验收步骤与预期结果

1. 进入 `卡牌效果修正演练` Map，前往 `Prepared 治疗卡` 遭遇。
2. 查看白子本轮 Modifier 目标：芹香当前准备的 `强化治疗` 卡应显示 `治疗 +2`；自身卡、未准备 Hand 卡、Enemy Intent 和 AG-1 中序号不晚于来源的卡不应出现。
3. 选择该目标并提交本轮。预期 Commit Receipt 为 Program Receipt v2；来源与目标记录完整 scoped CardRef，且来源序号小于目标序号。目标 heal 原始请求为 2、修正后请求为 4；白子 HP 从 5 变为 9。
4. 从新 GameInstance 恢复该非终局 Save。预期 Receipt 与 HP 保持一致；恢复后不重新选择同 Action ID 的其他卡实例。
5. 单独验证目标跳过：令芹香以 1 HP 开始并让中途敌方行动击倒她。预期 Modifier Receipt 为 `notApplied`、原因 `defeated`，没有 heal hit。

## 自动化证据

- U17 候选/预览 Workspace 定向测试：40/40 通过；覆盖 AG-1 agility/队伍声明顺序、真实 PlayerCommand CardRef、失效 CardRef 拒绝重绑与增量文案。
- U17 正式示例与 Restore 定向测试：58/58 通过；覆盖 heal +2、Receipt/HP 回放及 defeated/notApplied。
- U17 运行时 Owner Commit/Restore 定向测试：83/83 通过；覆盖 applied/sourceSkipped/notApplied、逐 hit amount/HP 和回执篡改拒绝。
- U17 AST、Registry、Planner、ReadModel 与上述 UI/Owner 测试合计：223/223 通过；类型检查和架构边界检查通过。

## 本次未执行原因

当前试玩浏览器位于 Init。试玩台的 `startMap gameplay-b:map:card-modifier-example` 明确要求先经正常流程进入夏莱办公室，因此无法从当前页面直接启动示例。备用隔离地址 `127.0.0.1:5173` 连接被拒绝。进入办公室需要经过正常游戏流程，可能改动该浏览器已有本地游戏状态；本次没有执行这一步，也没有把自动化测试当作人工验收。

## 后续可测试性改进

Task 0320-U14f 已为开发试玩台增加显式入口参数：`startMap gameplay-b:map:card-modifier-example --enter-office`。该参数经既有 Init 恢复流程进入夏莱办公室，再启动当前已加载 Map；仍检查进行中的 MapRun 与固定队伍准入。该改进消除了必须手动进入办公室的步骤，但本报告的人工验收状态仍为未执行；可按 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14f-screen-acceptance-report]] 完成走查，再记录实际观察结果。
