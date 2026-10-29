# U14f 本地试玩台入口参数屏幕验收单

状态：**尚未执行人工浏览器验收**。本单给出可复现步骤与预期结果，不代表屏幕验收通过。

## 验收目标

确认 `--enter-office` 只在开发试玩台的 `startMap` 命令中显式启用；它通过现有 Init 恢复流程进入夏莱办公室，再启动 Registry 已加载的 Map，并继续遵守固定队伍准入和活动 MapRun 保护。

## 前置条件

- 使用开发构建启动游戏，并通过 `?devConsole=gameplay-b` 显式开启本地试玩台。
- 确认 `gameplay-b:map:card-modifier-example` 已由开发数据包加载。
- 从 Init 选择页开始，或确保当前没有进行中的 MapRun。

## 操作步骤与预期结果

1. 在 Init 选择页打开“本地试玩台”，输入并执行：

   ```text
   startMap gameplay-b:map:card-modifier-example --enter-office
   ```

   若固定队伍已经准入，预期沿现有流程进入夏莱办公室，并直接显示“卡牌效果修正演练”的 Map Workspace；试玩台显示已快速进入。

2. 若没有白子或芹香，预期办公室正常进入但 Map 启动被 Runtime 固定队伍准入拒绝，试玩台提示检查队伍准入，且不产生 MapRun。之后可在办公室使用既有角色快捷命令获得队员，再执行不带参数的 `startMap gameplay-b:map:card-modifier-example`。

3. 在已进入夏莱办公室时，执行不带 `--enter-office` 的 `startMap`。预期仍可按原有路径启动已加载 Map。

4. 先启动一个 Map 并保持其进行中，再执行带 `--enter-office` 的命令。预期提示当前存在进行中的关卡；不切换 Init、不替换 MapRun。

5. 从 Init 选择页输入未知 Map ID 并追加 `--enter-office`。预期提示 Map 未加载，且不会进入夏莱办公室。

6. 在 Init 选择页输入 `startMap <mapId> --unknown`。预期解析器拒绝未知参数，不发生状态变化。

## 已完成的自动化验证

- `tests/ui/gameplay-b-quick-test-console.test.ts`：14/14 通过，覆盖参数解析、从 Init 经正常 Controller 流程启动、未知 Map 无状态变化、固定队伍准入和活动 Run 保护。
- 类型、架构、文档和差异检查通过；自动化测试不代替上述手动浏览器验收。
