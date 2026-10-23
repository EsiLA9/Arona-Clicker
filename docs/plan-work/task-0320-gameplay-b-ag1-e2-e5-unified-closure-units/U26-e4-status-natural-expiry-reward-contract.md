# Task 0320-U26：Status 自然到期资源回馈

状态：实现与自动化验证完成；屏幕验收待人工执行。U26 是 E4 Status 生命周期 Trigger 的窄首片；复用已有迷你控制台操作参数，需求单单独记录且不代表已人工验收。

## 目标与作者字段

- Map-local `GameplayMapStatusDef` 可选声明 `onExpire: { resourceId, delta }`。
- `resourceId` 必须是该 Map 声明给所有可能 Status 持有者的 Actor 资源；`delta` 必须是正安全整数。目标隐含为到期 Status 的 holder，不复用 Action Trigger 的 `primaryActor` 语义。
- 对任何声明了 `onExpire` 的 Status，Registry/Context 必须遍历实际 `statusApply` 使用位置，验证可能的 source/primary holder 都有该资源初值。运行时仍校验具体余额存在且入账不溢出。
- 每个自然到期的 Status 实例触发一次，不按 stacks 倍增；同一 Map-local Status ID 的不同 holder/source/action 实例分别结算。

## 到期时点、顺序与终局

- 只在成功 Commit 的 roundEnd Status Trace 同时满足 `removed === true`、`remainingRoundsBefore === 1`、`remainingRoundsAfter === 0` 时触发。先完成这一实例最后一次 Burn/Regen HP tick，再触发回馈；`damageReduction` 虽无 HP tick，仍按相同 duration 规则到期。
- 当前 Commit 全部 Action source 与 `healApplied`/`damageApplied` Trigger 结算后，先完成整批稳定顺序的 Status roundEnd tick；随后按 `statusTrace` 行顺序执行所有 `onExpire` 回馈；最后再判断 tick 后的 Encounter 终态。若 burn tick 倒地 holder，仍将资源发给该 holder。
- `statusApply` 同轮新建且被 roundEnd 规则跳过的实例不触发。显式 `statusRemove`、`statusConsume`、`statusRemoveCategory`、未到期刷新、Encounter teardown 及终局导致的 Status tick 跳过都不触发。
- Status 到期回馈不能改变本轮已经完成的来源选择、费用、条件或 Action Trigger；只影响该 Commit 最终余额及之后来源/回合可见值。

## 队列、预算与原子性

- Status expiry 是独立生命周期事件，不是 Action source，不得伪造 `executionSequence` 项、Action `parentExecutionIndex`、Heal/Damage path 或 HP amount。
- 沿用同一 Commit 的 Trigger FIFO 和 32 次激活总预算：所有 Action Heal/Damage Trigger 排在 roundEnd 事件前；Status expiry 按 roundEnd `statusTrace` 顺序追加；`queueIndex` 在两类事件间连续。超预算或任何余额/安装失败时整次 detached Commit 拒绝，不安装 HP、资源、Status、Receipt 的部分结果。
- 每个到期奖励的资源目标/ID/delta 与 before/after balance 必须在独立 expiry trace 中对账；玩家/敌方 Actor 的正确局内余额均在同一计划中更新。

## Receipt、Restore 与展示

- 保持 `statusTrace` 原形与 Status Receipt v1–v5 规则不变；保留 U23–U25 的 Action Trigger Receipt v1 行形状。
- 新增 Trigger Receipt v2 分支 `statusExpiryTriggerTrace`。v2 保留 `triggerTrace` 作为 Heal/Damage Action 行（当没有 Action Trigger 时允许空数组），并为每个 expiry 行记录：连续 `queueIndex`、`event: 'statusExpired'`、round、Status Trace index、被移除实例的完整身份（holder/Status ID/source/action/appliedRound/stacks/duration）、资源 ID/delta 和 holder 余额 before/after。该分支不包含 Action 父执行下标或虚构的 requested/actual HP amount。
- 只有发生至少一个 expiry 回馈时使用 Trigger Receipt v2；仅有 Action Heal/Damage 回馈时仍使用 v1；没有回馈事件的 Commit 不带 Trigger Receipt 字段。含 `onExpire` 新语义的正式 Map 提升自身 `resumeVersion`；不升级无关 Map。
- Restore 从 scheduler 起点重算最后一次 tick、到期实例、全局 Trigger 次序、holder 资源余额和 Receipt；丢失、增补、重排或篡改 expiry trace/余额均拒绝。历史 v1 Trigger、Status Receipt v5 Map 和 E1/legacy 路径保持兼容。
- Flow 在 Action 来源与 Action Trigger 后显示 roundEnd Status 到期回馈，说明 Status/holder/来源/剩余时长与资源余额变化；不显示虚构 Action/Card 来源。未自然到期的 Status 不生成该行。

## 正式样例与验证

- 新增可进入的 AG-1 Encounter-local `regen` 样例：芹香以 6/10 HP 入场，第一轮 Ability 施加 duration 2；Round 1 新状态不 tick，Round 2 恢复 1 HP、剩 1 轮，Round 3 最后恢复 1 HP 后到期并给 holder `focus +1`，Round 4 不再恢复/回馈。
- 开发迷你控制台一次运行 `startMap <mapId> --enter-office --move-to practice --ability apply-regen --target-party serika --commit-rounds 4` 完成演练；当前已有白名单能力满足此固定序列，不扩大为脚本或中途续跑器。
- 自动化覆盖自然最后 tick 与到期、Holder 资源入账、倒地 holder、显式清除/消费不触发、terminal-before-tick 不触发、Action Trigger 与 expiry FIFO/32 预算、Save/Restore 和篡改拒绝、旧 Receipt v1/v5 路径。

## 明确排除

- `onApply`、Status 每轮 Tick 事件、反击、其他 Status 持有事件、主动移除/消费/净化事件、链式触发、通用 Effect Program、跨 Encounter Status、E1/legacy 与 AC EventBus/Tick。
- 到期资源仍只写 MapRun Actor balance；不写 Team/AC 永久 Resource/Story，也不改变 scheduler/Program/Status Receipt 版本。
