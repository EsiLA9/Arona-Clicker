# Unit 0320-U14f：本地试玩台关卡入口参数

## Goal

扩展 U14e 的本地试玩台 `startMap` 命令，使开发者可从 Init 选择页显式进入夏莱办公室并启动已加载 Map，减少屏幕测试前的重复手动操作。该 Unit 是 Task 0320 的后续可测试性补充，不重开 Task 0312 E1 U18。

## Frozen Contract

- 命令接受 `startMap modid:map:itemid` 与 `startMap modid:map:itemid --enter-office`；仅允许唯一、精确的可选参数 `--enter-office`，拒绝其他尾随内容。
- 不带参数时保持 U14e 行为：当前 Init 不是夏莱办公室便拒绝，其他操作不变。
- 带 `--enter-office` 时，仅对 Map 启动命令调用 UI Controller 的既有 Init 恢复流程；不得直接写 `activeInit`。成功确认进入夏莱办公室后才调用既有 `GameCommands.startMap` 与 Workspace 路由。
- 必须先确认 Map 已在当前 Registry 加载、当前没有进行中的 MapRun，且启动入口已接线，再触发 Init 切换。验证失败不应改变 Init 或 MapRun。
- 固定队伍准入、MapRun Owner、Commit/Restore 与地图准入规则不变。若正常 Init 进入成功但 Map 固定队伍准入失败，试玩台提供启动失败提示，不伪造角色或绕过准入。
- `getValue` 与角色快捷命令仍要求已进入夏莱办公室；本 Unit 不为这些命令增加跳过参数。
- 该控制台仍仅在 DEV + `?devConsole=gameplay-b` 显式启用；命令是白名单解析，不执行脚本。无活动 Init 时，进入办公室会沿用现有 Init 恢复流程及其状态语义。

## Allowed Files

- `src/ui/development/gameplay-b-quick-test-console.ts`
- `src/ui/main.ts`
- `tests/ui/gameplay-b-quick-test-console.test.ts`
- `docs/docs-829/02-modules/ui.md`
- 本 Unit 与 Receipt、相关屏幕验收需求单

## Completion Criteria

- [x] 解析器接受无参数与精确 `--enter-office`，拒绝未知、多余参数。
- [x] 显式入口先校验 Map 与进行中 MapRun，再经现有 Init 恢复流程进入办公室。
- [x] 办公室入口失败时不启动 Map；正常固定队伍准入仍由 Runtime 执行。
- [x] 无参数命令与其他试玩台命令保持原有约束。
- [ ] 浏览器人工屏幕验收；若无法执行，交付含步骤和预期结果的需求单。
- [x] 定向测试、类型检查、架构检查、文档检查与差异检查通过。

实施 Receipt：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U14f-receipt]]。人工屏幕验收步骤：[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14f-screen-acceptance-report]]。

## Explicit Non-goals

- 不修改正式世界线、Map 或 Party 内容。
- 不自动发放角色、不改变存档和持久化语义、不覆盖进行中的 MapRun。
- 不绕过 Office/Party/Map 的 Runtime 规则；`--enter-office` 只调用正常 UI Init 流程。
