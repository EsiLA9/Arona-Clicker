# Task 0320-U25 回执：实际 HP 变化阈值 Trigger

状态：实现与自动化验证完成；屏幕验收待人工执行。

## 交付

- `GameplayMapEffectTriggerDef` 新增可选 `minimumActualAmount`；严格语法要求正安全整数，Normalizer 保留字段，AG-1 Context 继续校验同一 Action Program 的 primary Heal/Damage 与所有可能 primary Actor 的资源声明；生成 Schema 已同步。
- Planner 使用最终 `actualAppliedAmount` 比较门槛。Damage 比较值已包含 DamageReduction 与 Shield 结果；Heal 比较值已包含目标 HP 上限。未命中 Handler 不入 FIFO、不生成 Trigger Trace/资源意图、不占用 32 次 Commit 预算。
- 达标 Handler 延用 U23/U24 Trigger 声明顺序、FIFO、父来源完成后的资源结算、后续来源可见及独立 Trigger Receipt v1；没有升级无关 Scheduler/Program/Status/Shield 版本。
- 正式 Map `gameplay-b:map:actual-amount-threshold-example` 先为芹香添加 2 Shield；请求 3 Damage 实际损失 1，不触发；再请求 2 Damage 实际损失 2，触发 `guard +1`；后续芹香来源读取该资源并对训练靶造成 1 点伤害。
- Owner 集成验证覆盖 Preview/Commit、FIFO Trace 只含第二次受伤事件、Save/Restore 正常重放，以及提高门槛后对不一致历史的拒绝。

## 验证

- 作者/Normalizer/Registry/Schema 同步切片：4 个定向文件 75/75。
- Planner：55/55，覆盖请求量与实际量差异、低于/等于/高于门槛、HP cap、减伤、Shield 与未命中预算。
- 正式 Map Owner 样例：1/1；Registry Map/resumeVersion：1/1。
- U23/U24/U25 与 AG-1 相关回归：16 个测试文件 466/466。
- `npx tsc --noEmit --pretty false`、`npm run check:architecture`、`npm run check:docs` 与 `git --no-pager diff --check` 通过；最终文档扫描数量见 Task 0320 最新核验段。

## 屏幕验收

迷你控制台命令：

```text
startMap gameplay-b:map:actual-amount-threshold-example --enter-office --move-to practice --commit-rounds 1
```

人工浏览器验收尚未执行；逐步操作与结果记录见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U25-screen-acceptance-report]]。自动化结果不代表人工屏幕验收通过。
