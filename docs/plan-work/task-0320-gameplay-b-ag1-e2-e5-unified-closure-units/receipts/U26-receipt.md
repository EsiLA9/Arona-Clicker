# Task 0320-U26 回执：Status 自然到期资源回馈

状态：实现与自动化验证完成；屏幕验收待人工执行。

## 交付

- `GameplayMapStatusDef` 为 burn、regen、damageReduction 新增可选 `onExpire: { resourceId, delta }`。语法要求正安全整数；Registry/Context 遍历各个 `statusApply` 用法并验证所有可能 holder 声明了该 Actor 资源。生成 Schema 与源契约同步。
- AG-1 Commit 先完成所有来源与 Action Heal/Damage Trigger，再结算整批 roundEnd Status tick，最后按 Status Trace 顺序向自然到期实例的 holder 记入 MapRun Actor 资源。仅 `removed && remainingRoundsBefore === 1 && remainingRoundsAfter === 0` 的事件触发；显式移除、消费、类别净化、未到期刷新、teardown 和 terminal-before-tick 不触发。Burn 最后一次 tick 可击倒 holder，仍会发放回馈。
- Action Trigger 与 Status expiry 共用每 Commit 32 次激活预算；expiry 是独立生命周期事件，不加入 executionSequence，也不伪造父 Action、HP amount 或 Card 来源。任何超预算、余额缺失或安全整数溢出都拒绝 detached Commit，不安装部分结果。
- 新增 Trigger Receipt v2 的 `statusExpiryTriggerTrace`，保留 Action Trigger v1 行形状；v2 记录连续 queueIndex、Status Trace index、到期 Status 全实例、holder 与资源余额 before/after。Restore 从 scheduler 起点重算并校验；Action-only Trigger Receipt v1、Status Receipt v1–v5、Scheduler/Program/Shield Receipt 格式保持。
- `runtime-game-instance.ts` 只读投影深冻结 expiry trace；Map Flow 在 Action Trigger 后显示 Status、holder、应用来源、到期前剩余轮数及局内资源余额变化，不显示虚构 Action/Card 来源。
- 正式样例 `gameplay-b:map:status-expiry-reward-example` 演练芹香 6→7→8 HP 与 focus 0→1。迷你控制台一次运行命令见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U26-screen-acceptance-report]]；已有 U14g 操作参数足够，无需增加控制台语法。

## 验证

- `npm run gen:schema`：通过；生成协议未变化。
- U26 Owner、作者语法／Registry、Map 注册、Flow、Runtime Workspace、U23/U24 Trigger、U25 Threshold 与 AG-1 Restore 相关定向验证合计 12 个文件、350/350 项通过。
- 覆盖 Regen 最后 tick、倒地 Party holder、Enemy Actor 余额、无 HP 变化的 damageReduction 到期、refresh、显式 remove/consume/category cleanse、terminal-before-tick、31 个 Action Trigger + 1 个 expiry 的预算边界、32 + 1 原子拒绝、Save/Restore 篡改拒绝，以及 UI ReadModel→Flow 的深冻结和可见顺序。
- `npx tsc --noEmit --pretty false`、`npm run check:architecture`、`npm run check:docs`、`git --no-pager diff --check`：通过。

## 人工屏幕验收

未执行。按用户要求以需求报告单交付；[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U26-screen-acceptance-report]] 保持“待人工执行”，自动化结果不等于人工屏幕验收通过。
