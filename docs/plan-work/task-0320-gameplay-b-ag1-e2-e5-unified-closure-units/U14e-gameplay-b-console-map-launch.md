# Unit 0320-U14e：本地试玩台快捷进入 Map

## Goal

为仅在开发模式显式开启的 Gameplay B 本地试玩台增加严格命令 `startMap <mapId>`，直接启动一个当前 Registry 已加载的 Map 并切换至其 Workspace，减少屏幕测试前手动解锁 Spot、进入 Map 的步骤。

该命令是开发辅助入口，不改变正式玩家的 Spot/地图准入流程，不写入持久存档，也不接收任意脚本或 Datapack 文本。若已有进行中的 MapRun，必须拒绝启动，不覆盖当前进度。

## Frozen Contract

- 命令只接受 `startMap modid:map:itemid` 形式的完整三段 ID；拒绝缺段、多段、空段、参数尾随、非法字符和未知命令。
- 仅在开发构建通过 `?devConsole=gameplay-b` 主动启用后显示；执行仍要求当前 Init 为夏莱办公室。
- 目标 Map 必须已在当前 Registry 加载。控制台不动态加载数据包、不创建 Map、不解析代码。
- 若 `game.mapRun.getSnapshot()?.status === 'inProgress'`，拒绝并提示先结束或放弃当前 MapRun；已终结的 Run 可按 MapRun Owner 的现有准入开始新 Run。
- 启动委托给现有 `GameCommands.startMap`，成功后由 UI Controller 将 route 替换到新 Map Workspace、刷新并关闭试玩台，让目标页面立即可见；错误显示为试玩台结果，不吞掉既有 MapRun。
- 控制台原有 `getValue` 与角色快捷命令行为不变。

## Allowed Files

- `src/ui/development/gameplay-b-quick-test-console.ts`
- `src/ui/main.ts`
- `tests/ui/gameplay-b-quick-test-console.test.ts`

## Completion Criteria

- [ ] 解析器接受合法三段 Map ID 参数，拒绝不完整/多余/非法输入。
- [ ] 已加载 Map 可从夏莱办公室通过 GameCommands 启动并进入可见的 Map Workspace；状态结果可读。
- [ ] 活动 MapRun、未知 Map 和未进入夏莱办公室均安全拒绝。
- [ ] 开发参数不启用时，正式 UI 不挂载控制台。
- [ ] 定向测试、`npx tsc --noEmit --pretty false` 与 `git --no-pager diff --check` 通过。

## Explicit Non-goals

- 不新增/修改正式 Map 或 Action 内容，因此该 Unit 本身不会让 U14 additionalTarget 按钮出现在当前正式关卡中。
- 不绕过已有 Party 准入、MapRun Owner 或任何 Commit/Restore 校验。
- 不支持动态 Datapack 加载、任意地图构造或可执行表达式。
