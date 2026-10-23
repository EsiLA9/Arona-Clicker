# U20 Status Category Cleanse Workspace 屏幕验收需求单

状态：待人工执行。Status Receipt v4、Restore 重放与 Workspace Flow 已通过自动化测试；测试不代替屏幕验收。当前没有浏览器人工操作记录。

## 验收目标

确认玩家能在正式 Workspace 中看到 Status 类别、实际目标和删除实例；清除 harmful 后，目标的 beneficial 状态仍然活动。

## 步骤

1. 在开发版迷你控制台运行 `startMap gameplay-b:map:status-example --enter-office`，进入“状态原语演练”。
2. 从入口进入“类别净化测试”，为白子选择“施加燃烧与再生”，主目标选择“训练目标”后提交。确认目标同时有燃烧与再生状态。
3. 下一轮为白子选择“清除有害状态”，保持训练目标为主目标并提交。确认 Commit Flow 显示 `category: harmful`、目标单位、被移除的燃烧实例及层数；再生不出现在 removed 列表，并继续显示为活动 Status。
4. 若演练允许再次选择该 Action，可再次对同一目标执行类别清除，确认 Flow 显示空匹配 `removed: []`，提交仍成功且 beneficial 状态不变。

## 记录

- 结果：待填写。
- 浏览器 / 视口：待填写。
- 异常或截图：待填写。
