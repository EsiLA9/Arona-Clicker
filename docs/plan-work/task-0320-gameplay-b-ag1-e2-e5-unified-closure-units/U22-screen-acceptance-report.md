# U22 E4 Damage Reduction Workspace 屏幕验收需求单

状态：待人工执行。作者合同、Planner、Status Receipt v5、Save/Restore、Flow、Workspace 与正式样例均通过自动化验证；当前没有浏览器人工操作记录。

## 验收目标

确认 Workspace 可读防御 Status 的每层/合计减伤与剩余轮数；Commit Flow 能按顺序说明原始伤害、伤害减免、Shield 吸收和 HP 变化；状态到期后减伤停止。

## 步骤

1. 打开开发版 `?devConsole=gameplay-b`，在迷你控制台运行：

   ```text
   startMap gameplay-b:map:damage-reduction-example --enter-office --move-to practice --ability cover-serika --target-party serika --commit-rounds 4
   ```

   命令会启动“防御减伤演练”、移动到遭遇、为 Ability“掩护芹香”选择芹香，并依 Owner 预览连续提交最多 4 轮。
2. 确认前 3 条 Commit Flow 分别显示：第一轮训练机器人请求 3，掩护状态按 1 层、每层 2 减至 1，护盾吸收 1，芹香 HP 仍为 8；第二、三轮减伤仍生效，芹香 HP 依次为 7、6。状态剩余轮数递减，并在到期后从单位状态区域移除。
3. 确认第四轮伤害请求仍为 3，Flow 不再出现掩护减免，芹香 HP 按普通伤害变化。
4. 检查 Workspace、最近回执与 Flow 中的原始伤害、减免来源、Shield 吸收、HP 变化和状态到期信息仍清晰可读。

> U14g 将进入 Map、移动、选择 Ability/目标与提交回合变成白名单参数；操作仍通过现有 GameCommands 和 MapRun Owner 逐步校验。报告只减少验收准备点击，不记作已经完成浏览器验收。

## 记录

- 结果：待填写。
- 浏览器 / 视口：待填写。
- 异常或截图：待填写。
