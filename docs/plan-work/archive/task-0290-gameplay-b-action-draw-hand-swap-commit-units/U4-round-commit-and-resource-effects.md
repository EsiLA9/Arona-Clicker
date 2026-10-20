# U4：整轮 Commit 与 Actor / Team resource 效果

**状态：complete — 整队 Commit、资源原子结算与命令接线已实现并通过独立复核**

## 目标

沿 MapRun 唯一 Owner 创建正式版本化 Commit 管线：整队行动、PlayerCost、Actor / Team cost 与至少一种真实资源效果一起原子结算，并仅在成功后生成下一轮 Hand。

## 允许改动文件

- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-commands.ts`
- `src/arona-clicker/runtime-game-instance.ts`（只允许增加一条调用私有 MapRun Owner 的 Commit 转发；不得公开 Owner 或 Query 写接口）
- `tests/engine/gameplay-b-map-run.test.ts`（同步 U4 受影响的 MapRun snapshot fixture，并可增加 MapRunService 原子 Commit 用例）
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`

若需改动 Workspace 或更多测试，由总控先拆分，不得把 Action Commit 留作 UI 本地逻辑。Runtime GameInstance 的必要窄转发已纳入本 Unit 白名单。

## Read Set

- Task 0290 Commit 与资源语义、C3 / C4 分界。
- `src/arona-clicker/runtime-game-instance.ts`、`runtime-commands.ts` 现有 Map 命令接线。
- `runtime-game-instance.ts` 的 `#mapRunOwner` 与只读 `MapRunQuery` 边界；Commit 必须由新 command façade 调用唯一 Owner，不能把 Query 变为写入口。
- `operation-runtime-service.ts` 的版本匹配、detached 计划、原子安装、重试去重模式；不复用其 EventRun Owner。
- MapRun Save / Resume 测试及 C1 / C2 回归。

## 约束

- 一次 Commit 按固定队伍顺序结算每位队员当前 Prepared Action。Swap / Command 只替换一位角色的行动；PlayerCost Command 与 Action 自身 Actor / Team cost 分开记账。
- 对 detached 副本先检查整轮所有行动、Target、来源、费用和效果，再一次性写入；任何错误不动余额、行动记录、Prepared、Hand、round、RNG 或 MapRun 版本。
- Actor / Team Action costs 全部联合核验并从 Commit 开始时的余额支付；支付完成后再按固定队伍顺序应用 Effects。同一轮的任何 Effect 都不能为本轮任一 Action cost 提供资金。每步效果后的余额须仍为非负安全整数。
- 至少能真实应用 Actor 或 Team resource delta，供 Commit 后可见并证明所选 Action / Target 已执行。资源初值只来自 Map 显式数据。
- Action cost 扣除和 effects 应用后，Actor / Team 余额仍必须是非负安全整数；任何一项导致欠费或越界都回滚整轮。
- 使用唯一的 MapRun commit / command version，重试同一 request 不重复扣费 / 应用效果；旧版本请求拒绝。
- 成功后一次性记录结算结果、扣费、应用效果、推进 round、清除旧 Override、抽新 Hand。全 Wait 允许结算为无效果 round。
- `commitVersion` 是 MapRun 内单调版本；最近一次 `lastCommit` 结果属于当前 Encounter-local 状态，必须置于 `activeEncounter` 下，并在 Encounter 结束时清理。两者都由同一个 MapRunService 持有，不得另设提交记录 Owner。
- Restore 校验 `lastCommit` 时必须重验整队记录，并确认非空 `overrideKind` 至多一条、全队 `playerCostSpent` 合计不超过 1；伪造 receipt 不得恢复出违反共享 Override 的历史。
- 本 Unit 不建 HP、Enemy Action、Ability 或 Item；C4 只能扩展本提交管线，不得复制。

## 完成条件

- [x] 自然 Character 行动、Swap 选择和 PlayerCost Command 都通过同一 MapRun Commit。
- [x] 多个角色行动的费用 / 效果以稳定顺序预演，并在完整通过后原子安装。
- [x] 测试覆盖余额不足、目标非法、Hand Draw 后 Action 失效、过期版本、同请求重试、成功后新 Draw 与跨 Encounter resource 保留。
- [x] 费用和正 / 负 resource delta 不能产生负数或不安全整数；失败时整轮无部分写入。
- [x] Save / Resume 后重复 Commit 不会重演最后结果；伪造多条 Override / 超过 1 点 PlayerCost 的历史 receipt 被拒绝。
- [x] 独立只读审查无阻塞问题；Receipt 说明何种结果证明已真实执行所选 Action / Target：[[receipt-U4-round-commit-and-resource-effects]]。

