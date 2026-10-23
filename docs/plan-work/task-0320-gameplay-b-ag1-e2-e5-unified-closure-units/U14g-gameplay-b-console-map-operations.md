# Unit 0320-U14g：本地试玩台关卡操作参数

## Goal

扩展仅在开发模式主动开启的 Gameplay B 本地试玩台，让 `startMap` 在启动已加载 Map 后执行一组有限、可复现的 Map 操作，减少屏幕验收前逐步点击节点、能力、目标和回合提交的准备操作。

## Frozen Contract

- 保留 U14e/U14f 的 Map 加载、夏莱办公室、进行中 Run、正常 Party 准入与 `GameCommands.startMap` 规则。
- 参数格式：

  ```text
  startMap modid:map:itemid [--enter-office] [--move-to nodeId]
    [--ability actionId [--target-party characterId | --target-enemy enemyId]]
    [--commit-rounds 1–20]
  ```

- 参数可按任意输入顺序出现；操作按“移动 → 选择 Ability 与可选目标 → 提交回合”的固定顺序执行。
- `move-to`、`ability`、目标及 `commit-rounds` 每项至多一次；目标必须与 `ability` 一起提供，Party / Enemy 目标互斥；未知参数、缺失值、非法 ID 和非 1–20 整数拒绝整条输入。
- 具体操作复用现有 `GameCommands.moveMap`、`setMapAbilityDraft`、`commitMapEncounterRound`；每轮根据最新 ReadModel Draft、Commit 版本与 `canCommit` 预览提交，让 MapRun Owner 继续校验。
- 遭遇成功或失败、当前遭遇不可用时停止继续提交；参数命令不会跳过内容准入、目标校验、费用、效果、终局和 Receipt 规则。
- Map 启动后若某项操作失败，保留当前有效 Run 与已成功步骤，在试玩台显示中断原因；不伪装成整组事务或回滚已提交回合。
- 全部数据仅改当前浏览器内存，不持久化；只解析白名单参数，不执行输入文本。

## Allowed Files

- `src/ui/development/gameplay-b-quick-test-console.ts`
- `src/ui/main.ts`
- `tests/ui/gameplay-b-quick-test-console.test.ts`
- U14g 合同、验收需求单与 Receipt
- Task 0320 和计划索引中的当前状态链接

## Completion Criteria

- [x] 解析器支持既有纯启动命令及新关卡操作参数，并拒绝重复、未知、缺值和越界输入。
- [x] 操作按固定顺序通过现有 Map 命令执行；Commit 每轮读取最新预览，遇终态或不可用遭遇停止。
- [x] 自动化覆盖 U22 演练图：进入/启动、移动到 Encounter、选择 Ability 与 Party 目标、连续提交四轮。
- [ ] 屏幕验收由用户执行；报告提供一条可复制的完整命令。
- [x] 迷你控制台定向测试通过；类型检查、文档检查和差异检查结果写入 Receipt。

## Explicit Non-goals

- 不支持任意脚本、动态加载 Map、构造 Datapack、瞬移完成节点、直接写状态或绕过 GameCommands/MapRun Owner。
- 不替代真实浏览器验收；它只减少进入与演练准备的重复点击。
